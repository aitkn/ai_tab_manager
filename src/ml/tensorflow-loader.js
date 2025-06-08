/*
 * AI Tab Manager - TensorFlow.js Loader
 * Handles lazy loading of TensorFlow.js library
 */

let tf = null;
let loadingPromise = null;

/**
 * Load TensorFlow.js library
 * @returns {Promise} Promise that resolves when TensorFlow.js is loaded
 */
export async function loadTensorFlow() {
  if (tf) {
    return tf;
  }
  
  if (loadingPromise) {
    return loadingPromise;
  }
  
  loadingPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('Loading TensorFlow.js...');
      
      // For Chrome extensions, we'll load from CDN
      // In production, consider bundling or using a local copy
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js';
      
      script.onload = () => {
        tf = window.tf;
        console.log('TensorFlow.js loaded successfully');
        resolve(tf);
      };
      
      script.onerror = (error) => {
        console.error('Failed to load TensorFlow.js:', error);
        reject(error);
      };
      
      document.head.appendChild(script);
    } catch (error) {
      reject(error);
    }
  });
  
  return loadingPromise;
}

/**
 * Get TensorFlow.js instance
 * @returns {Object|null} TensorFlow.js instance or null if not loaded
 */
export function getTensorFlow() {
  return tf;
}

/**
 * Check if TensorFlow.js is loaded
 * @returns {boolean} True if loaded
 */
export function isTensorFlowLoaded() {
  return tf !== null;
}

/**
 * Load TensorFlow.js with Web Worker support
 * @returns {Promise} Promise that resolves when ready
 */
export async function loadTensorFlowForWorker() {
  // For Web Workers, we need to use importScripts
  if (typeof importScripts === 'function') {
    try {
      importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');
      tf = self.tf;
      console.log('TensorFlow.js loaded in Web Worker');
      return tf;
    } catch (error) {
      console.error('Failed to load TensorFlow.js in Worker:', error);
      throw error;
    }
  } else {
    // Fallback to regular loading
    return loadTensorFlow();
  }
}

// Export for convenience
export default {
  loadTensorFlow,
  getTensorFlow,
  isTensorFlowLoaded,
  loadTensorFlowForWorker
};