/*
 * AI Tab Manager - TensorFlow.js Loader
 * Handles lazy loading of TensorFlow.js library
 */

let tf = null;
let loadingPromise = null;
let currentBackend = null;
let availableBackends = [];

/**
 * Load TensorFlow.js library with GPU support
 * @param {boolean} preferGPU - Whether to prefer GPU acceleration (default: true)
 * @returns {Promise} Promise that resolves when TensorFlow.js is loaded
 */
export async function loadTensorFlow(preferGPU = true) {
  if (tf) {
    return tf;
  }
  
  if (loadingPromise) {
    return loadingPromise;
  }
  
  loadingPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('Loading TensorFlow.js with GPU support...');
      
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
      
      // Load CPU backend (always available as fallback)
      await loadScript('tf-backend-cpu.min.js');
      console.log('TensorFlow.js CPU backend loaded');
      availableBackends.push('cpu');
      
      // Try to load WebGL backend for GPU acceleration
      if (preferGPU) {
        try {
          await loadScript('tf-backend-webgl.min.js');
          console.log('TensorFlow.js WebGL backend loaded');
          availableBackends.push('webgl');
        } catch (webglError) {
          console.warn('WebGL backend failed to load, GPU acceleration not available:', webglError);
        }
      }
      
      // Load layers API
      await loadScript('tf-layers.min.js');
      console.log('TensorFlow.js layers loaded');
      
      // Give a moment for everything to initialize
      setTimeout(async () => {
        tf = window.tf;
        if (tf) {
          console.log('TensorFlow.js loaded successfully, version:', tf.version?.tfjs || 'unknown');
          
          // Initialize the best available backend
          currentBackend = await initializeBestBackend(preferGPU);
          
          resolve(tf);
        } else {
          console.log('TensorFlow.js modules loaded but tf is not available');
          resolve(null);
        }
      }, 300); // Increased delay for backend initialization
      
    } catch (error) {
      console.log('Error loading TensorFlow.js modules:', error.message || error);
      console.log('ML features will not be available');
      resolve(null);
    }
  });
  
  return loadingPromise;
}

/**
 * Initialize the best available backend
 * @param {boolean} preferGPU - Whether to prefer GPU
 * @returns {Promise<string>} The backend that was initialized
 */
async function initializeBestBackend(preferGPU) {
  if (!tf) {
    throw new Error('TensorFlow.js not loaded');
  }
  
  try {
    // If GPU is preferred and WebGL is available, try it first
    if (preferGPU && availableBackends.includes('webgl')) {
      try {
        console.log('Attempting to initialize WebGL backend...');
        await tf.setBackend('webgl');
        await tf.ready();
        
        // Test GPU functionality with a simple operation
        const testTensor = tf.ones([2, 2]);
        const testTensor2 = tf.ones([2, 2]);
        const result = tf.add(testTensor, testTensor2); // Use functional API
        await result.data(); // Force execution
        testTensor.dispose();
        testTensor2.dispose();
        result.dispose();
        
        console.log('🚀 GPU acceleration (WebGL) initialized successfully!');
        console.log('GPU Info:', tf.env().getAsync('WEBGL_VERSION'));
        return 'webgl';
        
      } catch (webglError) {
        console.warn('WebGL backend failed during initialization, falling back to CPU:', webglError);
      }
    }
    
    // Fallback to CPU
    console.log('Initializing CPU backend...');
    await tf.setBackend('cpu');
    await tf.ready();
    console.log('CPU backend initialized successfully');
    return 'cpu';
    
  } catch (error) {
    console.error('Failed to initialize any backend:', error);
    return null;
  }
}

/**
 * Get TensorFlow.js instance
 * @returns {Object|null} TensorFlow.js instance or null if not loaded
 */
export function getTensorFlow() {
  return tf;
}

/**
 * Get current backend information
 * @returns {Object} Backend information
 */
export function getBackendInfo() {
  if (!tf) {
    return { backend: null, available: [], isGPU: false };
  }
  
  return {
    backend: currentBackend,
    available: [...availableBackends],
    isGPU: currentBackend === 'webgl',
    tfBackend: tf.getBackend(),
    memory: tf.memory()
  };
}

/**
 * Switch to a different backend
 * @param {string} backendName - Backend to switch to ('cpu' or 'webgl')
 * @returns {Promise<boolean>} Success status
 */
export async function switchBackend(backendName) {
  if (!tf) {
    console.error('TensorFlow.js not loaded');
    return false;
  }
  
  if (!availableBackends.includes(backendName)) {
    console.error(`Backend ${backendName} not available. Available:`, availableBackends);
    return false;
  }
  
  try {
    console.log(`Switching to ${backendName} backend...`);
    await tf.setBackend(backendName);
    await tf.ready();
    currentBackend = backendName;
    
    const isGPU = backendName === 'webgl';
    console.log(`Successfully switched to ${backendName} backend ${isGPU ? '🚀 (GPU)' : '💻 (CPU)'}`);
    return true;
    
  } catch (error) {
    console.error(`Failed to switch to ${backendName} backend:`, error);
    return false;
  }
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
  loadTensorFlowForWorker,
  getBackendInfo,
  switchBackend
};