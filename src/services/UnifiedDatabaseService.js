/*
 * AI Tab Manager - Unified Database Service
 * Wraps main database operations with ML data synchronization
 */

import { addTrainingData, recordPrediction, updatePredictionCorrectness } from '../ml/storage/ml-database.js';
import { getMLCategorizer } from '../ml/categorization/ml-categorizer.js';
import { getModelTrainer } from '../ml/training/trainer.js';
import { state } from '../modules/state-manager.js';

/**
 * Unified Database Service
 * Wraps database operations with automatic ML synchronization
 */
class UnifiedDatabaseService {
  constructor() {
    this.mainDatabase = null; // Will be window.tabDatabase
    this.mlEnabled = true;
    this.pendingRetraining = false;
    this.newDataCount = 0;
    this.RETRAIN_THRESHOLD = 50; // Retrain when 50 new examples accumulated
  }

  /**
   * Initialize the service
   */
  async initialize() {
    // Wait for main database to be available
    if (typeof window !== 'undefined' && window.tabDatabase) {
      this.mainDatabase = window.tabDatabase;
    } else {
      throw new Error('Main database not available');
    }
    
    this.mlEnabled = state.settings?.useML !== false;
  }

  /**
   * Save categorized tabs with ML synchronization
   * @param {Object} categorizedTabs - Tabs grouped by category
   * @param {Object} metadata - Save metadata
   * @param {Object} predictions - Optional: ML/rules/LLM predictions for accuracy tracking
   * @returns {Promise<Array>} Save results
   */
  async saveCategorizedTabs(categorizedTabs, metadata = {}, predictions = null) {
    try {
      // Save to main database first - check which method is available
      let saveResults;
      if (this.mainDatabase.saveTabs) {
        // New database_v2.js API
        saveResults = await this.mainDatabase.saveTabs(categorizedTabs, metadata);
      } else if (this.mainDatabase.saveCategorizedTabs) {
        // Old database.js API
        saveResults = await this.mainDatabase.saveCategorizedTabs(categorizedTabs);
      } else {
        throw new Error('No compatible save method found in database');
      }
      
      if (this.mlEnabled) {
        // Add to ML training data
        await this._syncToMLDatabase(categorizedTabs, metadata, 'categorization_save');
        
        // Record predictions for accuracy assessment if provided
        if (predictions) {
          await this._recordPredictionAccuracy(categorizedTabs, predictions);
        }
        
        // Check if we need background retraining
        this._checkRetrainingNeed();
      }
      
      return saveResults;
    } catch (error) {
      console.error('Error in saveCategorizedTabs:', error);
      throw error;
    }
  }

  /**
   * Save single tab (usually from manual categorization)
   * @param {Object} tabData - Tab data
   * @param {number} category - Category (1-3)
   * @param {Object} predictions - Optional: predictions for accuracy tracking
   * @returns {Promise<number>} Saved tab ID
   */
  async saveTab(tabData, category, predictions = null) {
    const categorizedTabs = { [category]: [tabData] };
    const metadata = { source: 'manual_categorization', savedAt: Date.now() };
    return this.saveCategorizedTabs(categorizedTabs, metadata, predictions);
  }

  /**
   * Update tab category (user correction)
   * @param {string} url - Tab URL
   * @param {number} oldCategory - Previous category
   * @param {number} newCategory - New category
   * @param {string} source - Source of change ('user_correction', 'import', etc.)
   * @returns {Promise<void>}
   */
  async updateTabCategory(url, oldCategory, newCategory, source = 'user_correction') {
    try {
      // Update main database
      if (this.mainDatabase.updateUrlCategory) {
        await this.mainDatabase.updateUrlCategory(url, newCategory);
      } else {
        // Fallback: get tab data and re-save
        const tabs = await this.mainDatabase.getAllSavedTabs();
        const tab = tabs.find(t => t.url === url);
        if (tab) {
          tab.category = newCategory;
          await this.mainDatabase.saveTabs({ [newCategory]: [tab] }, { 
            source: 'category_update',
            updatedAt: Date.now() 
          });
        }
      }

      if (this.mlEnabled && source === 'user_correction') {
        // Record as correction in ML database
        await this._recordUserCorrection(url, oldCategory, newCategory);
        
        // Process through ML categorizer for learning
        try {
          const mlCategorizer = await getMLCategorizer();
          const tab = await this._getTabData(url);
          if (tab) {
            await mlCategorizer.processCorrection({
              url: tab.url,
              title: tab.title,
              oldCategory,
              newCategory,
              timestamp: Date.now()
            });
          }
        } catch (mlError) {
          console.log('ML categorizer not available for correction processing:', mlError);
        }
      }
      
    } catch (error) {
      console.error('Error updating tab category:', error);
      throw error;
    }
  }

  /**
   * Delete tab(s) with ML cleanup
   * @param {string|Array<string>} urls - URL(s) to delete
   * @returns {Promise<void>}
   */
  async deleteTabs(urls) {
    const urlArray = Array.isArray(urls) ? urls : [urls];
    
    try {
      // Delete from main database
      for (const url of urlArray) {
        if (this.mainDatabase.deleteUrl) {
          await this.mainDatabase.deleteUrl(url);
        } else {
          // Fallback for older database versions
          await this.mainDatabase.deleteSavedTab(url);
        }
      }

      if (this.mlEnabled) {
        // Clean up ML data (mark as deleted rather than removing for training history)
        await this._cleanupMLData(urlArray);
      }
      
    } catch (error) {
      console.error('Error deleting tabs:', error);
      throw error;
    }
  }

  /**
   * Import tabs from CSV with ML sync
   * @param {string} csvContent - CSV content
   * @param {Object} settings - Import settings
   * @returns {Promise<Object>} Import results
   */
  async importFromCSV(csvContent, settings = {}) {
    try {
      // Use main database import with some modifications for ML sync
      // Import to main database
      const importResults = await this.mainDatabase.importFromCSV(csvContent, settings);
      
      if (this.mlEnabled && importResults.savedTabs) {
        // Convert import results to ML training data format
        const metadata = { 
          source: 'csv_import', 
          importedAt: Date.now(),
          importSettings: settings 
        };
        
        // Group imported tabs by category for ML sync
        const categorizedTabs = {};
        importResults.savedTabs.forEach(tab => {
          if (!categorizedTabs[tab.category]) {
            categorizedTabs[tab.category] = [];
          }
          categorizedTabs[tab.category].push(tab);
        });
        
        await this._syncToMLDatabase(categorizedTabs, metadata, 'csv_import');
        this._checkRetrainingNeed();
      }
      
      return importResults;
    } catch (error) {
      console.error('Error in CSV import:', error);
      throw error;
    }
  }

  /**
   * Get ML prediction for new tab
   * @param {Object} tabData - Tab data (url, title)
   * @returns {Promise<Object>} Prediction result
   */
  async getMLPrediction(tabData) {
    if (!this.mlEnabled) {
      return { category: null, confidence: 0, source: 'ml_disabled' };
    }

    try {
      const mlCategorizer = await getMLCategorizer();
      const prediction = await mlCategorizer.categorize([tabData]);
      
      if (prediction && prediction.length > 0) {
        const result = prediction[0];
        
        // Record prediction for accuracy tracking
        await recordPrediction({
          url: tabData.url,
          title: tabData.title,
          prediction: result.category,
          confidence: result.confidence,
          method: 'ml_model',
          timestamp: Date.now()
        });
        
        return {
          category: result.category,
          confidence: result.confidence,
          source: 'ml_model',
          predictionId: result.predictionId
        };
      }
    } catch (error) {
      console.log('ML prediction failed:', error);
    }
    
    return { category: null, confidence: 0, source: 'ml_error' };
  }

  /**
   * Get count of available training data
   * @returns {Promise<number>}
   */
  async getTrainingDataCount() {
    try {
      // Count all categorized tabs that can be used for training
      const allSavedTabs = await this.mainDatabase.getAllSavedTabs();
      const validTrainingData = allSavedTabs.filter(tab => 
        tab.category && tab.category > 0 && tab.url && tab.title
      );
      return validTrainingData.length;
    } catch (error) {
      console.error('Error getting training data count:', error);
      return 0;
    }
  }

  /**
   * Trigger background model retraining
   * @param {boolean} force - Force retraining even if threshold not met
   * @returns {Promise<void>}
   */
  async triggerRetraining(force = false) {
    if (!this.mlEnabled || (this.pendingRetraining && !force)) {
      return;
    }

    try {
      this.pendingRetraining = true;
      console.log('Starting background model retraining...');
      
      const trainer = await getModelTrainer();
      await trainer.trainModel({ 
        backgroundTraining: true,
        maxTrainingTime: 30000 // 30 second limit
      });
      
      this.newDataCount = 0;
      console.log('Background retraining completed');
      
    } catch (error) {
      console.error('Background retraining failed:', error);
    } finally {
      this.pendingRetraining = false;
    }
  }

  /**
   * Sync all existing saved tabs to ML database (one-time migration)
   * @returns {Promise<void>}
   */
  async syncExistingSavedTabs() {
    if (!this.mlEnabled) {
      console.log('ML disabled, skipping sync of existing saved tabs');
      return;
    }

    try {
      // Get all saved tabs
      const savedTabs = await this.mainDatabase.getAllSavedTabs();
      
      // Group by category
      const categorizedTabs = {};
      savedTabs.forEach(tab => {
        if (tab.category && tab.category >= 1 && tab.category <= 3) {
          if (!categorizedTabs[tab.category]) {
            categorizedTabs[tab.category] = [];
          }
          categorizedTabs[tab.category].push(tab);
        }
      });
      
      // Sync to ML database
      await this._syncToMLDatabase(categorizedTabs, {
        source: 'existing_saved_tabs_sync',
        syncedAt: Date.now()
      }, 'migration_sync');
      
    } catch (error) {
      console.error('Error syncing existing saved tabs:', error);
    }
  }

  // --- Private Methods ---

  /**
   * Sync categorized tabs to ML database
   * @private
   */
  async _syncToMLDatabase(categorizedTabs, metadata, source) {
    try {
      // Convert categorized tabs to ML training format
      const trainingData = [];
      
      // Handle all categories if they exist
      Object.keys(categorizedTabs).forEach(category => {
        const categoryNum = parseInt(category);
        if (categorizedTabs[categoryNum] && categoryNum >= 1 && categoryNum <= 3) {
          categorizedTabs[categoryNum].forEach(tab => {
            trainingData.push({
              url: tab.url,
              title: tab.title || '',
              category: categoryNum,
              source: source,
              corrected: false,
              metadata: {
                ...metadata,
                addedToML: Date.now()
              }
            });
          });
        }
      });
      
      // Add to ML database
      for (const data of trainingData) {
        await addTrainingData(data);
        this.newDataCount++;
      }
      
    } catch (error) {
      console.error('Error syncing to ML database:', error);
    }
  }

  /**
   * Record prediction accuracy
   * @private
   */
  async _recordPredictionAccuracy(categorizedTabs, predictions) {
    try {
      // Compare predictions with actual user choices
      [1, 2, 3].forEach(category => {
        if (categorizedTabs[category]) {
          categorizedTabs[category].forEach(tab => {
            const prediction = predictions[tab.url];
            if (prediction) {
              // Record accuracy for each prediction method
              ['rules', 'ml_model', 'llm'].forEach(method => {
                if (prediction[method]) {
                  const isCorrect = prediction[method].category === category;
                  updatePredictionCorrectness(prediction[method].predictionId, isCorrect);
                }
              });
            }
          });
        }
      });
    } catch (error) {
      console.error('Error recording prediction accuracy:', error);
    }
  }

  /**
   * Record user correction
   * @private
   */
  async _recordUserCorrection(url, oldCategory, newCategory) {
    try {
      const tab = await this._getTabData(url);
      if (tab) {
        await addTrainingData({
          url: tab.url,
          title: tab.title,
          category: newCategory,
          source: 'user_correction',
          corrected: true,
          metadata: {
            originalCategory: oldCategory,
            correctionTime: Date.now()
          }
        });
        this.newDataCount++;
      }
    } catch (error) {
      console.error('Error recording user correction:', error);
    }
  }

  /**
   * Get tab data by URL
   * @private
   */
  async _getTabData(url) {
    try {
      const tabs = await this.mainDatabase.getAllSavedTabs();
      return tabs.find(tab => tab.url === url);
    } catch (error) {
      console.error('Error getting tab data:', error);
      return null;
    }
  }

  /**
   * Cleanup ML data for deleted tabs
   * @private
   */
  async _cleanupMLData(urls) {
    try {
      // Mark as deleted in ML database rather than removing
      // This preserves training history while indicating the tab was deleted
      for (const url of urls) {
        await addTrainingData({
          url: url,
          title: '',
          category: 0, // Special category for deleted
          source: 'tab_deleted',
          corrected: false,
          metadata: {
            deletedAt: Date.now()
          }
        });
      }
    } catch (error) {
      console.error('Error cleaning up ML data:', error);
    }
  }

  /**
   * Check if retraining is needed
   * @private
   */
  _checkRetrainingNeed() {
    if (this.newDataCount >= this.RETRAIN_THRESHOLD && !this.pendingRetraining) {
      console.log(`Retraining threshold reached (${this.newDataCount} new examples)`);
      // Schedule retraining in background
      setTimeout(() => this.triggerRetraining(), 5000); // 5 second delay
    }
  }
}

// Create singleton instance
let unifiedDatabaseInstance = null;

export async function getUnifiedDatabase() {
  if (!unifiedDatabaseInstance) {
    unifiedDatabaseInstance = new UnifiedDatabaseService();
    await unifiedDatabaseInstance.initialize();
  }
  return unifiedDatabaseInstance;
}

export default {
  getUnifiedDatabase,
  UnifiedDatabaseService
};