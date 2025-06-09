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
import { state } from '../../modules/state-manager.js';

/**
 * Get epochs from user settings or fall back to config default
 */
function getEpochsFromSettings(options = {}) {
  if (options.epochs && options.epochs > 0) {
    return options.epochs; // Use provided epochs
  }
  
  // Use user settings if available
  if (state && state.settings && state.settings.mlEpochs) {
    return state.settings.mlEpochs;
  }
  
  // Fall back to config default
  return ML_CONFIG.training.epochs;
}

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
   * Prepare training data - directly from saved tabs + user corrections
   * @returns {Promise<Array>} Prepared training data
   */
  async prepareTrainingData() {
    // Get saved tabs (the source of truth)
    const savedTabsData = await this.convertSavedTabsToTrainingData();
    
    // Get additional ML training data (user corrections, feedback)
    const mlData = await getTrainingData();
    const correctionsData = mlData.filter(item => 
      item.source === 'user_correction' || 
      item.source === 'user_feedback'
    );
    // Combine saved tabs + corrections (saved tabs are primary source)
    const allData = [...savedTabsData, ...correctionsData];
    
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
   * Train model with provided data (avoids duplicate data preparation)
   * @param {Array} trainingData - Pre-prepared training data
   * @param {Object} options - Training options
   * @returns {Promise<Object>} Training results
   */
  async trainWithData(trainingData, options = {}) {
    if (this.isTraining) {
      throw new Error('Training already in progress');
    }
    
    this.isTraining = true;
    const startTime = Date.now();
    
    try {
      // Validate data
      const validationResult = validateTrainingData(trainingData);
      if (!validationResult.isValid) {
        throw new Error(`Invalid training data: ${validationResult.errors.join(', ')}`);
      }
      
      // Update vocabulary with all data
      await updateVocabulary(trainingData);
      
      // Ensure classifier is initialized with updated vocabulary
      await this.classifier.initialize();
      
      // Prepare data for training
      const generator = new DataGenerator(trainingData);
      const { trainData, validData } = generator.splitData(
        options.validationSplit || ML_CONFIG.training.validationSplit
      );
      
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
      
      // Train the model with epochs from settings
      const epochs = getEpochsFromSettings(options);
      const history = await this.classifier.train(balancedData, {
        ...options,
        epochs: epochs,
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
        modelSummary: this.classifier.getSummary(),
        accuracy: evaluation.accuracy
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
      // Load training data using our prepared method
      const allData = await this.prepareTrainingData();
      
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
      
      // Train the model with epochs from settings
      const epochs = getEpochsFromSettings(options);
      const history = await this.classifier.train(balancedData, {
        ...options,
        epochs: epochs,
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
   * Incremental training - continues training existing model
   * @param {Array} trainingData - All available training data
   * @param {Object} options - Training options
   * @returns {Promise<Object>} Training results
   */
  async incrementalTrain(trainingData, options = {}) {
    if (this.isTraining) {
      throw new Error('Training already in progress');
    }
    
    this.isTraining = true;
    const startTime = Date.now();
    
    try {
      // Validate data
      const validationResult = validateTrainingData(trainingData);
      if (!validationResult.isValid) {
        throw new Error(`Invalid training data: ${validationResult.errors.join(', ')}`);
      }
      
      // Update vocabulary with all data
      await updateVocabulary(trainingData);
      
      // Continue training from existing model with accumulated data
      const incrementalOptions = {
        ...options,
        epochs: getEpochsFromSettings(options),
        learningRate: (options.learningRate || ML_CONFIG.training.learningRate) * 0.1, // 10x lower learning rate
        batchSize: options.batchSize || ML_CONFIG.training.incrementalBatchSize
      };
      
      // Set up training callbacks
      const trainingCallbacks = {
        onProgress: (progress) => {
          if (this.callbacks.onProgress) {
            this.callbacks.onProgress({
              ...progress,
              elapsed: Date.now() - startTime
            });
          }
        }
      };
      
      // Prepare data for incremental training
      const generator = new DataGenerator(trainingData);
      const { trainData, validData } = generator.splitData(0.2);
      
      // Prepare training tensors for incremental training
      const { xs, ys } = this.classifier.prepareTrainingData(trainData);
      
      // Get TensorFlow for optimizer with lower learning rate
      const tf = await import('../tensorflow-loader.js').then(module => module.getTensorFlow());
      
      // Create optimizer with lower learning rate for fine-tuning
      const optimizer = tf.train.adam(incrementalOptions.learningRate);
      
      let history;
      try {
        // Continue training the existing model using fit() with custom optimizer
        history = await this.classifier.model.fit(xs, ys, {
        epochs: incrementalOptions.epochs,
        batchSize: incrementalOptions.batchSize,
        validationSplit: 0.2,
        shuffle: true,
        verbose: 0,
        optimizer: optimizer,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            if (this.callbacks.onProgress) {
              this.callbacks.onProgress({
                epoch: epoch + 1,
                totalEpochs: incrementalOptions.epochs,
                progress: (epoch + 1) / incrementalOptions.epochs,
                loss: logs.loss,
                accuracy: logs.acc || logs.accuracy
              });
            }
          }
        }
      });
      
      } catch (webglError) {
        console.error('WebGL training error:', webglError);
        
        // Check if it's a stack overflow or WebGL-specific error
        if (webglError.message && (webglError.message.includes('Maximum call stack') || 
                                   webglError.message.includes('WebGL') ||
                                   webglError.name === 'RangeError')) {
          console.log('WebGL error detected, attempting CPU fallback for training...');
          
          // Dispose current tensors to free GPU memory
          if (Array.isArray(xs)) {
            xs.forEach(tensor => tensor && typeof tensor.dispose === 'function' && tensor.dispose());
          }
          if (ys && typeof ys.dispose === 'function') ys.dispose();
          if (optimizer && typeof optimizer.dispose === 'function') optimizer.dispose();
          
          // Switch to CPU temporarily
          const { switchBackend } = await import('../tensorflow-loader.js');
          await switchBackend('cpu');
          
          // Recreate tensors and optimizer for CPU
          const { xs: cpuXs, ys: cpuYs } = this.classifier.prepareTrainingData(trainData);
          const cpuOptimizer = tf.train.adam(incrementalOptions.learningRate);
          
          // Retry training on CPU
          history = await this.classifier.model.fit(cpuXs, cpuYs, {
            epochs: incrementalOptions.epochs,
            batchSize: incrementalOptions.batchSize,
            validationSplit: 0.2,
            shuffle: true,
            verbose: 0,
            optimizer: cpuOptimizer,
            callbacks: {
              onEpochEnd: async (epoch, logs) => {
                if (this.callbacks.onProgress) {
                  this.callbacks.onProgress({
                    epoch: epoch + 1,
                    totalEpochs: incrementalOptions.epochs,
                    progress: (epoch + 1) / incrementalOptions.epochs,
                    loss: logs.loss,
                    accuracy: logs.acc || logs.accuracy
                  });
                }
              }
            }
          });
          
          // Clean up CPU tensors
          cpuXs.forEach(tensor => tensor && typeof tensor.dispose === 'function' && tensor.dispose());
          if (cpuYs && typeof cpuYs.dispose === 'function') cpuYs.dispose();
          if (cpuOptimizer && typeof cpuOptimizer.dispose === 'function') cpuOptimizer.dispose();
          
          // Switch back to GPU for inference
          await switchBackend('webgl');
          
        } else {
          throw webglError; // Re-throw if it's not a WebGL-specific error
        }
      }
      
      // Clean up training tensors and optimizer
      if (Array.isArray(xs)) {
        xs.forEach(tensor => {
          if (tensor && typeof tensor.dispose === 'function') {
            tensor.dispose();
          }
        });
      } else if (xs && typeof xs.dispose === 'function') {
        xs.dispose();
      }
      
      if (ys && typeof ys.dispose === 'function') {
        ys.dispose();
      }
      
      // Clean up custom optimizer
      if (optimizer && typeof optimizer.dispose === 'function') {
        optimizer.dispose();
      }
      
      // Evaluate the updated model
      const evaluation = await this.classifier.evaluate(validData);
      
      // Save the updated model
      await this.classifier.save();
      
      // Record metrics (incremental training may not have perClassMetrics)
      await this.recordTrainingMetrics({
        accuracy: evaluation.accuracy,
        loss: evaluation.loss,
        trainingExamples: trainingData.length,
        validationExamples: validData.length,
        duration: Date.now() - startTime,
        trainingType: 'incremental',
        perClassMetrics: evaluation.perClassMetrics || [] // Provide empty array if not available
      });
      
      const result = {
        success: true,
        history,
        evaluation,
        duration: Date.now() - startTime,
        trainingType: 'incremental',
        accuracy: evaluation.accuracy
      };
      
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete(result);
      }
      
      return result;
      
    } catch (error) {
      console.error('Incremental training error:', error);
      
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      
      throw error;
      
    } finally {
      this.isTraining = false;
    }
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
    
    // Per-class metrics (if available)
    if (metrics.perClassMetrics && Array.isArray(metrics.perClassMetrics)) {
      for (const classMetric of metrics.perClassMetrics) {
        await recordMetric({
          method: 'model',
          type: `class_${classMetric.class}_f1`,
          value: classMetric.f1,
          metadata: classMetric
        });
      }
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