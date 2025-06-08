/*
 * AI Tab Manager - Training Worker
 * Web Worker for background model training
 */

// Worker state
let isTraining = false;
let currentJob = null;
let tf = null;

// Load TensorFlow.js in Web Worker
async function loadTensorFlowInWorker() {
  try {
    // In Web Workers, we can use importScripts with extension URLs
    const tfUrl = chrome.runtime.getURL('tensorflow.min.js');
    importScripts(tfUrl);
    tf = self.tf;
    console.log('TensorFlow.js loaded in worker');
    return true;
  } catch (error) {
    console.error('Failed to load TensorFlow.js in worker:', error);
    return false;
  }
}

// Message handler
self.addEventListener('message', async (event) => {
  const { type, data, jobId } = event.data;
  
  try {
    switch (type) {
      case 'INIT':
        await handleInit();
        break;
        
      case 'TRAIN':
        await handleTrain(data, jobId);
        break;
        
      case 'PREDICT':
        await handlePredict(data, jobId);
        break;
        
      case 'CANCEL':
        handleCancel(jobId);
        break;
        
      case 'STATUS':
        handleStatus();
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      jobId,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});

/**
 * Initialize the worker
 */
async function handleInit() {
  // Try to load TensorFlow.js
  const loaded = await loadTensorFlowInWorker();
  
  if (loaded && tf) {
    self.postMessage({
      type: 'INITIALIZED',
      data: {
        tfVersion: tf.version.tfjs,
        backend: tf.getBackend()
      }
    });
  } else {
    self.postMessage({
      type: 'INITIALIZED',
      data: {
        tfVersion: 'unavailable',
        backend: 'none',
        message: 'TensorFlow.js not available - please download it first'
      }
    });
  }
}

/**
 * Handle training request
 */
async function handleTrain(data, jobId) {
  // Check if TensorFlow.js is available
  if (!tf) {
    throw new Error('TensorFlow.js not loaded - please download it first');
  }
  
  if (isTraining) {
    throw new Error('Training already in progress');
  }
  
  isTraining = true;
  currentJob = { id: jobId, startTime: Date.now() };
  
  try {
    const { modelConfig, trainingData, options } = data;
    
    // Build model
    const model = buildModel(modelConfig);
    
    // Prepare data
    const { xs, ys } = prepareData(trainingData, modelConfig);
    
    // Training callbacks
    const callbacks = {
      onEpochEnd: (epoch, logs) => {
        self.postMessage({
          type: 'PROGRESS',
          jobId,
          data: {
            epoch: epoch + 1,
            totalEpochs: options.epochs,
            loss: logs.loss,
            accuracy: logs.acc,
            valLoss: logs.val_loss,
            valAccuracy: logs.val_acc
          }
        });
      },
      onBatchEnd: (batch, logs) => {
        // Report batch progress less frequently
        if (batch % 10 === 0) {
          self.postMessage({
            type: 'BATCH_PROGRESS',
            jobId,
            data: { batch, loss: logs.loss }
          });
        }
      }
    };
    
    // Train model
    const history = await model.fit(xs, ys, {
      epochs: options.epochs || 10,
      batchSize: options.batchSize || 32,
      validationSplit: options.validationSplit || 0.2,
      shuffle: true,
      callbacks
    });
    
    // Get final weights
    const weights = await model.getWeights();
    const weightsData = await Promise.all(
      weights.map(async (w) => ({
        shape: w.shape,
        data: await w.data()
      }))
    );
    
    // Clean up tensors
    xs.forEach(x => x.dispose());
    ys.dispose();
    weights.forEach(w => w.dispose());
    model.dispose();
    
    // Send results
    self.postMessage({
      type: 'TRAINING_COMPLETE',
      jobId,
      data: {
        history: history.history,
        weights: weightsData,
        duration: Date.now() - currentJob.startTime,
        finalLoss: history.history.loss[history.history.loss.length - 1],
        finalAccuracy: history.history.acc[history.history.acc.length - 1]
      }
    });
    
  } catch (error) {
    throw error;
  } finally {
    isTraining = false;
    currentJob = null;
  }
}

/**
 * Build model from configuration
 */
function buildModel(config) {
  const model = tf.sequential();
  
  // Input layer
  model.add(tf.layers.dense({
    inputShape: [config.inputSize],
    units: config.hiddenUnits[0],
    activation: 'relu',
    kernelRegularizer: tf.regularizers.l2({ l2: config.l2Regularization || 0.01 })
  }));
  
  // Hidden layers
  for (let i = 1; i < config.hiddenUnits.length; i++) {
    model.add(tf.layers.dense({
      units: config.hiddenUnits[i],
      activation: 'relu'
    }));
    
    // Add dropout
    if (config.dropout) {
      model.add(tf.layers.dropout({ rate: config.dropout }));
    }
  }
  
  // Output layer
  model.add(tf.layers.dense({
    units: config.numClasses,
    activation: 'softmax'
  }));
  
  // Compile model
  model.compile({
    optimizer: tf.train.adam(config.learningRate || 0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });
  
  return model;
}

/**
 * Prepare training data
 */
function prepareData(trainingData, config) {
  const features = [];
  const labels = [];
  
  trainingData.forEach(example => {
    features.push(example.features);
    labels.push(example.category);
  });
  
  // Convert to tensors
  const xs = [tf.tensor2d(features)];
  const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), config.numClasses);
  
  return { xs, ys };
}

/**
 * Handle prediction request
 */
async function handlePredict(data, jobId) {
  const { modelWeights, inputData, modelConfig } = data;
  
  try {
    // Rebuild model
    const model = buildModel(modelConfig);
    
    // Load weights
    const weights = modelWeights.map(w => 
      tf.tensor(w.data, w.shape)
    );
    model.setWeights(weights);
    
    // Prepare input
    const input = tf.tensor2d(inputData.map(d => d.features));
    
    // Make predictions
    const predictions = await model.predict(input);
    const probabilities = await predictions.array();
    
    // Get predicted classes
    const classes = await predictions.argMax(-1).array();
    
    // Clean up
    input.dispose();
    predictions.dispose();
    weights.forEach(w => w.dispose());
    model.dispose();
    
    // Send results
    self.postMessage({
      type: 'PREDICTION_COMPLETE',
      jobId,
      data: {
        predictions: classes,
        probabilities,
        confidence: probabilities.map(probs => Math.max(...probs))
      }
    });
    
  } catch (error) {
    throw error;
  }
}

/**
 * Handle cancel request
 */
function handleCancel(jobId) {
  if (currentJob && currentJob.id === jobId) {
    // TensorFlow.js doesn't provide a direct way to cancel training
    // We'll set a flag that could be checked in custom callbacks
    currentJob.cancelled = true;
    
    self.postMessage({
      type: 'CANCELLED',
      jobId
    });
  }
}

/**
 * Handle status request
 */
function handleStatus() {
  self.postMessage({
    type: 'STATUS',
    data: {
      isTraining,
      currentJob: currentJob ? {
        id: currentJob.id,
        duration: Date.now() - currentJob.startTime
      } : null,
      tfBackend: tf ? tf.getBackend() : null,
      memoryInfo: tf ? tf.memory() : null
    }
  });
}

/**
 * Monitor memory usage
 */
setInterval(() => {
  if (tf && isTraining) {
    const memory = tf.memory();
    
    // Warn if memory usage is high
    if (memory.numBytes > 100 * 1024 * 1024) { // 100MB
      self.postMessage({
        type: 'MEMORY_WARNING',
        data: memory
      });
    }
  }
}, 5000);

// Log initialization
console.log('Training worker initialized');