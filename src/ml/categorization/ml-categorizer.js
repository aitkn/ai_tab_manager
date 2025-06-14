/*
 * AI Tab Manager - ML Categorizer
 * Integrates ML system with categorization flow
 */

import { getTabClassifier } from '../models/tab-classifier.js';
import { getEnsembleVoter } from '../voting/ensemble-voter.js';
import { getFeedbackProcessor } from '../learning/feedback-processor.js';
import { getPerformanceTracker } from '../trust/performance-tracker.js';
import { ML_CONFIG } from '../model-config.js';
import { TAB_CATEGORIES } from '../../utils/constants.js';

/**
 * ML Categorizer for tab categorization
 */
export class MLCategorizer {
  constructor() {
    this.classifier = null;
    this.voter = null;
    this.feedbackProcessor = null;
    this.performanceTracker = null;
    this.isInitialized = false;
  }
  
  /**
   * Initialize the ML categorizer
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Load components with WebGL error handling
      this.classifier = await this.loadClassifierWithFallback();
      this.voter = getEnsembleVoter();
      this.feedbackProcessor = getFeedbackProcessor();
      this.performanceTracker = getPerformanceTracker();
      
      // Check if model exists
      const modelExists = await this.classifier.exists();
      if (!modelExists) {
        console.log('ML model not found, will use rules/LLM only');
      }
      
      this.isInitialized = true;
      
    } catch (error) {
      console.error('Error initializing ML categorizer:', error);
      // Continue without ML - fallback to rules/LLM
      this.isInitialized = true;
    }
  }
  
  /**
   * Load classifier with WebGL error fallback
   */
  async loadClassifierWithFallback() {
    try {
      const classifier = await getTabClassifier();
      
      // Check if the model loaded properly (has weights)
      if (classifier && classifier.metadata && classifier.metadata.accuracy) {
        return classifier;
      } else {
        // Model structure loaded but weights may have failed - try CPU fallback
        return await this.attemptCPUFallback();
      }
      
    } catch (error) {
      console.error('Error loading classifier:', error);
      
      // Check if it's a WebGL-related error
      if (error.message && (error.message.includes('Maximum call stack') || 
                           error.message.includes('WebGL') ||
                           error.name === 'RangeError')) {
        return await this.attemptCPUFallback();
      } else {
        throw error; // Re-throw if it's not a WebGL error
      }
    }
  }
  
  /**
   * Attempt to load classifier on CPU backend
   */
  async attemptCPUFallback() {
    // Switch to CPU backend
    const { switchBackend } = await import('../tensorflow-loader.js');
    await switchBackend('cpu');
    
    // Reset classifier cache and try loading again on CPU
    const { resetTabClassifierCache } = await import('../models/tab-classifier.js');
    resetTabClassifierCache();
    
    // Try loading classifier again on CPU
    const classifier = await getTabClassifier(true); // Force reload
    
    // Switch back to GPU for inference if possible
    const { getBackendInfo } = await import('../tensorflow-loader.js');
    const backendInfo = getBackendInfo();
    if (backendInfo.available.includes('webgl')) {
      try {
        await switchBackend('webgl');
      } catch (switchError) {
        console.warn('Could not switch back to GPU:', switchError);
      }
    }
    
    return classifier;
  }
  
  /**
   * Categorize tabs using ML + rules + LLM ensemble
   * @param {Array} tabs - Tabs to categorize
   * @param {Object} options - Categorization options
   * @returns {Object} Categorization results with metadata
   */
  async categorizeTabs(tabs, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const {
      rules = [],
      llmResults = null,
      useLLM = true,
      useML = true,
      useRules = true
    } = options;
    
    // Prepare predictions from each method
    const allPredictions = {};
    
    // 1. Rule-based predictions
    if (useRules && rules.length > 0) {
      allPredictions.rules = await this.getRulePredictions(tabs, rules);
    }
    
    // 2. ML predictions
    if (useML && this.classifier && await this.classifier.exists()) {
      try {
        allPredictions.model = await this.getMLPredictions(tabs);
      } catch (error) {
        console.error('Error getting ML predictions:', error);
      }
    }
    
    // 3. LLM predictions (passed in from existing categorization)
    if (useLLM && llmResults) {
      allPredictions.llm = this.formatLLMResults(tabs, llmResults);
    }
    
    // 4. Ensemble voting
    const votingResults = await this.voter.vote(allPredictions);
    
    // 5. Format final results
    const finalResults = this.formatFinalResults(tabs, votingResults);
    
    // 6. Track performance for enabled methods
    await this.trackPerformance(votingResults);
    
    return finalResults;
  }
  
  /**
   * Get rule-based predictions
   */
  async getRulePredictions(tabs, rules) {
    const predictions = {};
    
    // Import rule application logic
    const { applyRulesToTabs } = await import('../../modules/categorization-service.js');
    const { extractDomain } = await import('../../utils/helpers.js');
    const { RULE_TYPES, RULE_FIELDS } = await import('../../utils/constants.js');
    
    // Apply rules to each tab
    tabs.forEach(tab => {
      let category = null;
      let confidence = 1.0; // Rules are deterministic
      
      // Check each rule
      for (const rule of rules) {
        if (!rule.enabled) continue;
        
        let matches = false;
        
        switch (rule.type) {
          case RULE_TYPES.DOMAIN:
            const tabDomain = extractDomain(tab.url);
            matches = tabDomain === rule.value;
            break;
            
          case RULE_TYPES.URL_CONTAINS:
            matches = tab.url.includes(rule.value);
            break;
            
          case RULE_TYPES.TITLE_CONTAINS:
            matches = tab.title && tab.title.includes(rule.value);
            break;
            
          case RULE_TYPES.REGEX:
            try {
              const regex = new RegExp(rule.value);
              const field = rule.field === RULE_FIELDS.TITLE ? tab.title : tab.url;
              matches = regex.test(field);
            } catch (e) {
              console.error('Invalid regex:', rule.value, e);
            }
            break;
        }
        
        if (matches) {
          category = rule.category;
          break; // Apply first matching rule only
        }
      }
      
      // Store prediction if matched
      if (category !== null) {
        predictions[tab.id] = {
          category,
          confidence,
          source: 'rules'
        };
      }
    });
    
    return predictions;
  }
  
  /**
   * Get ML predictions
   */
  async getMLPredictions(tabs) {
    const predictions = {};
    
    try {
      // Prepare input data
      const inputData = tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        id: tab.id
      }));
      
      // Get predictions from classifier
      const results = await this.classifier.predict(inputData);
      
      // Format predictions
      results.forEach((result, index) => {
        const tab = tabs[index];
        predictions[tab.id] = {
          category: result.category,
          confidence: result.confidence,
          source: 'model',
          probabilities: result.probabilities
        };
      });
      
    } catch (error) {
      console.error('Error in ML predictions:', error);
    }
    
    return predictions;
  }
  
  /**
   * Format LLM results for voting
   */
  formatLLMResults(tabs, llmResults) {
    const predictions = {};
    
    // LLM results are in format: { 1: [tabs], 2: [tabs], 3: [tabs] }
    Object.entries(llmResults).forEach(([category, categoryTabs]) => {
      categoryTabs.forEach(tab => {
        predictions[tab.id] = {
          category: parseInt(category),
          confidence: 0.8, // Default LLM confidence
          source: 'llm'
        };
      });
    });
    
    return predictions;
  }
  
  /**
   * Format final results for categorization service
   */
  formatFinalResults(tabs, votingResults) {
    const categorized = {
      [TAB_CATEGORIES.UNCATEGORIZED]: [],
      [TAB_CATEGORIES.CAN_CLOSE]: [],
      [TAB_CATEGORIES.SAVE_LATER]: [],
      [TAB_CATEGORIES.IMPORTANT]: []
    };
    
    const metadata = votingResults.metadata || {};
    
    // Group tabs by category
    tabs.forEach(tab => {
      const category = votingResults.categories[tab.id];
      if (category !== undefined && categorized[category]) {
        // Add metadata to tab
        const tabWithMetadata = {
          ...tab,
          mlMetadata: metadata[tab.id]
        };
        categorized[category].push(tabWithMetadata);
      } else {
        // Uncategorized
        categorized[TAB_CATEGORIES.UNCATEGORIZED].push(tab);
      }
    });
    
    return {
      categorized,
      metadata,
      summary: votingResults.summary
    };
  }
  
  /**
   * Track performance of predictions
   */
  async trackPerformance(votingResults) {
    // Performance tracking happens when user accepts/corrects
    // This is handled by feedback processor
  }
  
  /**
   * Process user accepting categorization
   */
  async processAcceptance(tabs, categorization) {
    await this.feedbackProcessor.processAcceptance(tabs, categorization);
  }
  
  /**
   * Process user correction
   */
  async processCorrection(tab, oldCategory, newCategory, metadata) {
    await this.feedbackProcessor.processCorrection(tab, oldCategory, newCategory, metadata);
  }
  
  /**
   * Get ML system status
   */
  async getStatus() {
    const status = {
      initialized: this.isInitialized,
      modelExists: false,
      modelAccuracy: null,
      trustWeights: null,
      feedbackStats: null
    };
    
    if (this.isInitialized) {
      try {
        // Check model
        if (this.classifier) {
          status.modelExists = await this.classifier.exists();
          if (status.modelExists) {
            const summary = this.classifier.getSummary();
            status.modelAccuracy = summary.metadata?.accuracy;
          }
        }
        
        // Get trust weights
        const { getTrustManager } = await import('../trust/trust-manager.js');
        const trustManager = getTrustManager();
        status.trustWeights = trustManager.getTrustWeights();
        
        // Get feedback stats
        if (this.feedbackProcessor) {
          status.feedbackStats = this.feedbackProcessor.getStatistics();
        }
        
      } catch (error) {
        console.error('Error getting ML status:', error);
      }
    }
    
    return status;
  }
  
  /**
   * Check if ML is available and should be used
   */
  async isMLAvailable() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return this.classifier && await this.classifier.exists();
  }
  
  /**
   * Get insights from ML system
   */
  async getInsights() {
    const insights = [];
    
    if (this.feedbackProcessor) {
      const feedbackInsights = this.feedbackProcessor.generateInsights();
      insights.push(...feedbackInsights);
    }
    
    return insights;
  }
}

// Export singleton
let categorizerInstance = null;

export async function getMLCategorizer(forceReload = false) {
  if (!categorizerInstance || forceReload) {
    categorizerInstance = new MLCategorizer();
    await categorizerInstance.initialize();
  }
  return categorizerInstance;
}

/**
 * Reset the ML categorizer instance to force reload
 */
export function resetMLCategorizerCache() {
  categorizerInstance = null;
}

export default {
  MLCategorizer,
  getMLCategorizer
};