/*
 * AI Tab Manager - Background ML Service
 * Handles background ML operations and retraining
 */

import { getUnifiedDatabase } from './UnifiedDatabaseService.js';
import { state } from '../modules/state-manager.js';

/**
 * Background ML Service
 * Manages ML operations that run in background
 */
class BackgroundMLService {
  constructor() {
    this.isInitialized = false;
    this.retrainingInProgress = false;
    this.lastRetrainingCheck = 0;
    this.CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
    this.intervalId = null;
  }

  /**
   * Initialize the background service
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Check if ML is enabled
      if (state.settings?.useML === false) {
        return;
      }
      
      // Start periodic checks
      this.startPeriodicChecks();
      
      // Run initial check after a delay to let the app finish loading
      setTimeout(() => this.checkRetrainingNeed(), 10000); // 10 second delay
      
      this.isInitialized = true;
      
    } catch (error) {
      console.error('Error initializing Background ML Service:', error);
    }
  }

  /**
   * Start periodic retraining checks
   */
  startPeriodicChecks() {
    if (this.intervalId) return; // Already running
    
    this.intervalId = setInterval(() => {
      this.checkRetrainingNeed();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop periodic checks
   */
  stopPeriodicChecks() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check if model retraining is needed
   */
  async checkRetrainingNeed() {
    if (this.retrainingInProgress) {
      return;
    }

    try {
      // Throttle checks
      const now = Date.now();
      if (now - this.lastRetrainingCheck < this.CHECK_INTERVAL) {
        return;
      }
      this.lastRetrainingCheck = now;

      // Check if we have enough new training data
      const unifiedDB = await getUnifiedDatabase();
      
      // Simple heuristic: check if we have new data since last training
      const { getTrainingData } = await import('../ml/storage/ml-database.js');
      const recentData = await getTrainingData(100); // Get last 100 examples
      
      if (!recentData || recentData.length < 20) {
        return;
      }

      // Check if there's new data from the last 24 hours
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const recentNewData = recentData.filter(item => {
        return item.metadata?.addedToML && item.metadata.addedToML > oneDayAgo;
      });

      if (recentNewData.length >= 10) {
        await this.triggerBackgroundRetraining();
      }

    } catch (error) {
      console.error('Error checking retraining need:', error);
    }
  }

  /**
   * Trigger background model retraining
   */
  async triggerBackgroundRetraining() {
    if (this.retrainingInProgress) {
      return;
    }

    try {
      this.retrainingInProgress = true;

      const unifiedDB = await getUnifiedDatabase();
      
      // Check if we have enough data before attempting training
      const trainingDataCount = await unifiedDB.getTrainingDataCount();
      if (trainingDataCount < 100) {
        console.log(`Background training skipped: Only ${trainingDataCount} examples (minimum: 100)`);
        return;
      }
      
      await unifiedDB.triggerRetraining(false);

    } catch (error) {
      console.error('Background model retraining failed:', error);
    } finally {
      this.retrainingInProgress = false;
    }
  }

  /**
   * Force immediate retraining (called manually)
   */
  async forceRetraining() {
    try {
      const unifiedDB = await getUnifiedDatabase();
      await unifiedDB.triggerRetraining(true);
      
      return true;
      
    } catch (error) {
      console.error('Forced retraining failed:', error);
      return false;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      retrainingInProgress: this.retrainingInProgress,
      lastRetrainingCheck: this.lastRetrainingCheck,
      checkInterval: this.CHECK_INTERVAL,
      isRunning: !!this.intervalId
    };
  }

  /**
   * Update settings and restart if needed
   */
  async updateSettings(newSettings) {
    const mlWasEnabled = state.settings?.useML !== false;
    const mlIsEnabled = newSettings?.useML !== false;
    
    if (mlWasEnabled && !mlIsEnabled) {
      this.stopPeriodicChecks();
    } else if (!mlWasEnabled && mlIsEnabled) {
      await this.initialize();
    }
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy() {
    this.stopPeriodicChecks();
    this.isInitialized = false;
    this.retrainingInProgress = false;
  }
}

// Create singleton instance
let backgroundMLServiceInstance = null;

export async function getBackgroundMLService() {
  if (!backgroundMLServiceInstance) {
    backgroundMLServiceInstance = new BackgroundMLService();
    await backgroundMLServiceInstance.initialize();
  }
  return backgroundMLServiceInstance;
}

export default {
  getBackgroundMLService,
  BackgroundMLService
};