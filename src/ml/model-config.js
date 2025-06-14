/*
 * AI Tab Manager - ML Model Configuration
 * Central configuration for all ML-related parameters
 */

export const ML_CONFIG = {
  // Model Architecture
  model: {
    inputFeatures: {
      maxUrlLength: 20,      // Max tokens for URL
      maxTitleLength: 30,    // Max tokens for title
      embeddingDim: 32,      // Dimension of embeddings
      vocabSize: 10000       // Maximum vocabulary size
    },
    
    architecture: {
      hiddenUnits: [64, 32], // Hidden layer sizes
      dropout: 0.3,          // Dropout rate
      l2Regularization: 0.01 // L2 regularization strength
    },
    
    output: {
      numClasses: 4,         // Number of categories (0-3)
      activation: 'softmax'  // Output activation
    }
  },
  
  // Training Configuration
  training: {
    batchSize: 32,
    epochs: 10,
    validationSplit: 0.2,
    learningRate: 0.001,
    earlyStopping: {
      patience: 3,
      minDelta: 0.001
    },
    
    // Minimum training data requirements
    minTrainingExamples: 100,
    minExamplesPerClass: 10,
    
    
    // Incremental training
    incrementalBatchSize: 16,
    incrementalEpochs: 3
  },
  
  // Trust System Configuration
  trust: {
    // Initial trust weights
    initialWeights: {
      rules: 0.4,
      model: 0.2,  // Starts low
      llm: 0.4
    },
    
    // Trust adjustment parameters
    adjustment: {
      correctPredictionBoost: 0.02,
      incorrectPredictionPenalty: 0.03,
      maxWeight: 0.7,
      minWeight: 0.1
    },
    
    // Rolling window for accuracy calculation
    accuracyWindow: 100,
    
    // Minimum predictions before trust adjustment
    minPredictionsForAdjustment: 20
  },
  
  // Confidence Thresholds
  confidence: {
    highConfidence: 0.8,
    mediumConfidence: 0.6,
    lowConfidence: 0.4,
    
    // Below this, defer to other methods
    minimumConfidence: 0.3
  },
  
  // Feature Engineering
  features: {
    // URL pattern features
    urlPatterns: [
      { pattern: /^https?:\/\/(www\.)?/, name: 'has_protocol' },
      { pattern: /localhost|127\.0\.0\.1/, name: 'is_localhost' },
      { pattern: /\.(jpg|png|gif|pdf|doc|zip)$/i, name: 'is_file' },
      { pattern: /\?.*=/, name: 'has_query_params' },
      { pattern: /\/api\//, name: 'is_api' },
      { pattern: /\d{4,}/, name: 'has_long_number' },
      { pattern: /[a-f0-9]{8}-[a-f0-9]{4}/, name: 'has_uuid' }
    ],
    
    // Common tokens to track
    importantTokens: [
      'login', 'signin', 'auth',
      'checkout', 'payment', 'order',
      'dashboard', 'admin', 'settings',
      'docs', 'documentation', 'guide',
      'blog', 'article', 'post',
      'search', 'results', 'query'
    ]
  },
  
  // Storage Configuration
  storage: {
    modelStorageKey: 'tab_classifier_model',
    vocabularyStorageKey: 'tab_classifier_vocab',
    trainingDataStorageKey: 'tab_training_data',
    metricsStorageKey: 'tab_classifier_metrics',
    
    // Storage limits
    maxTrainingDataSize: 50000,  // Maximum training examples to store (increased from 10k)
    maxMetricsHistory: 1000      // Maximum metric records
  },
  
  // Background Training
  backgroundTraining: {
    enabled: true,
    schedule: 'daily',            // 'hourly', 'daily', 'weekly'
    minNewExamples: 50,          // Minimum new examples before retraining
    maxTrainingTime: 30000,       // Max training time in ms (30 seconds)
    
    // Resource constraints
    requiresIdle: true,           // Only train when browser is idle
    requiresCharging: false       // Only train when plugged in (if supported)
  },
  
  // Performance Optimization
  optimization: {
    // Model quantization (reduce size)
    quantization: {
      enabled: true,
      dtype: 'int8'              // Quantize to 8-bit integers
    },
    
    // Caching
    cache: {
      predictionCache: true,
      cacheSize: 1000,           // Number of predictions to cache
      cacheTTL: 3600000          // Cache TTL in ms (1 hour)
    }
  },
  
  // Debug and Logging
  debug: {
    logPredictions: false,
    logTraining: true,
    logTrustAdjustments: true,
    saveTrainingHistory: true
  }
};

// Derived configurations
export const FEATURE_SIZE = 
  ML_CONFIG.model.inputFeatures.maxUrlLength + 
  ML_CONFIG.model.inputFeatures.maxTitleLength +
  ML_CONFIG.features.urlPatterns.length +
  10; // Additional meta features

// Export convenience functions
export function getInitialTrustWeights() {
  return { ...ML_CONFIG.trust.initialWeights };
}

export function shouldUseMlPrediction(confidence) {
  return confidence >= ML_CONFIG.confidence.minimumConfidence;
}

export function isHighConfidence(confidence) {
  return confidence >= ML_CONFIG.confidence.highConfidence;
}

export default ML_CONFIG;