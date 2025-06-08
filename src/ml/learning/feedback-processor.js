/*
 * AI Tab Manager - Feedback Processor
 * Processes user feedback and corrections for continuous learning
 */

import { ML_CONFIG } from '../model-config.js';
import { addTrainingData, recordMetric } from '../storage/ml-database.js';
import { getTrustManager } from '../trust/trust-manager.js';
import { getModelTrainer } from '../training/trainer.js';

/**
 * Feedback Processor for continuous learning
 */
export class FeedbackProcessor {
  constructor() {
    this.trustManager = getTrustManager();
    this.pendingFeedback = [];
    this.correctionPatterns = new Map();
    this.learningQueue = [];
    this.isProcessing = false;
  }
  
  /**
   * Process user accepting categorization results
   * @param {Array} tabs - Categorized tabs
   * @param {Object} categorization - Categorization results with metadata
   */
  async processAcceptance(tabs, categorization) {
    const feedback = [];
    
    // User accepted without changes - positive signal
    for (const tab of tabs) {
      const category = categorization.categories[tab.id];
      const metadata = categorization.metadata?.[tab.id];
      
      if (category !== undefined) {
        feedback.push({
          type: 'acceptance',
          tab,
          category,
          metadata,
          timestamp: Date.now(),
          confidence: metadata?.confidence || 1.0
        });
      }
    }
    
    // Process feedback
    await this.processFeedbackBatch(feedback);
    
    // Record acceptance metric
    await recordMetric({
      method: 'user',
      type: 'acceptance',
      value: tabs.length,
      metadata: {
        distribution: this.getCategoryDistribution(feedback),
        averageConfidence: this.getAverageConfidence(feedback)
      }
    });
  }
  
  /**
   * Process user correction of a tab's category
   * @param {Object} tab - Tab object
   * @param {number} oldCategory - Original category
   * @param {number} newCategory - User's corrected category
   * @param {Object} metadata - Original categorization metadata
   */
  async processCorrection(tab, oldCategory, newCategory, metadata = {}) {
    const correction = {
      type: 'correction',
      tab,
      oldCategory,
      newCategory,
      metadata,
      timestamp: Date.now(),
      source: metadata.source || 'unknown'
    };
    
    // Update trust immediately
    if (metadata.decision) {
      await this.trustManager.updateTrust(metadata.decision, newCategory);
    }
    
    // Add to training data with higher priority
    await addTrainingData({
      url: tab.url,
      title: tab.title,
      category: newCategory,
      source: 'user_correction',
      corrected: true,
      metadata: {
        originalCategory: oldCategory,
        originalSource: metadata.source,
        correctionTime: Date.now()
      }
    });
    
    // Track correction patterns
    this.trackCorrectionPattern(tab, oldCategory, newCategory);
    
    // Add to learning queue
    this.learningQueue.push(correction);
    
    // Process if queue is large enough
    if (this.learningQueue.length >= ML_CONFIG.training.minExamplesPerClass) {
      await this.processLearningQueue();
    }
    
    // Record correction metric
    await recordMetric({
      method: 'user',
      type: 'correction',
      value: 1,
      metadata: {
        from: oldCategory,
        to: newCategory,
        source: metadata.source,
        url: tab.url
      }
    });
  }
  
  /**
   * Process tab close action as implicit feedback
   * @param {Object} tab - Tab object
   * @param {number} category - Tab's category when closed
   */
  async processTabClose(tab, category) {
    // Closing from "Ignore" category is positive signal
    if (category === 1) { // Ignore category
      await this.processFeedbackBatch([{
        type: 'implicit_positive',
        tab,
        category,
        timestamp: Date.now(),
        signal: 'closed_from_ignore'
      }]);
    }
  }
  
  /**
   * Process tab save action as implicit feedback
   * @param {Object} tab - Tab object
   * @param {number} category - Tab's category when saved
   */
  async processTabSave(tab, category) {
    // Saving is strong positive signal for the category
    await this.processFeedbackBatch([{
      type: 'implicit_positive',
      tab,
      category,
      timestamp: Date.now(),
      signal: 'saved',
      weight: 2.0 // Higher weight for save actions
    }]);
  }
  
  /**
   * Process batch of feedback
   * @param {Array} feedbackBatch - Array of feedback items
   */
  async processFeedbackBatch(feedbackBatch) {
    const trainingExamples = [];
    
    for (const feedback of feedbackBatch) {
      const weight = feedback.weight || 1.0;
      
      // Create training example
      const example = {
        url: feedback.tab.url,
        title: feedback.tab.title,
        category: feedback.category,
        source: feedback.type === 'correction' ? 'user_correction' : 'user_feedback',
        corrected: feedback.type === 'correction',
        metadata: {
          feedbackType: feedback.type,
          signal: feedback.signal,
          originalCategory: feedback.oldCategory,
          timestamp: feedback.timestamp
        }
      };
      
      // Add multiple times based on weight
      for (let i = 0; i < Math.round(weight); i++) {
        trainingExamples.push(example);
      }
    }
    
    // Add to training data
    for (const example of trainingExamples) {
      await addTrainingData(example);
    }
    
    // Update pending feedback
    this.pendingFeedback.push(...feedbackBatch);
  }
  
  /**
   * Track correction patterns to identify systematic issues
   */
  trackCorrectionPattern(tab, oldCategory, newCategory) {
    const pattern = `${oldCategory}->${newCategory}`;
    
    if (!this.correctionPatterns.has(pattern)) {
      this.correctionPatterns.set(pattern, {
        count: 0,
        examples: [],
        domains: new Set(),
        urlPatterns: new Set()
      });
    }
    
    const patternData = this.correctionPatterns.get(pattern);
    patternData.count++;
    patternData.examples.push({ url: tab.url, title: tab.title });
    
    // Extract domain
    try {
      const domain = new URL(tab.url).hostname;
      patternData.domains.add(domain);
    } catch (e) {
      // Invalid URL
    }
    
    // Look for URL patterns
    const urlPatterns = this.extractUrlPatterns(tab.url);
    urlPatterns.forEach(p => patternData.urlPatterns.add(p));
    
    // Keep only recent examples
    if (patternData.examples.length > 10) {
      patternData.examples.shift();
    }
  }
  
  /**
   * Extract patterns from URL
   */
  extractUrlPatterns(url) {
    const patterns = [];
    
    // Check for common patterns
    if (url.includes('/search')) patterns.push('search');
    if (url.includes('/login') || url.includes('/signin')) patterns.push('auth');
    if (url.includes('/checkout') || url.includes('/cart')) patterns.push('checkout');
    if (url.includes('/docs') || url.includes('/documentation')) patterns.push('docs');
    if (/\/\d{4}\/\d{2}\//.test(url)) patterns.push('date_path');
    if (/[a-f0-9]{8}-[a-f0-9]{4}/.test(url)) patterns.push('uuid');
    
    return patterns;
  }
  
  /**
   * Process learning queue
   */
  async processLearningQueue() {
    if (this.isProcessing || this.learningQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      const trainer = await getModelTrainer();
      
      // Convert queue to training examples
      const trainingExamples = this.learningQueue.map(item => ({
        url: item.tab.url,
        title: item.tab.title,
        category: item.newCategory,
        source: 'user_correction',
        corrected: true,
        metadata: {
          originalCategory: item.oldCategory,
          correctionTime: item.timestamp
        }
      }));
      
      // Trigger incremental training
      await trainer.incrementalTrain(trainingExamples, {
        epochs: 5,
        priority: 'high'
      });
      
      // Clear processed items
      this.learningQueue = [];
      
      console.log('Processed learning queue with', trainingExamples.length, 'examples');
      
    } catch (error) {
      console.error('Error processing learning queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Get feedback statistics
   */
  getStatistics() {
    const stats = {
      pendingFeedback: this.pendingFeedback.length,
      learningQueueSize: this.learningQueue.length,
      correctionPatterns: this.analyzeCorrectionPatterns(),
      feedbackDistribution: this.getFeedbackDistribution()
    };
    
    return stats;
  }
  
  /**
   * Analyze correction patterns
   */
  analyzeCorrectionPatterns() {
    const patterns = [];
    
    this.correctionPatterns.forEach((data, pattern) => {
      if (data.count >= 3) { // Significant pattern
        patterns.push({
          pattern,
          count: data.count,
          domains: Array.from(data.domains).slice(0, 5),
          urlPatterns: Array.from(data.urlPatterns),
          suggestion: this.generateRuleSuggestion(pattern, data)
        });
      }
    });
    
    // Sort by frequency
    patterns.sort((a, b) => b.count - a.count);
    
    return patterns;
  }
  
  /**
   * Generate rule suggestion from pattern
   */
  generateRuleSuggestion(pattern, data) {
    const [from, to] = pattern.split('->').map(Number);
    
    // Check if there's a dominant domain
    if (data.domains.size === 1) {
      const domain = Array.from(data.domains)[0];
      return {
        type: 'domain',
        value: domain,
        category: to,
        confidence: 0.9
      };
    }
    
    // Check for URL patterns
    if (data.urlPatterns.size > 0) {
      const mostCommon = Array.from(data.urlPatterns)[0];
      return {
        type: 'url_pattern',
        value: mostCommon,
        category: to,
        confidence: 0.7
      };
    }
    
    return null;
  }
  
  /**
   * Get feedback distribution
   */
  getFeedbackDistribution() {
    const distribution = {
      acceptance: 0,
      correction: 0,
      implicit_positive: 0
    };
    
    this.pendingFeedback.forEach(feedback => {
      distribution[feedback.type] = (distribution[feedback.type] || 0) + 1;
    });
    
    return distribution;
  }
  
  /**
   * Get category distribution from feedback
   */
  getCategoryDistribution(feedback) {
    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
    
    feedback.forEach(item => {
      if (item.category !== undefined) {
        distribution[item.category]++;
      }
    });
    
    return distribution;
  }
  
  /**
   * Get average confidence from feedback
   */
  getAverageConfidence(feedback) {
    const confidences = feedback
      .map(f => f.confidence)
      .filter(c => c !== undefined);
    
    if (confidences.length === 0) return 0;
    
    return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  }
  
  /**
   * Generate insights from feedback
   */
  generateInsights() {
    const insights = [];
    const patterns = this.analyzeCorrectionPatterns();
    
    // Check for systematic miscategorizations
    patterns.forEach(pattern => {
      if (pattern.count >= 5) {
        insights.push({
          type: 'systematic_error',
          message: `System frequently miscategorizes ${pattern.pattern}`,
          suggestion: pattern.suggestion,
          severity: 'high'
        });
      }
    });
    
    // Check feedback distribution
    const distribution = this.getFeedbackDistribution();
    const totalFeedback = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    
    if (totalFeedback > 0) {
      const correctionRate = distribution.correction / totalFeedback;
      
      if (correctionRate > 0.3) {
        insights.push({
          type: 'high_correction_rate',
          message: `High correction rate: ${(correctionRate * 100).toFixed(1)}%`,
          severity: 'medium'
        });
      }
    }
    
    return insights;
  }
}

// Export singleton
let processorInstance = null;

export function getFeedbackProcessor() {
  if (!processorInstance) {
    processorInstance = new FeedbackProcessor();
  }
  return processorInstance;
}

export default {
  FeedbackProcessor,
  getFeedbackProcessor
};