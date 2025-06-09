/*
 * AI Tab Manager - Model Trainer
 * Orchestrates model training with data management
 */

import { ML_CONFIG } from '../model-config.js';
import { getTabClassifier } from '../models/tab-classifier.js';
import { getTrainingData, addTrainingData, recordMetric } from '../storage/ml-database.js';
import { updateVocabulary } from '../features/vocabulary.js';
import DataGenerator from './data-generator.js';
import { validateTrainingData } from './validation.js';

/**
 * Model Trainer class
 */
export class ModelTrainer {
  constructor() {
    this.classifier = null;
    this.isTraining = false;
    this.trainingHistory = [];
    this.callbacks = {
      onProgress: null,
      onComplete: null,
      onError: null
    };
  }
  
  /**
   * Initialize trainer
   */
  async initialize() {
    this.classifier = await getTabClassifier();
  }
  
  /**
   * Prepare training data
   * @returns {Promise<Array>} Prepared training data
   */
  async prepareTrainingData() {
    // First try to get existing ML training data
    let allData = await getTrainingData();
    console.log(`Found ${allData.length} existing ML training examples`);
    
    // If we have very little ML data, import from saved tabs
    if (allData.length < 50) {
      console.log('Converting saved tabs to training data...');
      const convertedData = await this.convertSavedTabsToTrainingData();
      console.log(`Converted ${convertedData.length} saved tabs to training data`);
      
      // Add converted data to ML database
      for (const example of convertedData) {
        await addTrainingData(example);
      }
      
      // Reload all data
      allData = await getTrainingData();
      console.log(`Total training examples after conversion: ${allData.length}`);
    }
    
    return allData;
  }
  
  /**
   * Convert saved tabs from main database to ML training data
   * @returns {Promise<Array>} Converted training examples
   */
  async convertSavedTabsToTrainingData() {
    try {
      // Get saved tabs from main database
      const savedTabs = await window.tabDatabase.getAllSavedTabs();
      console.log(`Found ${savedTabs.length} saved tabs to convert`);
      
      // Filter out uncategorized tabs (category 0) and convert to training format
      const trainingData = savedTabs
        .filter(tab => tab.category && tab.category > 0) // Only categorized tabs
        .map(tab => ({
          url: tab.url,
          title: tab.title || '',
          category: tab.category,
          source: 'saved_tabs_import',
          corrected: false,
          metadata: {
            importedFrom: 'main_database',
            originalId: tab.id,
            importTime: Date.now()
          }
        }));
      
      console.log(`Converted ${trainingData.length} saved tabs (filtered out uncategorized)`);
      return trainingData;
    } catch (error) {
      console.error('Error converting saved tabs to training data:', error);
      return [];
    }
  }
  
  /**
   * Train model (alias for trainWithStoredData)
   * @param {Object} options - Training options
   * @returns {Promise<Object>} Training results
   */
  async trainModel(options = {}) {
    return this.trainWithStoredData(options);
  }
  
  /**
   * Train model with stored data
   * @param {Object} options - Training options
   * @returns {Promise<Object>} Training results
   */
  async trainWithStoredData(options = {}) {
    if (this.isTraining) {
      throw new Error('Training already in progress');
    }
    
    this.isTraining = true;
    const startTime = Date.now();
    
    try {
      // Load training data
      const allData = await getTrainingData();
      console.log(`Loaded ${allData.length} training examples`);
      
      // Validate data
      const validationResult = validateTrainingData(allData);
      if (!validationResult.isValid) {
        throw new Error(`Invalid training data: ${validationResult.errors.join(', ')}`);
      }
      
      // Update vocabulary with all data
      await updateVocabulary(allData);
      
      // Ensure classifier is initialized with updated vocabulary
      await this.classifier.initialize();
      
      // Prepare data for training
      const generator = new DataGenerator(allData);
      const { trainData, validData } = generator.splitData(
        options.validationSplit || ML_CONFIG.training.validationSplit
      );
      
      console.log(`Training with ${trainData.length} examples, validating with ${validData.length}`);
      
      // Check class balance
      const classDistribution = this.getClassDistribution(trainData);
      console.log('Class distribution:', classDistribution);
      
      // Balance classes if needed
      const balancedData = options.balanceClasses ? 
        generator.balanceClasses(trainData) : trainData;
      
      // Set up training callbacks
      const trainingCallbacks = {
        onProgress: (progress) => {
          if (this.callbacks.onProgress) {
            this.callbacks.onProgress({
              ...progress,
              elapsed: Date.now() - startTime
            });
          }
        },
        earlyStoppingCallback: async (epoch, logs) => {
          // Implement early stopping
          if (this.shouldStopEarly(epoch, logs)) {
            console.log('Early stopping triggered');
            return true;
          }
          return false;
        }
      };
      
      // Train the model
      const history = await this.classifier.train(balancedData, {
        ...options,
        ...trainingCallbacks
      });
      
      // Evaluate on validation data
      const evaluation = await this.classifier.evaluate(validData);
      
      // Save the model
      await this.classifier.save();
      
      // Record metrics
      await this.recordTrainingMetrics({
        accuracy: evaluation.accuracy,
        loss: evaluation.loss,
        trainingExamples: trainData.length,
        validationExamples: validData.length,
        duration: Date.now() - startTime,
        classDistribution,
        perClassMetrics: evaluation.perClassMetrics
      });
      
      // Update training history
      this.trainingHistory.push({
        timestamp: Date.now(),
        accuracy: evaluation.accuracy,
        loss: evaluation.loss,
        samples: trainData.length
      });
      
      const result = {
        success: true,
        history,
        evaluation,
        duration: Date.now() - startTime,
        modelSummary: this.classifier.getSummary()
      };
      
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete(result);
      }
      
      return result;
      
    } catch (error) {
      console.error('Training error:', error);
      
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      
      throw error;
      
    } finally {
      this.isTraining = false;
    }
  }
  
  /**
   * Incremental training with new examples
   * @param {Array} newExamples - New training examples
   * @param {Object} options - Training options
   * @returns {Promise<Object>} Training results
   */
  async incrementalTrain(newExamples, options = {}) {
    if (newExamples.length < ML_CONFIG.training.minExamplesPerClass) {
      console.log('Not enough new examples for incremental training');
      return null;
    }
    
    // Add new examples to storage
    for (const example of newExamples) {
      await addTrainingData(example);
    }
    
    // Update vocabulary
    await updateVocabulary(newExamples);
    
    // Use smaller epochs for incremental training
    const incrementalOptions = {
      ...options,
      epochs: options.epochs || ML_CONFIG.training.incrementalEpochs,
      batchSize: options.batchSize || ML_CONFIG.training.incrementalBatchSize
    };
    
    // Get recent training data for fine-tuning
    const recentData = await getTrainingData(1000); // Last 1000 examples
    const combinedData = [...recentData, ...newExamples];
    
    // Train with combined data
    return this.classifier.train(combinedData, incrementalOptions);
  }
  
  /**
   * Train from user corrections
   * @param {Array} corrections - User corrections
   * @returns {Promise<Object>} Training results
   */
  async trainFromCorrections(corrections) {
    // Convert corrections to training examples
    const trainingExamples = corrections.map(correction => ({
      url: correction.url,
      title: correction.title,
      category: correction.newCategory,
      source: 'user_correction',
      corrected: true,
      metadata: {
        originalCategory: correction.oldCategory,
        correctionTime: correction.timestamp
      }
    }));
    
    // Give higher weight to corrections
    const weightedExamples = [];
    trainingExamples.forEach(example => {
      // Add each correction multiple times to increase its weight
      for (let i = 0; i < 3; i++) {
        weightedExamples.push(example);
      }
    });
    
    return this.incrementalTrain(weightedExamples, {
      epochs: 5 // More epochs for corrections
    });
  }
  
  /**
   * Get class distribution
   */
  getClassDistribution(data) {
    const distribution = {};
    
    data.forEach(example => {
      distribution[example.category] = (distribution[example.category] || 0) + 1;
    });
    
    return distribution;
  }
  
  /**
   * Check if should stop training early
   */
  shouldStopEarly(epoch, logs) {
    if (epoch < ML_CONFIG.training.earlyStopping.patience) {
      return false;
    }
    
    const recentHistory = this.trainingHistory.slice(-ML_CONFIG.training.earlyStopping.patience);
    
    if (recentHistory.length < ML_CONFIG.training.earlyStopping.patience) {
      return false;
    }
    
    // Check if loss hasn't improved
    const minDelta = ML_CONFIG.training.earlyStopping.minDelta;
    let hasImproved = false;
    
    for (let i = 1; i < recentHistory.length; i++) {
      if (recentHistory[i].loss < recentHistory[i-1].loss - minDelta) {
        hasImproved = true;
        break;
      }
    }
    
    return !hasImproved;
  }
  
  /**
   * Record training metrics
   */
  async recordTrainingMetrics(metrics) {
    // Overall accuracy
    await recordMetric({
      method: 'model',
      type: 'accuracy',
      value: metrics.accuracy,
      metadata: metrics
    });
    
    // Per-class metrics
    for (const classMetric of metrics.perClassMetrics) {
      await recordMetric({
        method: 'model',
        type: `class_${classMetric.class}_f1`,
        value: classMetric.f1,
        metadata: classMetric
      });
    }
  }
  
  /**
   * Set training callbacks
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
  
  /**
   * Get training status
   */
  getStatus() {
    return {
      isTraining: this.isTraining,
      history: this.trainingHistory,
      lastTraining: this.trainingHistory[this.trainingHistory.length - 1] || null
    };
  }
  
  /**
   * Schedule automatic training
   */
  async scheduleAutoTraining() {
    const schedule = ML_CONFIG.backgroundTraining.schedule;
    
    // Check if we have enough new data
    const trainingData = await getTrainingData();
    if (trainingData.length < ML_CONFIG.training.minTrainingExamples) {
      console.log('Not enough data for training');
      return;
    }
    
    // Check last training time
    const lastTraining = this.trainingHistory[this.trainingHistory.length - 1];
    if (lastTraining) {
      const timeSinceLastTraining = Date.now() - lastTraining.timestamp;
      const scheduleInterval = this.getScheduleInterval(schedule);
      
      if (timeSinceLastTraining < scheduleInterval) {
        console.log('Too soon for scheduled training');
        return;
      }
    }
    
    // Start training
    console.log('Starting scheduled training');
    return this.trainWithStoredData({
      balanceClasses: true
    });
  }
  
  /**
   * Get schedule interval in milliseconds
   */
  getScheduleInterval(schedule) {
    const intervals = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000
    };
    
    return intervals[schedule] || intervals.daily;
  }
}

// Export singleton instance
let trainerInstance = null;

export async function getModelTrainer() {
  if (!trainerInstance) {
    trainerInstance = new ModelTrainer();
    await trainerInstance.initialize();
  }
  
  return trainerInstance;
}

export default {
  ModelTrainer,
  getModelTrainer
};