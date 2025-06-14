/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Favicon loading utilities with performance optimizations
 */

import { URLS } from './constants.js';

// Cache for loaded favicons to avoid duplicate requests
const faviconCache = new Map();
const pendingRequests = new Map();

// Configuration
const FAVICON_CONFIG = {
  TIMEOUT: 3000, // 3 second timeout (reduced from 5s)
  PLACEHOLDER_DELAY: 100, // Show placeholder after 100ms
  MAX_RETRIES: 1,
  CACHE_DURATION: 300000 // 5 minutes
};

/**
 * Create optimized favicon element with timeout and fallback handling
 * @param {Object} tab - Tab object with favIconUrl and domain properties
 * @returns {HTMLImageElement} Optimized favicon image element
 */
export function createOptimizedFavicon(tab) {
  const favicon = document.createElement('img');
  favicon.className = 'favicon';
  favicon.style.opacity = '0';
  favicon.style.transition = 'opacity 200ms ease';
  
  // Set initial placeholder
  favicon.src = URLS.DEFAULT_FAVICON;
  favicon.style.opacity = '0.3';
  
  // Load the actual favicon with optimization
  loadFaviconWithTimeout(tab, favicon);
  
  return favicon;
}

/**
 * Load favicon with timeout and caching
 * @param {Object} tab - Tab object
 * @param {HTMLImageElement} favicon - Favicon element to update
 */
async function loadFaviconWithTimeout(tab, favicon) {
  const faviconUrl = getFaviconUrl(tab);
  const cacheKey = faviconUrl;
  
  // Check cache first
  if (faviconCache.has(cacheKey)) {
    const cachedData = faviconCache.get(cacheKey);
    if (Date.now() - cachedData.timestamp < FAVICON_CONFIG.CACHE_DURATION) {
      applyFavicon(favicon, cachedData.url, cachedData.success);
      return;
    } else {
      faviconCache.delete(cacheKey);
    }
  }
  
  // Check if request is already pending
  if (pendingRequests.has(cacheKey)) {
    const result = await pendingRequests.get(cacheKey);
    applyFavicon(favicon, result.url, result.success);
    return;
  }
  
  // Create new request with timeout
  const loadPromise = loadWithTimeout(faviconUrl);
  pendingRequests.set(cacheKey, loadPromise);
  
  try {
    const result = await loadPromise;
    
    // Cache the result
    faviconCache.set(cacheKey, {
      url: result.url,
      success: result.success,
      timestamp: Date.now()
    });
    
    applyFavicon(favicon, result.url, result.success);
  } catch (error) {
    console.warn('Favicon loading failed:', error);
    applyFavicon(favicon, URLS.DEFAULT_FAVICON, false);
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

/**
 * Load favicon with timeout promise
 * @param {string} url - Favicon URL to load
 * @returns {Promise<Object>} Promise resolving to {url, success}
 */
function loadWithTimeout(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeoutId = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error(`Favicon timeout: ${url}`));
    }, FAVICON_CONFIG.TIMEOUT);
    
    img.onload = () => {
      clearTimeout(timeoutId);
      resolve({ url, success: true });
    };
    
    img.onerror = () => {
      clearTimeout(timeoutId);
      // Try fallback with domain only
      const fallbackUrl = getFallbackFaviconUrl(url);
      if (fallbackUrl && fallbackUrl !== url) {
        // Retry with fallback
        loadWithTimeout(fallbackUrl)
          .then(resolve)
          .catch(() => resolve({ url: URLS.DEFAULT_FAVICON, success: false }));
      } else {
        resolve({ url: URLS.DEFAULT_FAVICON, success: false });
      }
    };
    
    img.src = url;
  });
}

/**
 * Apply favicon to element with smooth transition
 * @param {HTMLImageElement} favicon - Favicon element
 * @param {string} url - URL to set
 * @param {boolean} success - Whether the load was successful
 */
function applyFavicon(favicon, url, success) {
  favicon.src = url;
  favicon.style.opacity = success ? '1' : '0.5';
  
  // Add loading state classes for CSS styling
  if (success) {
    favicon.classList.remove('favicon-failed');
    favicon.classList.add('favicon-loaded');
  } else {
    favicon.classList.remove('favicon-loaded');
    favicon.classList.add('favicon-failed');
  }
}

/**
 * Get favicon URL with preference for tab's existing favicon
 * @param {Object} tab - Tab object
 * @returns {string} Favicon URL
 */
function getFaviconUrl(tab) {
  // Prefer Chrome's native favicon if available and valid
  if (tab.favIconUrl && isValidFaviconUrl(tab.favIconUrl)) {
    return tab.favIconUrl;
  }
  
  // Fallback to Google's favicon service
  if (tab.domain) {
    return URLS.FAVICON_API.replace('{domain}', tab.domain);
  }
  
  // Extract domain from URL if not provided
  try {
    const domain = new URL(tab.url).hostname;
    return URLS.FAVICON_API.replace('{domain}', domain);
  } catch {
    return URLS.DEFAULT_FAVICON;
  }
}

/**
 * Get fallback favicon URL for failed loads
 * @param {string} originalUrl - Original favicon URL that failed
 * @returns {string|null} Fallback URL or null if no fallback available
 */
function getFallbackFaviconUrl(originalUrl) {
  // If it was already a Google favicon service URL, try with 'default'
  if (originalUrl.includes('google.com/s2/favicons')) {
    return URLS.FAVICON_API.replace('{domain}', 'google.com');
  }
  
  // If it was a direct favicon URL, try Google's service
  try {
    const url = new URL(originalUrl);
    const domain = url.hostname;
    return URLS.FAVICON_API.replace('{domain}', domain);
  } catch {
    return null;
  }
}

/**
 * Check if a favicon URL is valid and likely to work
 * @param {string} url - URL to validate
 * @returns {boolean} Whether the URL is valid
 */
function isValidFaviconUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url);
    // Exclude chrome:// URLs and other internal schemes
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:' || urlObj.protocol === 'data:';
  } catch {
    return false;
  }
}

/**
 * Preload favicons for better performance
 * @param {Array} tabs - Array of tab objects to preload favicons for
 */
export function preloadFavicons(tabs) {
  const uniqueUrls = new Set();
  
  tabs.forEach(tab => {
    const url = getFaviconUrl(tab);
    if (url !== URLS.DEFAULT_FAVICON && !faviconCache.has(url)) {
      uniqueUrls.add(url);
    }
  });
  
  // Limit concurrent preload requests
  const maxConcurrent = 5;
  const urlArray = Array.from(uniqueUrls);
  
  for (let i = 0; i < Math.min(maxConcurrent, urlArray.length); i++) {
    const url = urlArray[i];
    if (!pendingRequests.has(url)) {
      const loadPromise = loadWithTimeout(url);
      pendingRequests.set(url, loadPromise);
      
      loadPromise
        .then(result => {
          faviconCache.set(url, {
            url: result.url,
            success: result.success,
            timestamp: Date.now()
          });
        })
        .catch(() => {
          // Ignore preload errors
        })
        .finally(() => {
          pendingRequests.delete(url);
        });
    }
  }
}

/**
 * Clear favicon cache (useful for testing or memory management)
 */
export function clearFaviconCache() {
  faviconCache.clear();
  // Don't clear pending requests as they're in flight
}

/**
 * Get cache statistics for debugging
 * @returns {Object} Cache statistics
 */
export function getFaviconCacheStats() {
  return {
    cacheSize: faviconCache.size,
    pendingRequests: pendingRequests.size,
    cacheEntries: Array.from(faviconCache.keys())
  };
}