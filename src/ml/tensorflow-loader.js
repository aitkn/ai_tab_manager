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
      // Try to load from downloaded cache
      const { getCachedTensorFlow, downloadTensorFlow } = await import('./tensorflow-downloader.js');
      
      let scriptContent = await getCachedTensorFlow();
      
      if (!scriptContent) {
        console.log('TensorFlow.js not in cache, downloading...');
        try {
          scriptContent = await downloadTensorFlow();
        } catch (downloadError) {
          console.error('Failed to download TensorFlow.js:', downloadError);
          console.log('ML features will be disabled');
          resolve(null);
          return;
        }
      }
      
      // Execute the script in a safe way
      try {
        // Create a blob URL from the script content
        const blob = new Blob([scriptContent], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Create script element
        const script = document.createElement('script');
        script.src = blobUrl;
        
        await new Promise((scriptResolve, scriptReject) => {
          script.onload = () => {
            URL.revokeObjectURL(blobUrl);
            if (window.tf) {
              scriptResolve();
            } else {
              scriptReject(new Error('TensorFlow.js did not load properly'));
            }
          };
          script.onerror = (error) => {
            URL.revokeObjectURL(blobUrl);
            scriptReject(new Error('Failed to load TensorFlow.js script'));
          };
          
          // Ensure we're in a proper document context
          if (document && document.head) {
            document.head.appendChild(script);
          } else {
            scriptReject(new Error('Document not ready for script injection'));
          }
        });
        
        tf = window.tf;
        console.log('TensorFlow.js loaded successfully from cache');
        resolve(tf);
        
      } catch (execError) {
        console.error('Failed to execute TensorFlow.js:', execError);
        resolve(null);
      }
      
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