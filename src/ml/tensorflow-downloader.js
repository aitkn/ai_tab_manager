/*
 * AI Tab Manager - TensorFlow.js Downloader
 * Downloads and caches TensorFlow.js library after installation
 */

import StorageService from '../services/StorageService.js';

const TENSORFLOW_VERSION = '4.17.0';
const TENSORFLOW_URL = `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@${TENSORFLOW_VERSION}/dist/tf.min.js`;
const STORAGE_KEY = 'tensorflow_library';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Download TensorFlow.js library
 */
export async function downloadTensorFlow() {
  try {
    console.log('Downloading TensorFlow.js...');
    
    // Fetch the library
    const response = await fetch(TENSORFLOW_URL);
    if (!response.ok) {
      throw new Error(`Failed to download TensorFlow.js: ${response.status}`);
    }
    
    const scriptContent = await response.text();
    
    // Store in local storage
    await StorageService.setLocal(STORAGE_KEY, {
      version: TENSORFLOW_VERSION,
      content: scriptContent,
      downloadedAt: Date.now()
    });
    
    console.log('TensorFlow.js downloaded successfully');
    return scriptContent;
    
  } catch (error) {
    console.error('Error downloading TensorFlow.js:', error);
    throw error;
  }
}

/**
 * Get cached TensorFlow.js
 */
export async function getCachedTensorFlow() {
  try {
    const cached = await StorageService.getLocal(STORAGE_KEY);
    
    if (!cached) {
      return null;
    }
    
    // Check if cache is still valid
    const age = Date.now() - cached.downloadedAt;
    if (age > CACHE_DURATION) {
      console.log('TensorFlow.js cache expired');
      return null;
    }
    
    // Check version
    if (cached.version !== TENSORFLOW_VERSION) {
      console.log('TensorFlow.js version mismatch, need to re-download');
      return null;
    }
    
    return cached.content;
    
  } catch (error) {
    console.error('Error getting cached TensorFlow.js:', error);
    return null;
  }
}

/**
 * Clear cached TensorFlow.js
 */
export async function clearTensorFlowCache() {
  await StorageService.removeLocal(STORAGE_KEY);
}

/**
 * Check if TensorFlow.js is downloaded
 */
export async function isTensorFlowDownloaded() {
  const cached = await getCachedTensorFlow();
  return cached !== null;
}

/**
 * Get download status
 */
export async function getTensorFlowStatus() {
  try {
    const cached = await StorageService.getLocal(STORAGE_KEY);
    
    if (!cached) {
      return {
        downloaded: false,
        version: null,
        size: 0,
        age: null
      };
    }
    
    return {
      downloaded: true,
      version: cached.version,
      size: cached.content.length,
      age: Date.now() - cached.downloadedAt,
      downloadedAt: new Date(cached.downloadedAt).toLocaleString()
    };
    
  } catch (error) {
    return {
      downloaded: false,
      error: error.message
    };
  }
}