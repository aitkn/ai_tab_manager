/*
 * AI Tab Manager - Worker Manager
 * Manages Web Worker lifecycle for background training
 */

import { ML_CONFIG } from '../model-config.js';
import { recordMetric } from '../storage/ml-database.js';

/**
 * Training Worker Manager
 */
export class WorkerManager {
  constructor() {
    this.worker = null;
    this.jobs = new Map();
    this.isInitialized = false;
    this.callbacks = new Map();
  }
  
  /**
   * Initialize the worker
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Create worker
      this.worker = new Worker(
        new URL('./training-worker.js', import.meta.url),
        { type: 'module' }
      );
      
      // Set up message handler
      this.worker.addEventListener('message', (event) => {
        this.handleWorkerMessage(event.data);
      });
      
      // Set up error handler
      this.worker.addEventListener('error', (error) => {
        console.error('Worker error:', error);
        this.handleWorkerError(error);
      });
      
      // Initialize worker
      await this.sendMessage('INIT');
      
      this.isInitialized = true;
      console.log('Worker manager initialized');
      
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      throw error;
    }
  }
  
  /**
   * Send message to worker
   */
  sendMessage(type, data = null, jobId = null) {
    return new Promise((resolve, reject) => {
      const id = jobId || this.generateJobId();
      
      // Store callbacks
      this.callbacks.set(id, { resolve, reject });
      
      // Send message
      this.worker.postMessage({
        type,
        data,
        jobId: id
      });
      
      // Set timeout
      setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error('Worker timeout'));
        }
      }, ML_CONFIG.backgroundTraining.maxTrainingTime);
    });
  }
  
  /**
   * Handle worker messages
   */
  handleWorkerMessage(message) {
    const { type, jobId, data, error } = message;
    
    switch (type) {
      case 'INITIALIZED':
        console.log('Worker initialized:', data);
        this.resolveJob(jobId, data);
        break;
        
      case 'PROGRESS':
        this.handleProgress(jobId, data);
        break;
        
      case 'BATCH_PROGRESS':
        // Less frequent batch updates
        if (this.jobs.has(jobId)) {
          const job = this.jobs.get(jobId);
          if (job.onBatchProgress) {
            job.onBatchProgress(data);
          }
        }
        break;
        
      case 'TRAINING_COMPLETE':
        this.handleTrainingComplete(jobId, data);
        break;
        
      case 'PREDICTION_COMPLETE':
        this.resolvePrediction(jobId, data);
        break;
        
      case 'ERROR':
        this.handleError(jobId, error);
        break;
        
      case 'MEMORY_WARNING':
        console.warn('Worker memory warning:', data);
        this.handleMemoryWarning(data);
        break;
        
      case 'STATUS':
        this.resolveJob(jobId, data);
        break;
        
      default:
        console.log('Unknown worker message:', type, data);
    }
  }
  
  /**
   * Train model in background
   * @param {Object} modelConfig - Model configuration
   * @param {Array} trainingData - Training data
   * @param {Object} options - Training options
   * @returns {Promise<Object>} Training results
   */
  async trainModel(modelConfig, trainingData, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const jobId = this.generateJobId();
    
    // Create job record
    const job = {
      id: jobId,
      type: 'training',
      startTime: Date.now(),
      status: 'running',
      progress: 0,
      onProgress: options.onProgress,
      onBatchProgress: options.onBatchProgress,
      onComplete: options.onComplete,
      onError: options.onError
    };
    
    this.jobs.set(jobId, job);
    
    try {
      // Check if should train based on conditions
      if (!this.shouldTrain()) {
        throw new Error('Training conditions not met');
      }
      
      // Send training request
      const result = await this.sendMessage('TRAIN', {
        modelConfig,
        trainingData,
        options: {
          epochs: options.epochs || ML_CONFIG.training.epochs,
          batchSize: options.batchSize || ML_CONFIG.training.batchSize,
          validationSplit: options.validationSplit || ML_CONFIG.training.validationSplit
        }
      }, jobId);
      
      return result;
      
    } catch (error) {
      // Clean up job
      this.jobs.delete(jobId);
      throw error;
    }
  }
  
  /**
   * Make predictions using worker
   * @param {Object} modelWeights - Model weights
   * @param {Array} inputData - Input data
   * @param {Object} modelConfig - Model configuration
   * @returns {Promise<Object>} Predictions
   */
  async predict(modelWeights, inputData, modelConfig) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return this.sendMessage('PREDICT', {
      modelWeights,
      inputData,
      modelConfig
    });
  }
  
  /**
   * Cancel training job
   * @param {string} jobId - Job ID to cancel
   */
  cancelJob(jobId) {
    if (this.jobs.has(jobId)) {
      this.sendMessage('CANCEL', null, jobId);
      
      const job = this.jobs.get(jobId);
      job.status = 'cancelled';
      
      if (job.onError) {
        job.onError(new Error('Training cancelled'));
      }
      
      this.jobs.delete(jobId);
    }
  }
  
  /**
   * Get worker status
   */
  async getStatus() {
    if (!this.isInitialized) {
      return { initialized: false };
    }
    
    const status = await this.sendMessage('STATUS');
    
    return {
      initialized: true,
      ...status,
      activeJobs: Array.from(this.jobs.values()).map(job => ({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        duration: Date.now() - job.startTime
      }))
    };
  }
  
  /**
   * Handle training progress
   */
  handleProgress(jobId, data) {
    if (!this.jobs.has(jobId)) return;
    
    const job = this.jobs.get(jobId);
    job.progress = data.epoch / data.totalEpochs;
    
    // Call progress callback
    if (job.onProgress) {
      job.onProgress({
        ...data,
        progress: job.progress,
        elapsed: Date.now() - job.startTime
      });
    }
    
    // Log progress
    if (data.epoch % 5 === 0 || data.epoch === data.totalEpochs) {
      console.log(`Training progress: Epoch ${data.epoch}/${data.totalEpochs}, Loss: ${data.loss.toFixed(4)}, Accuracy: ${data.accuracy.toFixed(4)}`);
    }
  }
  
  /**
   * Handle training completion
   */
  async handleTrainingComplete(jobId, data) {
    if (!this.jobs.has(jobId)) return;
    
    const job = this.jobs.get(jobId);
    job.status = 'completed';
    
    // Record metrics
    await recordMetric({
      method: 'model',
      type: 'training_complete',
      value: data.finalAccuracy,
      metadata: {
        duration: data.duration,
        finalLoss: data.finalLoss,
        epochs: data.history.loss.length
      }
    });
    
    // Call completion callback
    if (job.onComplete) {
      job.onComplete(data);
    }
    
    // Resolve promise
    this.resolveJob(jobId, data);
    
    // Clean up
    this.jobs.delete(jobId);
    
    console.log(`Training completed in ${(data.duration / 1000).toFixed(1)}s with accuracy: ${(data.finalAccuracy * 100).toFixed(1)}%`);
  }
  
  /**
   * Handle prediction completion
   */
  resolvePrediction(jobId, data) {
    this.resolveJob(jobId, data);
  }
  
  /**
   * Handle worker error
   */
  handleError(jobId, error) {
    console.error('Worker error for job', jobId, ':', error);
    
    if (this.jobs.has(jobId)) {
      const job = this.jobs.get(jobId);
      job.status = 'error';
      
      if (job.onError) {
        job.onError(new Error(error.message));
      }
      
      this.jobs.delete(jobId);
    }
    
    this.rejectJob(jobId, new Error(error.message));
  }
  
  /**
   * Handle worker crash
   */
  handleWorkerError(error) {
    console.error('Worker crashed:', error);
    
    // Cancel all active jobs
    this.jobs.forEach((job, jobId) => {
      if (job.onError) {
        job.onError(new Error('Worker crashed'));
      }
      this.rejectJob(jobId, error);
    });
    
    this.jobs.clear();
    this.isInitialized = false;
    
    // Attempt to restart
    setTimeout(() => {
      console.log('Attempting to restart worker...');
      this.initialize().catch(console.error);
    }, 5000);
  }
  
  /**
   * Handle memory warning
   */
  handleMemoryWarning(memoryInfo) {
    console.warn('High memory usage:', memoryInfo);
    
    // Record metric
    recordMetric({
      method: 'system',
      type: 'memory_warning',
      value: memoryInfo.numBytes,
      metadata: memoryInfo
    });
  }
  
  /**
   * Check if should train based on conditions
   */
  shouldTrain() {
    const config = ML_CONFIG.backgroundTraining;
    
    // Check if enabled
    if (!config.enabled) {
      console.log('Background training disabled');
      return false;
    }
    
    // Check if requires idle (simplified check)
    if (config.requiresIdle && document.visibilityState !== 'hidden') {
      console.log('Not idle - postponing training');
      return false;
    }
    
    return true;
  }
  
  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Resolve job promise
   */
  resolveJob(jobId, data) {
    if (this.callbacks.has(jobId)) {
      const { resolve } = this.callbacks.get(jobId);
      resolve(data);
      this.callbacks.delete(jobId);
    }
  }
  
  /**
   * Reject job promise
   */
  rejectJob(jobId, error) {
    if (this.callbacks.has(jobId)) {
      const { reject } = this.callbacks.get(jobId);
      reject(error);
      this.callbacks.delete(jobId);
    }
  }
  
  /**
   * Terminate worker
   */
  terminate() {
    if (this.worker) {
      // Cancel all active jobs
      this.jobs.forEach((job, jobId) => {
        this.cancelJob(jobId);
      });
      
      // Terminate worker
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      
      console.log('Worker terminated');
    }
  }
}

// Export singleton
let managerInstance = null;

export function getWorkerManager() {
  if (!managerInstance) {
    managerInstance = new WorkerManager();
  }
  return managerInstance;
}

export default {
  WorkerManager,
  getWorkerManager
};