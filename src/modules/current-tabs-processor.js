/**
 * Current Tabs Processor
 * Handles fetching current tabs from browser and matching with database
 */

import { TAB_CATEGORIES } from '../utils/constants.js';
import { ChromeAPIService } from '../services/ChromeAPIService.js';
import { extractDomain } from '../utils/helpers.js';

export class CurrentTabsProcessor {
  constructor(database) {
    this.database = database;
  }

  /**
   * Get all current tabs with category information from database
   * @returns {Promise<{categorizedTabs: Object, urlToDuplicateIds: Object}>}
   */
  async getCurrentTabsWithCategories() {
    try {
      // 1. Get all open tabs from browser
      const allTabs = await chrome.tabs.query({});
      
      // Debug: Log windows
      const windowIds = new Set(allTabs.map(tab => tab.windowId));
      
      // 2. Get all saved URLs from database for matching
      const savedUrls = await this.database.getSavedUrls([1, 2, 3]); // All categories
      const urlToCategoryMap = new Map();
      
      // Build lookup map with URL as key
      savedUrls.forEach(urlInfo => {
        // Use URL only for matching (one entry per URL)
        urlToCategoryMap.set(urlInfo.url, {
          category: urlInfo.category,
          urlId: urlInfo.id,
          savedTitle: urlInfo.title // Keep saved title for reference
        });
      });
      
      // 3. Initialize categorized tabs structure
      const categorizedTabs = {
        [TAB_CATEGORIES.UNCATEGORIZED]: [],
        [TAB_CATEGORIES.CAN_CLOSE]: [],
        [TAB_CATEGORIES.SAVE_LATER]: [],
        [TAB_CATEGORIES.IMPORTANT]: []
      };
      
      const urlToDuplicateIds = {};
      const urlToTabsMap = new Map(); // For duplicate detection
      
      // 4. Process each tab
      for (const tab of allTabs) {
        if (!tab.url) {
          continue;
        }
        
        // Exclude the extension's own tabs to prevent closing the extension itself
        const extensionId = ChromeAPIService.getExtensionId();
        const extensionPopupUrl = ChromeAPIService.getExtensionURL('popup.html');
        
        if (extensionId && extensionPopupUrl && tab.url === extensionPopupUrl) {
          console.log('🚫 Excluding extension tab from tab list:', tab.url);
          continue;
        }
        
        // Check if saved in database (by URL only)
        const savedInfo = urlToCategoryMap.get(tab.url);
        const category = savedInfo ? savedInfo.category : TAB_CATEGORIES.UNCATEGORIZED;
        
        // Create tab entry
        const tabEntry = {
          id: tab.id,
          url: tab.url,
          title: tab.title || 'Loading...',
          favIconUrl: tab.favIconUrl || this.getDefaultFavicon(tab.url),
          windowId: tab.windowId,
          index: tab.index,
          pinned: tab.pinned,
          audible: tab.audible,
          mutedInfo: tab.mutedInfo,
          lastAccessed: Date.now(),
          domain: extractDomain(tab.url)
        };
        
        // Mark as saved if found in database
        if (savedInfo) {
          tabEntry.alreadySaved = true;
        }
        
        // Track duplicates
        if (!urlToTabsMap.has(tab.url)) {
          urlToTabsMap.set(tab.url, []);
        }
        urlToTabsMap.get(tab.url).push(tab.id);
        
        // Check if this URL already exists in the category
        const existingIndex = categorizedTabs[category].findIndex(t => t.url === tab.url);
        
        if (existingIndex !== -1) {
          // URL already exists - add to duplicates
          const existingTab = categorizedTabs[category][existingIndex];
          if (!existingTab.duplicateIds) {
            existingTab.duplicateIds = [existingTab.id];
          }
          existingTab.duplicateIds.push(tab.id);
          existingTab.duplicateCount = existingTab.duplicateIds.length;
        } else {
          // New URL in this category
          categorizedTabs[category].push(tabEntry);
        }
      }
      
      // 5. Build duplicate mapping
      urlToTabsMap.forEach((tabIds, url) => {
        if (tabIds.length > 1) {
          urlToDuplicateIds[url] = tabIds;
        }
      });
      
      // Removed categorization summary log
      
      return { categorizedTabs, urlToDuplicateIds };
      
    } catch (error) {
      console.error('Error processing current tabs:', error);
      return { 
        categorizedTabs: {
          [TAB_CATEGORIES.UNCATEGORIZED]: [],
          [TAB_CATEGORIES.CAN_CLOSE]: [],
          [TAB_CATEGORIES.SAVE_LATER]: [],
          [TAB_CATEGORIES.IMPORTANT]: []
        }, 
        urlToDuplicateIds: {} 
      };
    }
  }
  
  /**
   * Get default favicon for a URL
   */
  getDefaultFavicon(url) {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return '';
    }
  }
  
  /**
   * Handle real-time tab updates
   */
  setupTabEventListeners(onTabChange) {
    // Listen for tab changes from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'tabChanged' && onTabChange) {
        onTabChange(message.data);
      }
    });
    
    // Also set up port connection for real-time updates
    const port = chrome.runtime.connect({ name: 'popup' });
    port.onMessage.addListener((message) => {
      if (message.action === 'tabChanged' && onTabChange) {
        onTabChange(message.data);
      }
    });
    
    return port;
  }
}