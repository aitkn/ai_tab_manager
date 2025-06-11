/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Chrome API wrapper service for centralized API access
 */

/**
 * ChromeAPIService - Wrapper for all Chrome Extension APIs
 * Provides Promise-based interface and error handling
 */
export class ChromeAPIService {
  
  // === Tab Management ===
  
  /**
   * Get all tabs matching query
   * @param {Object} queryInfo - Chrome tabs query object
   * @returns {Promise<Array>} Array of tabs
   */
  static async queryTabs(queryInfo = {}) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.query(queryInfo, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(tabs);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Get current window tabs
   * @returns {Promise<Array>} Array of tabs in current window
   */
  static async getCurrentWindowTabs() {
    return this.queryTabs({ currentWindow: true });
  }
  
  /**
   * Get all tabs from all windows
   * @returns {Promise<Array>} Array of all tabs
   */
  static async getAllTabs() {
    return this.queryTabs({});
  }
  
  /**
   * Create a new tab
   * @param {Object} createProperties - Tab creation properties
   * @returns {Promise<Object>} Created tab object
   */
  static async createTab(createProperties) {
    return new Promise((resolve, reject) => {
      chrome.tabs.create(createProperties, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(tab);
        }
      });
    });
  }
  
  /**
   * Remove tabs by IDs
   * @param {number|Array<number>} tabIds - Tab ID(s) to remove
   * @returns {Promise<void>}
   */
  static async removeTabs(tabIds) {
    return new Promise((resolve, reject) => {
      chrome.tabs.remove(tabIds, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Update a tab
   * @param {number} tabId - Tab ID to update
   * @param {Object} updateProperties - Properties to update
   * @returns {Promise<Object>} Updated tab object
   */
  static async updateTab(tabId, updateProperties) {
    return new Promise((resolve, reject) => {
      chrome.tabs.update(tabId, updateProperties, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(tab);
        }
      });
    });
  }
  
  // === Storage Management ===
  
  /**
   * Get items from Chrome storage
   * @param {string|Array<string>|null} keys - Keys to retrieve (null for all)
   * @returns {Promise<Object>} Storage items
   */
  static async getStorageData(keys = null) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }
  
  /**
   * Set items in Chrome storage
   * @param {Object} items - Items to store
   * @returns {Promise<void>}
   */
  static async setStorageData(items) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Remove items from Chrome storage
   * @param {string|Array<string>} keys - Keys to remove
   * @returns {Promise<void>}
   */
  static async removeStorageData(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Clear all Chrome storage
   * @returns {Promise<void>}
   */
  static async clearStorage() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
  
  // === Runtime Messaging ===
  
  /**
   * Send message to background script
   * @param {Object} message - Message to send
   * @returns {Promise<any>} Response from background script
   */
  static async sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }
  
  /**
   * Get extension URL
   * @param {string} path - Path within extension
   * @returns {string} Full URL
   */
  static getURL(path) {
    return chrome.runtime.getURL(path);
  }
  
  // === Bookmarks Management ===
  
  /**
   * Create a bookmark
   * @param {Object} bookmark - Bookmark details
   * @returns {Promise<Object>} Created bookmark
   */
  static async createBookmark(bookmark) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.create(bookmark, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }
  
  // === Windows Management ===
  
  /**
   * Get current window
   * @returns {Promise<Object>} Current window object
   */
  static async getCurrentWindow() {
    return new Promise((resolve, reject) => {
      chrome.windows.getCurrent((window) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(window);
        }
      });
    });
  }
  
  // === Utility Methods ===
  
  /**
   * Check if running in extension context
   * @returns {boolean} True if chrome.runtime is available
   */
  static isExtensionContext() {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  }
  
  /**
   * Get the current extension ID
   * @returns {string|null} Extension ID or null if not in extension context
   */
  static getExtensionId() {
    return chrome.runtime && chrome.runtime.id ? chrome.runtime.id : null;
  }
  
  /**
   * Get full extension URL for a resource
   * @param {string} path - Resource path (e.g., 'popup.html')
   * @returns {string|null} Full extension URL or null if not in extension context
   */
  static getExtensionURL(path = '') {
    return chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL(path) : null;
  }
  
  /**
   * Get last error message
   * @returns {string|null} Error message or null
   */
  static getLastError() {
    return chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
  }
  
  /**
   * Batch create tabs with rate limiting
   * @param {Array<string>} urls - URLs to open
   * @param {number} batchSize - Number of tabs per batch
   * @param {number} delayMs - Delay between batches
   * @returns {Promise<Array>} Created tabs
   */
  static async batchCreateTabs(urls, batchSize = 10, delayMs = 100) {
    const results = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchPromises = batch.map(url => this.createTab({ url }));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error('Error creating batch of tabs:', error);
      }
      
      // Delay between batches
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return results;
  }
}

// Export as default as well for convenience
export default ChromeAPIService;