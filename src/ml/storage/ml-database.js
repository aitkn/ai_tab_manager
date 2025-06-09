/*
 * AI Tab Manager - ML Database
 * IndexedDB schema and operations for ML data storage
 */

import { ML_CONFIG } from '../model-config.js';

const DB_NAME = 'TabClassifierML';
const DB_VERSION = 1;

// Store names
export const STORES = {
  MODELS: 'models',
  TRAINING_DATA: 'trainingData',
  VOCABULARY: 'vocabulary',
  METRICS: 'metrics',
  PREDICTIONS: 'predictions'
};

let db = null;

/**
 * Initialize the ML database
 */
export async function initMLDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      reject(new Error('Failed to open ML database'));
    };
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Models store - stores trained models
      if (!db.objectStoreNames.contains(STORES.MODELS)) {
        const modelStore = db.createObjectStore(STORES.MODELS, { keyPath: 'id' });
        modelStore.createIndex('version', 'version');
        modelStore.createIndex('createdAt', 'createdAt');
      }
      
      // Training data store - stores training examples
      if (!db.objectStoreNames.contains(STORES.TRAINING_DATA)) {
        const trainingStore = db.createObjectStore(STORES.TRAINING_DATA, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        trainingStore.createIndex('timestamp', 'timestamp');
        trainingStore.createIndex('category', 'category');
        trainingStore.createIndex('source', 'source');
        trainingStore.createIndex('url', 'url');
      }
      
      // Vocabulary store - stores token mappings
      if (!db.objectStoreNames.contains(STORES.VOCABULARY)) {
        const vocabStore = db.createObjectStore(STORES.VOCABULARY, { keyPath: 'id' });
        vocabStore.createIndex('version', 'version');
      }
      
      // Metrics store - stores performance metrics
      if (!db.objectStoreNames.contains(STORES.METRICS)) {
        const metricsStore = db.createObjectStore(STORES.METRICS, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        metricsStore.createIndex('timestamp', 'timestamp');
        metricsStore.createIndex('method', 'method');
        metricsStore.createIndex('metricType', 'metricType');
      }
      
      // Predictions store - stores recent predictions for analysis
      if (!db.objectStoreNames.contains(STORES.PREDICTIONS)) {
        const predictionsStore = db.createObjectStore(STORES.PREDICTIONS, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        predictionsStore.createIndex('timestamp', 'timestamp');
        predictionsStore.createIndex('tabId', 'tabId');
        predictionsStore.createIndex('correct', 'correct');
      }
    };
  });
}

/**
 * Save a trained model
 */
export async function saveModel(modelData) {
  const transaction = db.transaction([STORES.MODELS], 'readwrite');
  const store = transaction.objectStore(STORES.MODELS);
  
  const model = {
    id: 'current',
    version: modelData.version || Date.now().toString(),
    architecture: modelData.architecture,
    weights: modelData.weights,
    vocabulary: modelData.vocabulary,
    metadata: {
      accuracy: modelData.accuracy,
      trainingSamples: modelData.trainingSamples,
      createdAt: Date.now(),
      inputShape: modelData.inputShape,
      outputShape: modelData.outputShape
    }
  };
  
  return new Promise((resolve, reject) => {
    const request = store.put(model);
    request.onsuccess = () => resolve(model);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load the current model
 */
export async function loadModel() {
  // Ensure database is initialized
  if (!db) {
    await initMLDatabase();
  }
  
  const transaction = db.transaction([STORES.MODELS], 'readonly');
  const store = transaction.objectStore(STORES.MODELS);
  
  return new Promise((resolve, reject) => {
    const request = store.get('current');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add training data
 */
export async function addTrainingData(data) {
  // Ensure database is initialized
  if (!db) {
    await initMLDatabase();
  }
  
  const transaction = db.transaction([STORES.TRAINING_DATA], 'readwrite');
  const store = transaction.objectStore(STORES.TRAINING_DATA);
  
  const trainingExample = {
    url: data.url,
    title: data.title,
    features: data.features,
    category: data.category,
    timestamp: Date.now(),
    source: data.source || 'user',
    corrected: data.corrected || false,
    metadata: data.metadata || {}
  };
  
  return new Promise((resolve, reject) => {
    const request = store.add(trainingExample);
    request.onsuccess = () => {
      // Clean up old data if necessary
      cleanupOldTrainingData();
      resolve(trainingExample);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get training data for model training
 */
export async function getTrainingData(limit = null) {
  // Ensure database is initialized
  if (!db) {
    await initMLDatabase();
  }
  
  const transaction = db.transaction([STORES.TRAINING_DATA], 'readonly');
  const store = transaction.objectStore(STORES.TRAINING_DATA);
  
  return new Promise((resolve, reject) => {
    const data = [];
    const request = store.openCursor();
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && (!limit || data.length < limit)) {
        data.push(cursor.value);
        cursor.continue();
      } else {
        resolve(data);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save vocabulary
 */
export async function saveVocabulary(vocabulary) {
  const transaction = db.transaction([STORES.VOCABULARY], 'readwrite');
  const store = transaction.objectStore(STORES.VOCABULARY);
  
  const vocabData = {
    id: 'current',
    version: Date.now().toString(),
    tokenToId: vocabulary.tokenToId,
    idToToken: vocabulary.idToToken,
    tokenCounts: vocabulary.tokenCounts,
    metadata: {
      size: vocabulary.idToToken.length,
      createdAt: Date.now()
    }
  };
  
  return new Promise((resolve, reject) => {
    const request = store.put(vocabData);
    request.onsuccess = () => resolve(vocabData);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load vocabulary
 */
export async function loadVocabulary() {
  const transaction = db.transaction([STORES.VOCABULARY], 'readonly');
  const store = transaction.objectStore(STORES.VOCABULARY);
  
  return new Promise((resolve, reject) => {
    const request = store.get('current');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Record a metric
 */
export async function recordMetric(metric) {
  const transaction = db.transaction([STORES.METRICS], 'readwrite');
  const store = transaction.objectStore(STORES.METRICS);
  
  const metricData = {
    timestamp: Date.now(),
    method: metric.method,
    metricType: metric.type,
    value: metric.value,
    metadata: metric.metadata || {}
  };
  
  return new Promise((resolve, reject) => {
    const request = store.add(metricData);
    request.onsuccess = () => {
      cleanupOldMetrics();
      resolve(metricData);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get metrics for a specific method
 */
export async function getMetrics(method, type = null, limit = 100) {
  const transaction = db.transaction([STORES.METRICS], 'readonly');
  const store = transaction.objectStore(STORES.METRICS);
  const index = store.index('method');
  
  return new Promise((resolve, reject) => {
    const metrics = [];
    const request = index.openCursor(IDBKeyRange.only(method));
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && metrics.length < limit) {
        if (!type || cursor.value.metricType === type) {
          metrics.push(cursor.value);
        }
        cursor.continue();
      } else {
        // Sort by timestamp descending
        metrics.sort((a, b) => b.timestamp - a.timestamp);
        resolve(metrics);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Record a prediction for tracking
 */
export async function recordPrediction(prediction) {
  const transaction = db.transaction([STORES.PREDICTIONS], 'readwrite');
  const store = transaction.objectStore(STORES.PREDICTIONS);
  
  const predictionData = {
    timestamp: Date.now(),
    tabId: prediction.tabId,
    url: prediction.url,
    title: prediction.title,
    predictions: {
      rules: prediction.rules,
      model: prediction.model,
      llm: prediction.llm
    },
    final: prediction.final,
    source: prediction.source,
    confidence: prediction.confidence,
    correct: prediction.correct || null
  };
  
  return new Promise((resolve, reject) => {
    const request = store.add(predictionData);
    request.onsuccess = () => resolve(predictionData);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update prediction correctness
 */
export async function updatePredictionCorrectness(predictionId, correct) {
  const transaction = db.transaction([STORES.PREDICTIONS], 'readwrite');
  const store = transaction.objectStore(STORES.PREDICTIONS);
  
  return new Promise((resolve, reject) => {
    const request = store.get(predictionId);
    
    request.onsuccess = () => {
      const prediction = request.result;
      if (prediction) {
        prediction.correct = correct;
        const updateRequest = store.put(prediction);
        updateRequest.onsuccess = () => resolve(prediction);
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        reject(new Error('Prediction not found'));
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clean up old training data
 */
async function cleanupOldTrainingData() {
  const transaction = db.transaction([STORES.TRAINING_DATA], 'readwrite');
  const store = transaction.objectStore(STORES.TRAINING_DATA);
  const index = store.index('timestamp');
  
  // Count total records
  const countRequest = store.count();
  
  countRequest.onsuccess = () => {
    const count = countRequest.result;
    if (count > ML_CONFIG.storage.maxTrainingDataSize) {
      // Delete oldest records
      const toDelete = count - ML_CONFIG.storage.maxTrainingDataSize;
      let deleted = 0;
      
      const cursor = index.openCursor();
      cursor.onsuccess = (event) => {
        const result = event.target.result;
        if (result && deleted < toDelete) {
          result.delete();
          deleted++;
          result.continue();
        }
      };
    }
  };
}

/**
 * Clean up old metrics
 */
async function cleanupOldMetrics() {
  const transaction = db.transaction([STORES.METRICS], 'readwrite');
  const store = transaction.objectStore(STORES.METRICS);
  const index = store.index('timestamp');
  
  // Delete metrics older than 30 days
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const range = IDBKeyRange.upperBound(thirtyDaysAgo);
  
  const request = index.openCursor(range);
  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  const stats = {};
  
  for (const storeName of Object.values(STORES)) {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    await new Promise((resolve) => {
      const request = store.count();
      request.onsuccess = () => {
        stats[storeName] = request.result;
        resolve();
      };
    });
  }
  
  return stats;
}

/**
 * Clear all ML data (for debugging/reset)
 */
export async function clearAllMLData() {
  const stores = Object.values(STORES);
  const transaction = db.transaction(stores, 'readwrite');
  
  const promises = stores.map(storeName => {
    return new Promise((resolve, reject) => {
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
  
  return Promise.all(promises);
}

// Auto-initialize on import
initMLDatabase().catch(console.error);

export default {
  initMLDatabase,
  saveModel,
  loadModel,
  addTrainingData,
  getTrainingData,
  saveVocabulary,
  loadVocabulary,
  recordMetric,
  getMetrics,
  recordPrediction,
  updatePredictionCorrectness,
  getDatabaseStats,
  clearAllMLData
};