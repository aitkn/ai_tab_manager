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
      console.log('Loading TensorFlow.js from static file...');
      
      // Load TensorFlow.js from the bundled static file
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('tensorflow.min.js');
      
      script.onload = () => {
        // Give a small delay for tf to initialize
        setTimeout(() => {
          tf = window.tf;
          if (tf) {
            console.log('TensorFlow.js loaded successfully, version:', tf.version.tfjs);
            resolve(tf);
          } else {
            console.log('TensorFlow.js loaded but tf is not available - likely CSP restrictions');
            resolve(null);
          }
        }, 100);
      };
      
      script.onerror = (error) => {
        console.log('Failed to load TensorFlow.js (expected in Chrome extensions due to CSP):', error.message || error);
        resolve(null);
      };
      
      document.head.appendChild(script);
      
    } catch (error) {
      console.error('Error loading TensorFlow.js:', error);
      resolve(null);
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
  // Web Workers also cannot use importScripts for external URLs in Chrome extensions
  console.log('TensorFlow.js not available in Web Worker due to CSP restrictions');
  return null;
}

// Export for convenience
export default {
  loadTensorFlow,
  getTensorFlow,
  isTensorFlowLoaded,
  loadTensorFlowForWorker
};