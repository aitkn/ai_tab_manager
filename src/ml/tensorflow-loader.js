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
      console.log('Loading CSP-compliant TensorFlow.js modules...');
      
      // Load TensorFlow.js modules in the correct order for CSP compliance
      // Following: https://www.tensorflow.org/js/tutorials/deployment/web_ml_in_chrome
      
      const loadScript = (src) => {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = chrome.runtime.getURL(src);
          script.onload = () => resolve();
          script.onerror = (error) => reject(error);
          document.head.appendChild(script);
        });
      };
      
      // Load core first
      await loadScript('tf-core.min.js');
      console.log('TensorFlow.js core loaded');
      
      // Load CPU backend (CSP compliant)
      await loadScript('tf-backend-cpu.min.js');
      console.log('TensorFlow.js CPU backend loaded');
      
      // Load layers API
      await loadScript('tf-layers.min.js');
      console.log('TensorFlow.js layers loaded');
      
      // Give a moment for everything to initialize
      setTimeout(() => {
        tf = window.tf;
        if (tf) {
          console.log('CSP-compliant TensorFlow.js loaded successfully, version:', tf.version?.tfjs || 'unknown');
          resolve(tf);
        } else {
          console.log('TensorFlow.js modules loaded but tf is not available');
          resolve(null);
        }
      }, 200);
      
    } catch (error) {
      console.log('Error loading CSP-compliant TensorFlow.js modules:', error.message || error);
      console.log('ML features will not be available');
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