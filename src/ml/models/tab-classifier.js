/*
 * AI Tab Manager - Tab Classifier Model
 * Main neural network for tab categorization
 */

import { ML_CONFIG } from '../model-config.js';
import { loadTensorFlow, getTensorFlow } from '../tensorflow-loader.js';
import { createFeatureEmbedder, prepareEmbeddingInputs } from '../embeddings/embedding-model.js';
import { saveModel, loadModel } from '../storage/ml-database.js';
import { getOrCreateVocabulary } from '../features/vocabulary.js';

/**
 * Tab Classifier Neural Network
 */
export class TabClassifier {
  constructor(vocabulary = null) {
    this.vocabulary = vocabulary;
    this.embedder = null;
    this.classifier = null;
    this.model = null;
    this.isLoaded = false;
    this.metadata = {
      version: Date.now().toString(),
      createdAt: Date.now(),
      accuracy: 0,
      trainingSamples: 0
    };
  }
  
  /**
   * Initialize the model
   */
  async initialize() {
    // Load TensorFlow.js if not already loaded
    const tf = await loadTensorFlow();
    
    // If TensorFlow is not available, mark as loaded but disabled
    if (!tf) {
      console.log('TensorFlow.js not available - ML classifier disabled');
      this.isLoaded = true;
      this.disabled = true;
      return;
    }
    
    // Get or create vocabulary
    if (!this.vocabulary) {
      this.vocabulary = await getOrCreateVocabulary();
    }
    
    // Build model architecture
    this.buildModel();
    
    this.isLoaded = true;
    console.log('Tab classifier initialized');
  }
  
  /**
   * Build the unified model architecture (no separate embedder/classifier)
   */
  buildModel() {
    const tf = getTensorFlow();
    if (!tf) throw new Error('TensorFlow.js not loaded');
    
    const config = ML_CONFIG.model.inputFeatures;
    const vocabSize = this.vocabulary.size();
    
    // Create inputs
    const urlInput = tf.input({ 
      shape: [config.maxUrlLength], 
      name: 'url_tokens',
      dtype: 'int32'
    });
    
    const titleInput = tf.input({ 
      shape: [config.maxTitleLength], 
      name: 'title_tokens',
      dtype: 'int32'
    });
    
    const featuresInput = tf.input({
      shape: [ML_CONFIG.features.urlPatterns.length + 
              ML_CONFIG.features.importantTokens.length + 
              10], // numerical features
      name: 'engineered_features'
    });
    
    // Shared embedding layer
    const embeddingLayer = tf.layers.embedding({
      inputDim: vocabSize,
      outputDim: config.embeddingDim,
      embeddingsInitializer: 'randomUniform',
      embeddingsRegularizer: tf.regularizers.l2({ l2: 0.01 }),
      name: 'token_embeddings'
    });
    
    // Apply embeddings
    const urlEmbeddings = embeddingLayer.apply(urlInput);
    const titleEmbeddings = embeddingLayer.apply(titleInput);
    
    // Average pooling for variable-length sequences
    const urlPooled = tf.layers.globalAveragePooling1d({ 
      name: 'url_pooling' 
    }).apply(urlEmbeddings);
    
    const titlePooled = tf.layers.globalAveragePooling1d({ 
      name: 'title_pooling' 
    }).apply(titleEmbeddings);
    
    // Concatenate all features
    const concatenated = tf.layers.concatenate({ 
      name: 'feature_concatenation' 
    }).apply([urlPooled, titlePooled, featuresInput]);
    
    // Feature transformation layer
    const featureTransform = tf.layers.dense({
      units: 128,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
      name: 'feature_transformation'
    }).apply(concatenated);
    
    const featureDropout = tf.layers.dropout({
      rate: 0.2,
      name: 'feature_dropout'
    }).apply(featureTransform);
    
    // Classification layers (directly connected)
    let x = featureDropout;
    
    // Add hidden layers from config
    ML_CONFIG.model.architecture.hiddenUnits.forEach((units, index) => {
      const denseLayer = tf.layers.dense({
        units,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ 
          l2: ML_CONFIG.model.architecture.l2Regularization 
        }),
        name: `hidden_${index + 1}`
      });
      x = denseLayer.apply(x);
      
      // Add batch normalization for better training
      const batchNormLayer = tf.layers.batchNormalization({
        name: `batch_norm_${index + 1}`
      });
      x = batchNormLayer.apply(x);
      
      // Add dropout
      const dropoutLayer = tf.layers.dropout({
        rate: ML_CONFIG.model.architecture.dropout,
        name: `dropout_${index + 1}`
      });
      x = dropoutLayer.apply(x);
    });
    
    // Output layer
    const output = tf.layers.dense({
      units: ML_CONFIG.model.output.numClasses,
      activation: ML_CONFIG.model.output.activation,
      name: 'category_output'
    }).apply(x);
    
    // Create ONE unified model (no separate embedder/classifier)
    this.model = tf.model({
      inputs: [urlInput, titleInput, featuresInput],
      outputs: output,
      name: 'unified_tab_classifier'
    });
    
    // Remove separate models (unified architecture)
    this.embedder = null;
    this.classifier = null;
    
    // Compile the model
    this.compile();
  }
  
  /**
   * Compile the model with optimizer and loss
   */
  compile() {
    const tf = getTensorFlow();
    
    this.model.compile({
      optimizer: tf.train.adam(ML_CONFIG.training.learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy', 'categoricalCrossentropy']
    });
    
  }
  
  /**
   * Prepare training data
   * @param {Array} trainingData - Array of {url, title, category} objects
   * @returns {Object} Prepared tensors
   */
  prepareTrainingData(trainingData) {
    const tf = getTensorFlow();
    
    const urlTokens = [];
    const titleTokens = [];
    const features = [];
    const labels = [];
    
    trainingData.forEach(example => {
      const inputs = prepareEmbeddingInputs(
        { url: example.url, title: example.title },
        this.vocabulary
      );
      
      urlTokens.push(inputs.urlTokens);
      titleTokens.push(inputs.titleTokens);
      features.push(inputs.features);
      labels.push(example.category);
    });
    
    // Convert to tensors
    const xs = [
      tf.tensor2d(urlTokens, null, 'int32'),
      tf.tensor2d(titleTokens, null, 'int32'),
      tf.tensor2d(features)
    ];
    
    // One-hot encode labels
    const ys = tf.oneHot(
      tf.tensor1d(labels, 'int32'),
      ML_CONFIG.model.output.numClasses
    );
    
    return { xs, ys };
  }
  
  /**
   * Train the model
   * @param {Array} trainingData - Training examples
   * @param {Object} options - Training options
   * @returns {Promise<Object>} Training history
   */
  async train(trainingData, options = {}) {
    if (!this.isLoaded) {
      await this.initialize();
    }
    
    const tf = getTensorFlow();
    
    // Prepare data
    const { xs, ys } = this.prepareTrainingData(trainingData);
    
    // Training configuration
    const config = {
      epochs: options.epochs || ML_CONFIG.training.epochs,
      batchSize: options.batchSize || ML_CONFIG.training.batchSize,
      validationSplit: options.validationSplit || ML_CONFIG.training.validationSplit,
      shuffle: true,
      verbose: 1,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          console.log(`Epoch ${epoch + 1}: loss=${logs.loss.toFixed(4)}, accuracy=${logs.acc.toFixed(4)}`);
          
          // Check for early stopping
          if (options.earlyStoppingCallback) {
            await options.earlyStoppingCallback(epoch, logs);
          }
        },
        onBatchEnd: async (batch, logs) => {
          if (batch % 10 === 0 && options.onProgress) {
            await options.onProgress({
              batch,
              loss: logs.loss,
              accuracy: logs.acc
            });
          }
        }
      }
    };
    
    // Train the model
    const history = await this.model.fit(xs, ys, config);
    
    // Update metadata
    this.metadata.trainingSamples += trainingData.length;
    this.metadata.lastTrainingDate = Date.now();
    const finalAccuracy = history.history.acc[history.history.acc.length - 1];
    this.metadata.accuracy = finalAccuracy;
    
    // Clean up tensors
    xs.forEach(x => x.dispose());
    ys.dispose();
    
    return history;
  }
  
  /**
   * Predict categories for tabs
   * @param {Array} tabs - Array of tab objects
   * @returns {Promise<Array>} Predictions
   */
  async predict(tabs) {
    if (!this.isLoaded) {
      await this.initialize();
    }
    
    // If disabled, return empty predictions
    if (this.disabled) {
      return tabs.map(tab => ({
        tabId: tab.id,
        category: null,
        confidence: 0,
        probabilities: []
      }));
    }
    
    const tf = getTensorFlow();
    
    // Prepare inputs
    const urlTokens = [];
    const titleTokens = [];
    const features = [];
    
    tabs.forEach(tab => {
      const inputs = prepareEmbeddingInputs(tab, this.vocabulary);
      urlTokens.push(inputs.urlTokens);
      titleTokens.push(inputs.titleTokens);
      features.push(inputs.features);
    });
    
    // Convert to tensors
    const xs = [
      tf.tensor2d(urlTokens, null, 'int32'),
      tf.tensor2d(titleTokens, null, 'int32'),
      tf.tensor2d(features)
    ];
    
    // Get predictions
    const predictions = await this.model.predict(xs);
    const probabilities = await predictions.array();
    
    // Get predicted classes and confidences
    const results = probabilities.map((probs, index) => {
      const maxIndex = probs.indexOf(Math.max(...probs));
      const confidence = probs[maxIndex];
      
      return {
        tabId: tabs[index].id,
        category: maxIndex,
        confidence,
        probabilities: probs,
        // Include confidence breakdown
        breakdown: {
          ignore: probs[1],
          useful: probs[2],
          important: probs[3],
          uncategorized: probs[0]
        }
      };
    });
    
    // Clean up tensors
    xs.forEach(x => x.dispose());
    predictions.dispose();
    
    return results;
  }
  
  /**
   * Predict single tab
   * @param {Object} tab - Tab object
   * @returns {Promise<Object>} Prediction
   */
  async predictOne(tab) {
    const results = await this.predict([tab]);
    return results[0];
  }
  
  /**
   * Save the model using TensorFlow.js standard save format
   */
  async save() {
    try {
      // Save the complete model to IndexedDB using TensorFlow.js standard format
      await this.model.save('indexeddb://tab-classifier-model');
      
      // Save vocabulary and metadata separately using our custom storage
      await saveModel({
        version: this.metadata.version,
        vocabulary: this.vocabulary.export(),
        accuracy: this.metadata.accuracy,
        trainingSamples: this.metadata.trainingSamples,
        inputShape: this.model.inputs.map(i => i.shape),
        outputShape: this.model.outputs.map(o => o.shape),
        metadata: this.metadata
      });
      
    } catch (saveError) {
      console.error('Error saving model:', saveError);
      // Continue anyway - don't let save errors break the flow
    }
    
    // Reset the singleton cache so next getTabClassifier() call will reload the saved model
    classifierInstance = null;
    
    // Also reset ML categorizer cache since it holds a reference to the old classifier
    try {
      const { resetMLCategorizerCache } = await import('../categorization/ml-categorizer.js');
      resetMLCategorizerCache();
    } catch (error) {
      console.log('Could not reset ML categorizer cache:', error);
    }
  }
  
  /**
   * Load weights with GPU/CPU fallback handling
   */
  static async loadWeightsWithFallback(classifier, weights) {
    const { switchBackend, getBackendInfo, getTensorFlow } = await import('../tensorflow-loader.js');
    const tf = getTensorFlow();
    const originalBackend = getBackendInfo().backend;
    
    // Try loading on current backend first with tidy() to prevent memory leaks
    console.log(`Attempting to load weights on ${originalBackend} backend...`);
    try {
      // Use tf.tidy() to prevent memory accumulation that can cause stack overflow
      const success = tf.tidy(() => {
        try {
          classifier.model.setWeights(weights);
          return true;
        } catch (error) {
          console.warn(`Weight loading failed in tidy context:`, error.message);
          return false;
        }
      });
      
      if (success) {
        console.log(`Weights loaded successfully on ${originalBackend} backend`);
        return true;
      }
    } catch (error) {
      console.warn(`Weight loading failed on ${originalBackend}:`, error.message);
      
      // Check if this is the known TensorFlow.js issue #5508 (large input stack overflow)
      if (error.message.includes('Maximum call stack') || error.name === 'RangeError') {
        console.log('Detected TensorFlow.js issue #5508 - large input causing stack overflow');
      }
    }
    
    // If current backend failed and we're on GPU, try CPU with fresh WebGL context
    if (originalBackend === 'webgl') {
      try {
        console.log('Switching to CPU backend for weight loading (WebGL context may be corrupted)...');
        await switchBackend('cpu');
        
        // Wait a moment for WebGL context to fully release
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const success = tf.tidy(() => {
          try {
            classifier.model.setWeights(weights);
            return true;
          } catch (error) {
            console.warn(`CPU weight loading failed in tidy context:`, error.message);
            return false;
          }
        });
        
        if (success) {
          console.log('Weights loaded successfully on CPU backend');
          
          // Try to switch back to GPU for inference with fresh context
          try {
            await switchBackend('webgl');
            console.log('Switched back to GPU for inference with fresh WebGL context');
          } catch (switchError) {
            console.warn('Could not switch back to GPU, staying on CPU:', switchError.message);
          }
          
          return true;
        }
      } catch (cpuError) {
        console.error('Weight loading failed on CPU as well:', cpuError.message);
      }
    }
    
    return false;
  }

  /**
   * Load saved model using TensorFlow.js loadLayersModel
   */
  static async load() {
    try {
      const tf = await loadTensorFlow();
      if (!tf) return null;
      
      // Try to load the full model from IndexedDB
      const loadedModel = await tf.loadLayersModel('indexeddb://tab-classifier-model');
      
      // Load vocabulary and metadata separately
      const modelData = await loadModel();
      
      // Recreate vocabulary
      let vocab;
      if (modelData && modelData.vocabulary) {
        const { Vocabulary } = await import('../features/vocabulary.js');
        vocab = new Vocabulary();
        vocab.tokenToId = modelData.vocabulary.tokenToId;
        vocab.idToToken = modelData.vocabulary.idToToken;
        vocab.finalized = true;
      } else {
        // Fallback to default vocabulary
        const { getOrCreateVocabulary } = await import('../features/vocabulary.js');
        vocab = await getOrCreateVocabulary();
      }
      
      // Create classifier instance
      const classifier = new TabClassifier(vocab);
      
      // Replace the model and embedder with loaded versions
      classifier.model = loadedModel;
      
      // CRITICAL: Recompile the loaded model
      classifier.compile();
      
      // Restore metadata
      classifier.metadata = (modelData && modelData.metadata) || {};
      classifier.isLoaded = true;
      
      return classifier;
      
    } catch (error) {
      // Silently handle model loading errors - this is expected for new installations
      return null; // Return null so getTabClassifier will create a new instance
    }
  }
  
  /**
   * Check if model exists in IndexedDB
   */
  async exists() {
    try {
      const tf = await loadTensorFlow();
      if (!tf) return false;
      
      // Try to list models in IndexedDB
      const models = await tf.io.listModels();
      return 'indexeddb://tab-classifier-model' in models;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get model summary
   */
  getSummary() {
    // If model is disabled, return basic info
    if (this.disabled) {
      return {
        architecture: { inputs: [], outputs: [] },
        parameters: 0,
        metadata: this.metadata
      };
    }
    
    return {
      architecture: {
        inputs: this.model.inputs.map(i => ({
          name: i.name,
          shape: i.shape
        })),
        outputs: this.model.outputs.map(o => ({
          name: o.name,
          shape: o.shape
        })),
        totalParams: this.model.countParams(),
        layers: this.model.layers.length
      },
      vocabulary: {
        size: this.vocabulary.size(),
        coverage: this.vocabulary.calculateCoverage()
      },
      metadata: this.metadata
    };
  }
  
  /**
   * Print simplified model summary
   */
  printModel() {
    if (this.disabled || !this.model) {
      return;
    }
    
    console.log(`Model: ${this.model.countParams().toLocaleString()} parameters, ${this.model.layers.length} layers`);
    
    if (this.metadata?.accuracy) {
      console.log(`Accuracy: ${(this.metadata.accuracy * 100).toFixed(1)}%`);
    }
  }
  
  /**
   * Evaluate model on test data
   * @param {Array} testData - Test examples
   * @returns {Promise<Object>} Evaluation metrics
   */
  async evaluate(testData) {
    const tf = getTensorFlow();
    
    // Prepare test data
    const { xs, ys } = this.prepareTrainingData(testData);
    
    // Evaluate
    const result = await this.model.evaluate(xs, ys);
    const [loss, accuracy] = await Promise.all(result.map(t => t.data()));
    
    // Get detailed predictions for confusion matrix
    const predictions = await this.model.predict(xs);
    const predClasses = await tf.argMax(predictions, -1).array();
    const trueClasses = await tf.argMax(ys, -1).array();
    
    // Calculate confusion matrix
    const confusionMatrix = this.calculateConfusionMatrix(trueClasses, predClasses);
    
    // Clean up
    xs.forEach(x => x.dispose());
    ys.dispose();
    result.forEach(t => t.dispose());
    predictions.dispose();
    
    return {
      loss,
      accuracy,
      confusionMatrix,
      perClassMetrics: this.calculatePerClassMetrics(confusionMatrix)
    };
  }
  
  /**
   * Calculate confusion matrix
   */
  calculateConfusionMatrix(trueLabels, predictions) {
    const numClasses = ML_CONFIG.model.output.numClasses;
    const matrix = Array(numClasses).fill(null).map(() => Array(numClasses).fill(0));
    
    for (let i = 0; i < trueLabels.length; i++) {
      matrix[trueLabels[i]][predictions[i]]++;
    }
    
    return matrix;
  }
  
  /**
   * Calculate per-class metrics from confusion matrix
   */
  calculatePerClassMetrics(confusionMatrix) {
    const metrics = [];
    const numClasses = confusionMatrix.length;
    
    for (let i = 0; i < numClasses; i++) {
      const tp = confusionMatrix[i][i];
      const fp = confusionMatrix.reduce((sum, row, j) => sum + (j !== i ? row[i] : 0), 0);
      const fn = confusionMatrix[i].reduce((sum, val, j) => sum + (j !== i ? val : 0), 0);
      const tn = confusionMatrix.reduce((sum, row, j) => 
        sum + (j !== i ? row.reduce((s, v, k) => s + (k !== i ? v : 0), 0) : 0), 0);
      
      const precision = tp / (tp + fp) || 0;
      const recall = tp / (tp + fn) || 0;
      const f1 = 2 * (precision * recall) / (precision + recall) || 0;
      
      metrics.push({
        class: i,
        precision,
        recall,
        f1,
        support: tp + fn
      });
    }
    
    return metrics;
  }
}

// Export singleton instance
let classifierInstance = null;

export async function getTabClassifier(forceReload = false) {
  if (!classifierInstance || forceReload) {
    // Try to load saved model first
    classifierInstance = await TabClassifier.load();
    
    // If no saved model, create new one
    if (!classifierInstance) {
      classifierInstance = new TabClassifier();
      await classifierInstance.initialize();
    }
  }
  
  return classifierInstance;
}

/**
 * Reset the classifier instance to force reload from storage
 */
export function resetTabClassifierCache() {
  classifierInstance = null;
}

export default {
  TabClassifier,
  getTabClassifier
};