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
   * Build the complete model architecture
   */
  buildModel() {
    const tf = getTensorFlow();
    if (!tf) throw new Error('TensorFlow.js not loaded');
    
    // Create feature embedder
    this.embedder = createFeatureEmbedder(this.vocabulary);
    
    // Get embedder output shape
    const embeddingSize = this.embedder.outputs[0].shape[1];
    
    // Build classifier on top of embedder
    const input = tf.input({ shape: [embeddingSize], name: 'embeddings' });
    
    // Hidden layers
    let x = input;
    
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
    const outputLayer = tf.layers.dense({
      units: ML_CONFIG.model.output.numClasses,
      activation: ML_CONFIG.model.output.activation,
      name: 'category_output'
    });
    const output = outputLayer.apply(x);
    
    // Create classifier model
    this.classifier = tf.model({
      inputs: input,
      outputs: output,
      name: 'tab_classifier'
    });
    
    // Create combined model
    const urlInput = this.embedder.inputs[0];
    const titleInput = this.embedder.inputs[1];
    const featuresInput = this.embedder.inputs[2];
    
    // Connect embedder to classifier
    const embeddings = this.embedder.outputs[0];
    const predictions = this.classifier.apply(embeddings);
    
    this.model = tf.model({
      inputs: [urlInput, titleInput, featuresInput],
      outputs: predictions,
      name: 'complete_tab_classifier'
    });
    
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
    
    console.log('Model compiled');
    console.log('Total parameters:', this.model.countParams());
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
   * Save the model
   */
  async save() {
    const tf = getTensorFlow();
    
    // Get model weights
    const weights = await this.model.save(tf.io.withSaveHandler(async (artifacts) => {
      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: 'JSON',
          weightDataBytes: artifacts.weightData.byteLength
        }
      };
    }));
    
    // Save to IndexedDB
    await saveModel({
      version: this.metadata.version,
      architecture: this.model.toJSON(),
      weights: await this.model.getWeights(),
      vocabulary: this.vocabulary.export(),
      accuracy: this.metadata.accuracy,
      trainingSamples: this.metadata.trainingSamples,
      inputShape: this.model.inputs.map(i => i.shape),
      outputShape: this.model.outputs.map(o => o.shape),
      metadata: this.metadata
    });
    
    console.log('Model saved successfully');
  }
  
  /**
   * Load saved model
   */
  static async load() {
    const modelData = await loadModel();
    if (!modelData) return null;
    
    const tf = await loadTensorFlow();
    
    // Recreate vocabulary
    const { Vocabulary } = await import('../features/vocabulary.js');
    const vocab = new Vocabulary();
    vocab.tokenToId = modelData.vocabulary.tokenToId;
    vocab.idToToken = modelData.vocabulary.idToToken;
    vocab.finalized = true;
    
    // Create classifier instance
    const classifier = new TabClassifier(vocab);
    await classifier.initialize();
    
    // Load weights
    if (modelData.weights) {
      await classifier.model.setWeights(modelData.weights);
    }
    
    // Restore metadata
    classifier.metadata = modelData.metadata || {};
    
    console.log('Model loaded successfully');
    return classifier;
  }
  
  /**
   * Check if model exists
   */
  async exists() {
    try {
      const modelData = await loadModel();
      return modelData !== null && modelData !== undefined;
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
    const predClasses = await predictions.argMax(-1).array();
    const trueClasses = await ys.argMax(-1).array();
    
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

export async function getTabClassifier() {
  if (!classifierInstance) {
    // Try to load saved model
    classifierInstance = await TabClassifier.load();
    
    // If no saved model, create new one
    if (!classifierInstance) {
      classifierInstance = new TabClassifier();
      await classifierInstance.initialize();
    }
  }
  
  return classifierInstance;
}

export default {
  TabClassifier,
  getTabClassifier
};