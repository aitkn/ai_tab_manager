/*
 * AI Tab Manager - Copyright (c) 2024 AI Tech Knowledge LLC
 * Proprietary License - See LICENSE file
 * support@aitkn.com
 */

// IndexedDB database for storing categorized tabs

const DB_NAME = 'TabManagerDB';
const DB_VERSION = 1;
const STORE_NAME = 'savedTabs';

class TabDatabase {
  constructor() {
    this.db = null;
  }

  // Initialize the database
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          
          // Create indexes for searching
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('category', 'category', { unique: false });
        }
      };
    });
  }

  // Save categorized tabs to database (excluding category 1)
  async saveTabs(categorizedTabs, metadata = {}) {
    const transaction = this.db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Only save category 2 and 3 tabs
    const tabsToSave = {
      1: [], // Empty - we don't save "can be closed" tabs
      2: categorizedTabs[2] || [],
      3: categorizedTabs[3] || []
    };
    
    const tabCollection = {
      timestamp: new Date().toISOString(),
      savedAt: Date.now(),
      categorizedTabs: tabsToSave,
      metadata: {
        totalTabs: tabsToSave[2].length + tabsToSave[3].length,
        category1Count: 0, // Always 0 since we don't save these
        category2Count: tabsToSave[2].length,
        category3Count: tabsToSave[3].length,
        originalCategory1Count: categorizedTabs[1].length, // Track how many were not saved
        ...metadata
      }
    };

    return new Promise((resolve, reject) => {
      const request = store.add(tabCollection);
      
      request.onsuccess = () => {
        resolve(request.result); // Returns the ID of the saved record
      };
      
      request.onerror = () => {
        reject(new Error('Failed to save tabs'));
      };
    });
  }

  // Get all saved tab collections
  async getAllSavedTabs() {
    const transaction = this.db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        // Sort by timestamp, newest first
        const results = request.result.sort((a, b) => b.savedAt - a.savedAt);
        resolve(results);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to retrieve saved tabs'));
      };
    });
  }

  // Get a specific saved tab collection by ID
  async getSavedTabs(id) {
    const transaction = this.db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to retrieve tabs'));
      };
    });
  }

  // Delete a saved tab collection
  async deleteSavedTabs(id) {
    const transaction = this.db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error('Failed to delete tabs'));
      };
    });
  }

  // Search saved tabs by date range
  async searchByDateRange(startDate, endDate) {
    const transaction = this.db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    
    const range = IDBKeyRange.bound(startDate, endDate);
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(range);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to search tabs'));
      };
    });
  }

  // Export saved tabs as JSON (for backup)
  async exportAsJSON(id) {
    const tabCollection = await this.getSavedTabs(id);
    if (!tabCollection) {
      throw new Error('Tab collection not found');
    }
    
    return JSON.stringify(tabCollection, null, 2);
  }

  // Export saved tabs as Markdown (for sharing)
  async exportAsMarkdown(id) {
    const tabCollection = await this.getSavedTabs(id);
    if (!tabCollection) {
      throw new Error('Tab collection not found');
    }
    
    let markdown = `# Saved Tabs\n\n`;
    markdown += `Saved on: ${new Date(tabCollection.timestamp).toLocaleString()}\n\n`;
    markdown += `Total tabs: ${tabCollection.metadata.totalTabs}\n\n`;
    
    // Category 3: Important
    if (tabCollection.categorizedTabs[3].length > 0) {
      markdown += `## 🌟 Important (${tabCollection.categorizedTabs[3].length})\n\n`;
      markdown += this._formatTabsAsMarkdown(tabCollection.categorizedTabs[3]);
    }
    
    // Category 2: Somewhat Important
    if (tabCollection.categorizedTabs[2].length > 0) {
      markdown += `## 📌 Save for Later (${tabCollection.categorizedTabs[2].length})\n\n`;
      markdown += this._formatTabsAsMarkdown(tabCollection.categorizedTabs[2]);
    }
    
    // Category 1: Not Important
    if (tabCollection.categorizedTabs[1].length > 0) {
      markdown += `## 🗑️ Can Be Closed (${tabCollection.categorizedTabs[1].length})\n\n`;
      markdown += this._formatTabsAsMarkdown(tabCollection.categorizedTabs[1]);
    }
    
    return markdown;
  }

  _formatTabsAsMarkdown(tabs) {
    // Group by domain
    const grouped = {};
    tabs.forEach(tab => {
      if (!grouped[tab.domain]) {
        grouped[tab.domain] = [];
      }
      grouped[tab.domain].push(tab);
    });
    
    let markdown = '';
    Object.keys(grouped).sort().forEach(domain => {
      markdown += `### ${domain}\n\n`;
      grouped[domain].forEach(tab => {
        markdown += `- [${tab.title}](${tab.url})\n`;
      });
      markdown += '\n';
    });
    
    return markdown;
  }

  // Get database statistics
  async getStats() {
    const allTabs = await this.getAllSavedTabs();
    
    let totalTabs = 0;
    let totalCollections = allTabs.length;
    let categoryCounts = { 1: 0, 2: 0, 3: 0 };
    
    allTabs.forEach(collection => {
      totalTabs += collection.metadata.totalTabs;
      categoryCounts[1] += collection.metadata.category1Count;
      categoryCounts[2] += collection.metadata.category2Count;
      categoryCounts[3] += collection.metadata.category3Count;
    });
    
    return {
      totalCollections,
      totalTabs,
      categoryCounts,
      oldestSave: allTabs.length > 0 ? allTabs[allTabs.length - 1].timestamp : null,
      newestSave: allTabs.length > 0 ? allTabs[0].timestamp : null
    };
  }
}

// Export a singleton instance
const tabDatabase = new TabDatabase();