/*
 * AI Tab Manager - Performance Tracker
 * Tracks accuracy and performance metrics for all categorization methods
 */

import { ML_CONFIG } from '../model-config.js';
import { recordMetric, getMetrics, recordPrediction, updatePredictionCorrectness } from '../storage/ml-database.js';

/**
 * Performance Tracker for all categorization methods
 */
export class PerformanceTracker {
  constructor() {
    // Track predictions and outcomes
    this.predictions = {
      rules: { correct: 0, total: 0, recentAccuracy: [] },
      model: { correct: 0, total: 0, recentAccuracy: [] },
      llm: { correct: 0, total: 0, recentAccuracy: [] }
    };
    
    // Calculated accuracies (0-1)
    this.accuracy = {
      rules: ML_CONFIG.trust.initialWeights.rules,
      model: ML_CONFIG.trust.initialWeights.model,
      llm: ML_CONFIG.trust.initialWeights.llm
    };
    
    // Trust weights (normalized)
    this.trustWeights = { ...ML_CONFIG.trust.initialWeights };
    
    // Rolling window size
    this.windowSize = ML_CONFIG.trust.accuracyWindow;
    
    // Minimum predictions before adjusting trust
    this.minPredictions = ML_CONFIG.trust.minPredictionsForAdjustment;
    
    // Track prediction history
    this.predictionHistory = [];
    
    // Load historical data on init
    this.loadHistoricalMetrics();
  }
  
  /**
   * Load historical metrics from storage
   */
  async loadHistoricalMetrics() {
    try {
      // Load recent metrics for each method
      for (const method of ['rules', 'model', 'llm']) {
        const metrics = await getMetrics(method, 'accuracy', this.windowSize);
        
        if (metrics.length > 0) {
          // Calculate average accuracy from historical data
          const avgAccuracy = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
          this.accuracy[method] = avgAccuracy;
          
          // Update recent accuracy array
          this.predictions[method].recentAccuracy = metrics.map(m => m.value);
        }
      }
      
      // Recalculate trust weights based on loaded accuracies
      this.updateTrustWeights();
      
    } catch (error) {
      console.error('Error loading historical metrics:', error);
    }
  }
  
  /**
   * Record a prediction and its outcome
   * @param {Object} prediction - Prediction details
   * @param {string} finalCategory - Final category (after user confirmation)
   * @param {string} source - How final decision was made
   */
  async recordPrediction(prediction, finalCategory, source = 'user') {
    // Store prediction in database
    const predictionRecord = await recordPrediction({
      ...prediction,
      final: finalCategory,
      source,
      correct: null // Will be updated later
    });
    
    // Track what each method predicted
    for (const method of ['rules', 'model', 'llm']) {
      if (prediction[method] !== undefined && prediction[method] !== null) {
        const isCorrect = prediction[method] === finalCategory;
        
        // Update counters
        this.predictions[method].total++;
        if (isCorrect) {
          this.predictions[method].correct++;
        }
        
        // Update rolling window
        this.predictions[method].recentAccuracy.push(isCorrect ? 1 : 0);
        if (this.predictions[method].recentAccuracy.length > this.windowSize) {
          this.predictions[method].recentAccuracy.shift();
        }
        
        // Record metric
        await recordMetric({
          method,
          type: 'prediction',
          value: isCorrect ? 1 : 0,
          metadata: {
            predicted: prediction[method],
            actual: finalCategory,
            confidence: prediction[`${method}Confidence`] || null
          }
        });
      }
    }
    
    // Add to history
    this.predictionHistory.push({
      timestamp: Date.now(),
      prediction,
      finalCategory,
      source,
      predictionId: predictionRecord.id
    });
    
    // Update accuracies and trust weights
    this.updateAccuracies();
    this.updateTrustWeights();
  }
  
  /**
   * Update accuracy calculations for all methods
   */
  updateAccuracies() {
    for (const method of ['rules', 'model', 'llm']) {
      const methodData = this.predictions[method];
      
      // Skip if not enough data
      if (methodData.total < this.minPredictions) {
        continue;
      }
      
      // Calculate recent accuracy (from rolling window)
      const recentAccuracy = methodData.recentAccuracy.length > 0
        ? methodData.recentAccuracy.reduce((sum, val) => sum + val, 0) / methodData.recentAccuracy.length
        : 0;
      
      // Calculate all-time accuracy
      const allTimeAccuracy = methodData.total > 0
        ? methodData.correct / methodData.total
        : 0;
      
      // Weighted average (recent performance matters more)
      this.accuracy[method] = 0.7 * recentAccuracy + 0.3 * allTimeAccuracy;
      
      // Record updated accuracy
      recordMetric({
        method,
        type: 'accuracy',
        value: this.accuracy[method],
        metadata: {
          recentAccuracy,
          allTimeAccuracy,
          totalPredictions: methodData.total,
          windowSize: methodData.recentAccuracy.length
        }
      });
    }
  }
  
  /**
   * Update trust weights based on accuracies
   */
  updateTrustWeights() {
    const adjustmentConfig = ML_CONFIG.trust.adjustment;
    
    // Calculate raw weights based on accuracy
    let rawWeights = { ...this.accuracy };
    
    // Apply constraints
    for (const method of ['rules', 'model', 'llm']) {
      rawWeights[method] = Math.max(
        adjustmentConfig.minWeight,
        Math.min(adjustmentConfig.maxWeight, rawWeights[method])
      );
    }
    
    // Normalize weights to sum to 1
    const totalWeight = Object.values(rawWeights).reduce((sum, w) => sum + w, 0);
    
    if (totalWeight > 0) {
      for (const method of ['rules', 'model', 'llm']) {
        this.trustWeights[method] = rawWeights[method] / totalWeight;
      }
    }
    
    // Record trust weight update
    recordMetric({
      method: 'system',
      type: 'trust_weights',
      value: 1, // Dummy value
      metadata: this.trustWeights
    });
  }
  
  /**
   * Handle user correction of a prediction
   * @param {string} predictionId - ID of the prediction
   * @param {number} oldCategory - Original category
   * @param {number} newCategory - Corrected category
   */
  async handleCorrection(predictionId, oldCategory, newCategory) {
    // Find the prediction in history
    const historyItem = this.predictionHistory.find(h => h.predictionId === predictionId);
    
    if (!historyItem) {
      console.warn('Prediction not found in history:', predictionId);
      return;
    }
    
    // Update prediction correctness in database
    await updatePredictionCorrectness(predictionId, false);
    
    // Penalize methods that got it wrong
    for (const method of ['rules', 'model', 'llm']) {
      if (historyItem.prediction[method] === oldCategory) {
        // This method was wrong
        const penalty = ML_CONFIG.trust.adjustment.incorrectPredictionPenalty;
        
        // Update recent accuracy (add 0 for incorrect)
        this.predictions[method].recentAccuracy.push(0);
        if (this.predictions[method].recentAccuracy.length > this.windowSize) {
          this.predictions[method].recentAccuracy.shift();
        }
        
        // Immediate trust reduction
        this.accuracy[method] = Math.max(
          ML_CONFIG.trust.adjustment.minWeight,
          this.accuracy[method] - penalty
        );
      } else if (historyItem.prediction[method] === newCategory) {
        // This method was actually correct
        const boost = ML_CONFIG.trust.adjustment.correctPredictionBoost;
        
        // Update recent accuracy (add 1 for correct)
        this.predictions[method].recentAccuracy.push(1);
        if (this.predictions[method].recentAccuracy.length > this.windowSize) {
          this.predictions[method].recentAccuracy.shift();
        }
        
        // Immediate trust boost
        this.accuracy[method] = Math.min(
          ML_CONFIG.trust.adjustment.maxWeight,
          this.accuracy[method] + boost
        );
      }
    }
    
    // Update trust weights
    this.updateTrustWeights();
    
    // Record the correction
    await recordMetric({
      method: 'user',
      type: 'correction',
      value: 1,
      metadata: {
        predictionId,
        oldCategory,
        newCategory,
        originalPredictions: historyItem.prediction
      }
    });
  }
  
  /**
   * Get current trust weights
   * @returns {Object} Normalized trust weights
   */
  getTrustWeights() {
    return { ...this.trustWeights };
  }
  
  /**
   * Get metrics for all methods
   * @returns {Object} Metrics for each method
   */
  async getMetrics() {
    const metrics = {};
    
    for (const method of ['rules', 'model', 'llm']) {
      if (this.predictions[method]) {
        metrics[method] = {
          total: this.predictions[method].total,
          correct: this.predictions[method].correct,
          accuracy: this.accuracy[method]
        };
      }
    }
    
    return metrics;
  }
  
  /**
   * Get detailed statistics for a method
   * @param {string} method - Method name
   * @returns {Object} Detailed statistics
   */
  getMethodStats(method) {
    const methodData = this.predictions[method];
    
    return {
      accuracy: this.accuracy[method],
      trustWeight: this.trustWeights[method],
      totalPredictions: methodData.total,
      correctPredictions: methodData.correct,
      recentAccuracy: methodData.recentAccuracy.length > 0
        ? methodData.recentAccuracy.reduce((sum, val) => sum + val, 0) / methodData.recentAccuracy.length
        : 0,
      trend: this.calculateTrend(method),
      confidence: this.calculateConfidence(method)
    };
  }
  
  /**
   * Calculate accuracy trend
   * @param {string} method - Method name
   * @returns {string} Trend indicator
   */
  calculateTrend(method) {
    const recent = this.predictions[method].recentAccuracy;
    
    if (recent.length < 10) {
      return 'neutral';
    }
    
    // Compare first half vs second half
    const midpoint = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, midpoint);
    const secondHalf = recent.slice(midpoint);
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const difference = secondAvg - firstAvg;
    
    if (difference > 0.1) return 'improving';
    if (difference < -0.1) return 'declining';
    return 'stable';
  }
  
  /**
   * Calculate confidence in method
   * @param {string} method - Method name
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(method) {
    const methodData = this.predictions[method];
    
    // Low confidence if not enough predictions
    if (methodData.total < this.minPredictions) {
      return 0.3;
    }
    
    // Base confidence on consistency of recent predictions
    const recent = methodData.recentAccuracy;
    if (recent.length === 0) return 0.5;
    
    // Calculate variance
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
    
    // Lower variance = higher confidence
    const confidence = 1 - Math.min(1, variance * 2);
    
    return confidence;
  }
  
  /**
   * Get overall system statistics
   * @returns {Object} System-wide statistics
   */
  getSystemStats() {
    const stats = {
      methods: {},
      overall: {
        totalPredictions: 0,
        averageAccuracy: 0,
        bestMethod: null,
        worstMethod: null
      }
    };
    
    // Collect stats for each method
    let bestAccuracy = 0;
    let worstAccuracy = 1;
    
    for (const method of ['rules', 'model', 'llm']) {
      const methodStats = this.getMethodStats(method);
      stats.methods[method] = methodStats;
      
      stats.overall.totalPredictions += methodStats.totalPredictions;
      
      if (methodStats.accuracy > bestAccuracy) {
        bestAccuracy = methodStats.accuracy;
        stats.overall.bestMethod = method;
      }
      
      if (methodStats.accuracy < worstAccuracy) {
        worstAccuracy = methodStats.accuracy;
        stats.overall.worstMethod = method;
      }
    }
    
    // Calculate average accuracy
    stats.overall.averageAccuracy = Object.values(this.accuracy)
      .reduce((sum, acc) => sum + acc, 0) / 3;
    
    // Add insights
    stats.insights = this.generateInsights(stats);
    
    return stats;
  }
  
  /**
   * Generate insights from statistics
   * @param {Object} stats - System statistics
   * @returns {Array<string>} Insights
   */
  generateInsights(stats) {
    const insights = [];
    
    // Best performing method
    if (stats.overall.bestMethod) {
      const best = stats.methods[stats.overall.bestMethod];
      insights.push(`${stats.overall.bestMethod} is performing best with ${(best.accuracy * 100).toFixed(1)}% accuracy`);
    }
    
    // Model learning progress
    const modelStats = stats.methods.model;
    if (modelStats.trend === 'improving' && modelStats.totalPredictions > 50) {
      insights.push('ML model is improving as it learns from your behavior');
    }
    
    // Trust weight distribution
    const maxWeight = Math.max(...Object.values(this.trustWeights));
    if (maxWeight > 0.6) {
      const dominantMethod = Object.entries(this.trustWeights)
        .find(([_, weight]) => weight === maxWeight)[0];
      insights.push(`System is heavily relying on ${dominantMethod} (${(maxWeight * 100).toFixed(0)}% trust)`);
    }
    
    // Low accuracy warning
    if (stats.overall.averageAccuracy < 0.7) {
      insights.push('Overall accuracy is below 70% - consider reviewing categorization rules');
    }
    
    return insights;
  }
  
  /**
   * Reset all performance data to initial state
   */
  async reset() {
    // Reset predictions counters
    this.predictions = {
      rules: { correct: 0, total: 0, recentAccuracy: [] },
      model: { correct: 0, total: 0, recentAccuracy: [] },
      llm: { correct: 0, total: 0, recentAccuracy: [] }
    };
    
    // Reset accuracies to initial values
    this.accuracy = {
      rules: ML_CONFIG.trust.initialWeights.rules,
      model: ML_CONFIG.trust.initialWeights.model,
      llm: ML_CONFIG.trust.initialWeights.llm
    };
    
    // Reset trust weights to initial values
    this.trustWeights = { ...ML_CONFIG.trust.initialWeights };
    
    // Clear prediction history
    this.predictionHistory = [];
    
    console.log('Performance tracker reset to initial state');
  }

  /**
   * Export metrics for analysis
   * @returns {Object} Exportable metrics
   */
  async exportMetrics() {
    const recentMetrics = {
      rules: await getMetrics('rules', null, 100),
      model: await getMetrics('model', null, 100),
      llm: await getMetrics('llm', null, 100)
    };
    
    return {
      currentState: {
        accuracy: this.accuracy,
        trustWeights: this.trustWeights,
        predictions: this.predictions
      },
      history: this.predictionHistory.slice(-100),
      recentMetrics,
      systemStats: this.getSystemStats()
    };
  }
}

// Export singleton instance
let trackerInstance = null;

export function getPerformanceTracker() {
  if (!trackerInstance) {
    trackerInstance = new PerformanceTracker();
  }
  return trackerInstance;
}

export default {
  PerformanceTracker,
  getPerformanceTracker
};