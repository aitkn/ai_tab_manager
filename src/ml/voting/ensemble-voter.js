/*
 * AI Tab Manager - Ensemble Voter
 * Implements weighted voting system for combining predictions
 */

import { getTrustManager } from '../trust/trust-manager.js';
import { ML_CONFIG } from '../model-config.js';

/**
 * Ensemble Voter for combining predictions from multiple methods
 */
export class EnsembleVoter {
  constructor() {
    this.trustManager = getTrustManager();
    this.votingHistory = [];
  }
  
  /**
   * Vote on tab categories using all available methods
   * @param {Object} allPredictions - Predictions from all methods
   * @returns {Object} Final categorizations with metadata
   */
  async vote(allPredictions) {
    const { rules, model, llm } = allPredictions;
    const results = {};
    const metadata = {};
    
    // Get current trust weights
    const trustWeights = this.trustManager.getTrustWeights();
    
    // Process each tab
    const tabIds = this.getAllTabIds(allPredictions);
    
    for (const tabId of tabIds) {
      // Gather predictions for this tab
      const predictions = {
        rules: rules?.[tabId]?.category,
        model: model?.[tabId]?.category,
        llm: llm?.[tabId]?.category
      };
      
      // Gather confidence scores
      const confidences = {
        rules: rules?.[tabId]?.confidence || 1.0, // Rules are deterministic
        model: model?.[tabId]?.confidence || 0.5,
        llm: llm?.[tabId]?.confidence || 0.8
      };
      
      // Make decision using trust manager
      const decision = await this.trustManager.makeDecision(predictions, confidences);
      
      // Store result
      results[tabId] = decision.category;
      
      // Store metadata for transparency
      metadata[tabId] = {
        ...decision,
        predictions,
        confidences,
        trustWeights: { ...trustWeights }
      };
    }
    
    // Record voting session
    this.recordVotingSession(results, metadata);
    
    return {
      categories: results,
      metadata,
      summary: this.generateSummary(results, metadata)
    };
  }
  
  /**
   * Get all unique tab IDs from predictions
   */
  getAllTabIds(allPredictions) {
    const tabIds = new Set();
    
    Object.values(allPredictions).forEach(methodPredictions => {
      if (methodPredictions) {
        Object.keys(methodPredictions).forEach(tabId => tabIds.add(tabId));
      }
    });
    
    return Array.from(tabIds);
  }
  
  /**
   * Perform simple majority voting (for comparison)
   * @param {Object} predictions - Predictions from each method
   * @returns {number} Winning category
   */
  majorityVote(predictions) {
    const votes = {};
    
    Object.values(predictions).forEach(category => {
      if (category !== undefined && category !== null) {
        votes[category] = (votes[category] || 0) + 1;
      }
    });
    
    // Find category with most votes
    let maxVotes = 0;
    let winner = 2; // Default to Useful
    
    Object.entries(votes).forEach(([category, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        winner = parseInt(category);
      }
    });
    
    return winner;
  }
  
  /**
   * Calculate agreement between methods
   * @param {Object} predictions - Predictions from each method
   * @returns {number} Agreement score (0-1)
   */
  calculateAgreement(predictions) {
    const values = Object.values(predictions).filter(v => v !== undefined && v !== null);
    
    if (values.length <= 1) return 1.0;
    
    const uniqueValues = new Set(values);
    return 1 - (uniqueValues.size - 1) / (values.length - 1);
  }
  
  /**
   * Resolve conflicts between predictions
   * @param {Object} predictions - Predictions from each method
   * @param {Object} confidences - Confidence scores
   * @param {string} strategy - Conflict resolution strategy
   * @returns {Object} Resolved decision
   */
  resolveConflict(predictions, confidences, strategy = 'highest_confidence') {
    switch (strategy) {
      case 'highest_confidence':
        return this.highestConfidenceResolution(predictions, confidences);
        
      case 'trust_weighted':
        return this.trustWeightedResolution(predictions, confidences);
        
      case 'conservative':
        return this.conservativeResolution(predictions);
        
      case 'aggressive':
        return this.aggressiveResolution(predictions);
        
      default:
        return this.highestConfidenceResolution(predictions, confidences);
    }
  }
  
  /**
   * Resolve by highest confidence
   */
  highestConfidenceResolution(predictions, confidences) {
    let bestMethod = null;
    let bestConfidence = 0;
    let bestCategory = 2; // Default
    
    Object.entries(predictions).forEach(([method, category]) => {
      if (category !== undefined && category !== null) {
        const confidence = confidences[method] || 0;
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMethod = method;
          bestCategory = category;
        }
      }
    });
    
    return {
      category: bestCategory,
      source: bestMethod || 'default',
      confidence: bestConfidence,
      reasoning: `Highest confidence from ${bestMethod}`
    };
  }
  
  /**
   * Resolve using trust weights
   */
  trustWeightedResolution(predictions, confidences) {
    const trustWeights = this.trustManager.getTrustWeights();
    let bestScore = 0;
    let bestMethod = null;
    let bestCategory = 2;
    
    Object.entries(predictions).forEach(([method, category]) => {
      if (category !== undefined && category !== null) {
        const confidence = confidences[method] || 1.0;
        const trust = trustWeights[method] || 0.33;
        const score = confidence * trust;
        
        if (score > bestScore) {
          bestScore = score;
          bestMethod = method;
          bestCategory = category;
        }
      }
    });
    
    return {
      category: bestCategory,
      source: bestMethod || 'default',
      confidence: bestScore,
      reasoning: `Trust-weighted decision from ${bestMethod}`
    };
  }
  
  /**
   * Conservative resolution - prefer safer categories
   */
  conservativeResolution(predictions) {
    // Priority order: Important > Useful > Ignore
    const priority = [3, 2, 1, 0];
    
    for (const targetCategory of priority) {
      const methods = Object.entries(predictions)
        .filter(([_, cat]) => cat === targetCategory)
        .map(([method, _]) => method);
      
      if (methods.length > 0) {
        return {
          category: targetCategory,
          source: methods.join('+'),
          confidence: 0.7,
          reasoning: `Conservative choice: ${this.getCategoryName(targetCategory)}`
        };
      }
    }
    
    return {
      category: 2,
      source: 'default',
      confidence: 0.5,
      reasoning: 'Conservative default to Useful'
    };
  }
  
  /**
   * Aggressive resolution - prefer action categories
   */
  aggressiveResolution(predictions) {
    // Priority order: Ignore > Important > Useful
    const priority = [1, 3, 2, 0];
    
    for (const targetCategory of priority) {
      const methods = Object.entries(predictions)
        .filter(([_, cat]) => cat === targetCategory)
        .map(([method, _]) => method);
      
      if (methods.length > 0) {
        return {
          category: targetCategory,
          source: methods.join('+'),
          confidence: 0.7,
          reasoning: `Aggressive choice: ${this.getCategoryName(targetCategory)}`
        };
      }
    }
    
    return {
      category: 1,
      source: 'default',
      confidence: 0.5,
      reasoning: 'Aggressive default to Ignore'
    };
  }
  
  /**
   * Get category name
   */
  getCategoryName(category) {
    const names = ['Uncategorized', 'Ignore', 'Useful', 'Important'];
    return names[category] || 'Unknown';
  }
  
  /**
   * Record voting session for analysis
   */
  recordVotingSession(results, metadata) {
    const session = {
      timestamp: Date.now(),
      tabCount: Object.keys(results).length,
      distribution: this.calculateDistribution(results),
      agreementStats: this.calculateAgreementStats(metadata),
      strategyUsed: metadata[Object.keys(metadata)[0]]?.strategy || 'unknown'
    };
    
    this.votingHistory.push(session);
    
    // Keep only recent history
    if (this.votingHistory.length > 100) {
      this.votingHistory.shift();
    }
  }
  
  /**
   * Calculate category distribution
   */
  calculateDistribution(results) {
    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
    
    Object.values(results).forEach(category => {
      distribution[category] = (distribution[category] || 0) + 1;
    });
    
    return distribution;
  }
  
  /**
   * Calculate agreement statistics
   */
  calculateAgreementStats(metadata) {
    let totalAgreement = 0;
    let count = 0;
    
    Object.values(metadata).forEach(meta => {
      if (meta.predictions) {
        const agreement = this.calculateAgreement(meta.predictions);
        totalAgreement += agreement;
        count++;
      }
    });
    
    return {
      averageAgreement: count > 0 ? totalAgreement / count : 0,
      perfectAgreement: Object.values(metadata).filter(meta => 
        this.calculateAgreement(meta.predictions || {}) === 1.0
      ).length,
      totalDisagreement: Object.values(metadata).filter(meta => 
        this.calculateAgreement(meta.predictions || {}) === 0
      ).length
    };
  }
  
  /**
   * Generate voting summary
   */
  generateSummary(results, metadata) {
    const distribution = this.calculateDistribution(results);
    const agreementStats = this.calculateAgreementStats(metadata);
    
    // Count decision sources
    const sources = {};
    Object.values(metadata).forEach(meta => {
      const source = meta.source || 'unknown';
      sources[source] = (sources[source] || 0) + 1;
    });
    
    return {
      totalTabs: Object.keys(results).length,
      distribution,
      agreementStats,
      decisionSources: sources,
      dominantSource: Object.entries(sources)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none',
      averageConfidence: Object.values(metadata)
        .reduce((sum, m) => sum + (m.confidence || 0), 0) / Object.keys(metadata).length
    };
  }
  
  /**
   * Get voting statistics
   */
  getStatistics() {
    if (this.votingHistory.length === 0) {
      return { message: 'No voting history available' };
    }
    
    const recentSessions = this.votingHistory.slice(-10);
    
    return {
      totalSessions: this.votingHistory.length,
      recentSessions,
      averageTabsPerSession: this.votingHistory
        .reduce((sum, s) => sum + s.tabCount, 0) / this.votingHistory.length,
      averageAgreement: recentSessions
        .reduce((sum, s) => sum + s.agreementStats.averageAgreement, 0) / recentSessions.length,
      strategyDistribution: this.getStrategyDistribution()
    };
  }
  
  /**
   * Get distribution of strategies used
   */
  getStrategyDistribution() {
    const strategies = {};
    
    this.votingHistory.forEach(session => {
      const strategy = session.strategyUsed;
      strategies[strategy] = (strategies[strategy] || 0) + 1;
    });
    
    return strategies;
  }
}

// Export singleton
let voterInstance = null;

export function getEnsembleVoter() {
  if (!voterInstance) {
    voterInstance = new EnsembleVoter();
  }
  return voterInstance;
}

export default {
  EnsembleVoter,
  getEnsembleVoter
};