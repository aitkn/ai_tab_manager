/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Proprietary License - See LICENSE file
 * support@aitkn.com
 */

// IndexedDB database for storing categorized tabs - Version 2
// This version stores tabs individually for better flexibility

const DB_NAME = 'TabManagerDB';
const DB_VERSION = 2; // Increment version for schema change
const TABS_STORE = 'savedTabs';
const COLLECTIONS_STORE = 'collections'; // Keep for backward compatibility

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
        
        // Create new tabs store if it doesn't exist
        if (!db.objectStoreNames.contains(TABS_STORE)) {
          const tabStore = db.createObjectStore(TABS_STORE, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          
          // Create indexes for searching and grouping
          tabStore.createIndex('savedAt', 'savedAt', { unique: false });
          tabStore.createIndex('category', 'category', { unique: false });
          tabStore.createIndex('domain', 'domain', { unique: false });
          tabStore.createIndex('url', 'url', { unique: false });
        }
        
        // Keep old collections store for migration
        if (db.objectStoreNames.contains(COLLECTIONS_STORE)) {
          // Migrate old data if needed
          this.migrateOldData(event);
        }
      };
    });
  }

  // Migrate data from old collections format to individual tabs
  async migrateOldData(event) {
    const transaction = event.target.transaction;
    const oldStore = transaction.objectStore(COLLECTIONS_STORE);
    const newStore = transaction.objectStore(TABS_STORE);
    
    const getAllRequest = oldStore.getAll();
    
    getAllRequest.onsuccess = () => {
      const collections = getAllRequest.result;
      
      collections.forEach(collection => {
        // Extract tabs from each collection
        Object.entries(collection.categorizedTabs).forEach(([category, tabs]) => {
          tabs.forEach(tab => {
            // Save each tab individually
            newStore.add({
              ...tab,
              category: parseInt(category),
              savedAt: collection.savedAt,
              savedDate: new Date(collection.savedAt).toISOString(),
              metadata: {
                provider: collection.metadata.provider,
                model: collection.metadata.model,
                closedAfterSave: collection.metadata.closedAfterSave
              }
            });
          });
        });
      });
    };
  }

  // Save tabs to database (excluding category 1)
  async saveTabs(categorizedTabs, metadata = {}) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    // First, check for existing duplicates
    const existingTabs = await this.getAllSavedTabs();
    const urlToExistingTab = new Map();
    existingTabs.forEach(tab => {
      urlToExistingTab.set(tab.url, tab);
    });
    
    const transaction = this.db.transaction([TABS_STORE], 'readwrite');
    const store = transaction.objectStore(TABS_STORE);
    
    const savedAt = Date.now();
    const savedDate = new Date(savedAt).toISOString();
    const promises = [];
    let savedCount = 0;
    let skippedCount = 0;
    
    // Only save category 2 and 3 tabs
    [2, 3].forEach(category => {
      if (categorizedTabs[category]) {
        categorizedTabs[category].forEach(tab => {
          // Check if this URL already exists
          const existingTab = urlToExistingTab.get(tab.url);
          
          if (existingTab) {
            // Skip if it already exists with same or higher priority category
            // Category 3 (Important) > Category 2 (Save for Later)
            if (existingTab.category >= category) {
              console.log(`Skipping duplicate: ${tab.url} (already saved in category ${existingTab.category})`);
              skippedCount++;
              return;
            } else {
              // Update existing tab to higher priority category
              console.log(`Updating category for: ${tab.url} from ${existingTab.category} to ${category}`);
              const updateRequest = store.put({
                ...existingTab,
                category,
                savedAt,
                savedDate,
                metadata: {
                  ...metadata,
                  updatedAt: savedAt
                }
              });
              promises.push(new Promise((resolve, reject) => {
                updateRequest.onsuccess = () => resolve(updateRequest.result);
                updateRequest.onerror = (event) => reject(new Error(`Failed to update tab: ${event.target.error}`));
              }));
              savedCount++;
              return;
            }
          }
          
          const tabToSave = {
            ...tab,
            category,
            savedAt,
            savedDate,
            metadata: {
              ...metadata,
              originalTabId: tab.id // Store original tab ID
            }
          };
          
          // Remove the id field to let IndexedDB auto-generate it
          delete tabToSave.id;
          
          const request = store.add(tabToSave);
          savedCount++;
          promises.push(new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => {
              console.error('Failed to save tab:', event.target.error);
              reject(new Error(`Failed to save tab: ${event.target.error}`));
            };
          }));
        });
      }
    });
    
    console.log(`Saving ${savedCount} tabs, skipping ${skippedCount} duplicates...`);
    return Promise.all(promises);
  }

  // Get all saved tabs
  async getAllSavedTabs() {
    const transaction = this.db.transaction([TABS_STORE], 'readonly');
    const store = transaction.objectStore(TABS_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        // Sort by saved date, newest first
        const results = request.result.sort((a, b) => b.savedAt - a.savedAt);
        resolve(results);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to retrieve saved tabs'));
      };
    });
  }

  // Get tabs by category
  async getTabsByCategory(category) {
    const transaction = this.db.transaction([TABS_STORE], 'readonly');
    const store = transaction.objectStore(TABS_STORE);
    const index = store.index('category');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(category);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to retrieve tabs by category'));
      };
    });
  }

  // Get tabs by domain
  async getTabsByDomain(domain) {
    const transaction = this.db.transaction([TABS_STORE], 'readonly');
    const store = transaction.objectStore(TABS_STORE);
    const index = store.index('domain');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(domain);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to retrieve tabs by domain'));
      };
    });
  }

  // Delete a saved tab
  async deleteSavedTab(id) {
    const transaction = this.db.transaction([TABS_STORE], 'readwrite');
    const store = transaction.objectStore(TABS_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error('Failed to delete tab'));
      };
    });
  }

  // Delete multiple tabs
  async deleteMultipleTabs(ids) {
    const transaction = this.db.transaction([TABS_STORE], 'readwrite');
    const store = transaction.objectStore(TABS_STORE);
    
    const promises = ids.map(id => {
      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to delete tab ${id}`));
      });
    });
    
    return Promise.all(promises);
  }

  // Search tabs by query
  async searchTabs(query) {
    const allTabs = await this.getAllSavedTabs();
    const lowerQuery = query.toLowerCase();
    
    return allTabs.filter(tab => 
      tab.title.toLowerCase().includes(lowerQuery) ||
      tab.url.toLowerCase().includes(lowerQuery) ||
      tab.domain.toLowerCase().includes(lowerQuery)
    );
  }

  // Export tabs as JSON
  async exportAsJSON(tabIds = null) {
    let tabs;
    if (tabIds) {
      tabs = await this.getTabsByIds(tabIds);
    } else {
      tabs = await this.getAllSavedTabs();
    }
    
    return JSON.stringify(tabs, null, 2);
  }

  // Export tabs as Markdown
  async exportAsMarkdown(tabIds = null) {
    let tabs;
    if (tabIds) {
      tabs = await this.getTabsByIds(tabIds);
    } else {
      tabs = await this.getAllSavedTabs();
    }
    
    let markdown = `# Saved Tabs\n\n`;
    markdown += `Exported on: ${new Date().toLocaleString()}\n\n`;
    markdown += `Total tabs: ${tabs.length}\n\n`;
    
    // Group by category for export
    const byCategory = { 2: [], 3: [] };
    tabs.forEach(tab => {
      if (byCategory[tab.category]) {
        byCategory[tab.category].push(tab);
      }
    });
    
    // Category 3: Important
    if (byCategory[3].length > 0) {
      markdown += `## 🌟 Important (${byCategory[3].length})\n\n`;
      markdown += this._formatTabsAsMarkdown(byCategory[3]);
    }
    
    // Category 2: Save for Later
    if (byCategory[2].length > 0) {
      markdown += `## 📌 Save for Later (${byCategory[2].length})\n\n`;
      markdown += this._formatTabsAsMarkdown(byCategory[2]);
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
        markdown += `- [${tab.title}](${tab.url})`;
        markdown += ` - Saved: ${new Date(tab.savedAt).toLocaleDateString()}\n`;
      });
      markdown += '\n';
    });
    
    return markdown;
  }

  // Get tabs by IDs
  async getTabsByIds(ids) {
    const transaction = this.db.transaction([TABS_STORE], 'readonly');
    const store = transaction.objectStore(TABS_STORE);
    
    const promises = ids.map(id => {
      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`Failed to get tab ${id}`));
      });
    });
    
    const results = await Promise.all(promises);
    return results.filter(tab => tab !== undefined);
  }

  // Get database statistics
  async getStats() {
    const allTabs = await this.getAllSavedTabs();
    
    const stats = {
      totalTabs: allTabs.length,
      byCategory: { 2: 0, 3: 0 },
      byDomain: {},
      oldestSave: null,
      newestSave: null
    };
    
    allTabs.forEach(tab => {
      // Count by category
      if (stats.byCategory[tab.category] !== undefined) {
        stats.byCategory[tab.category]++;
      }
      
      // Count by domain
      if (!stats.byDomain[tab.domain]) {
        stats.byDomain[tab.domain] = 0;
      }
      stats.byDomain[tab.domain]++;
    });
    
    if (allTabs.length > 0) {
      stats.oldestSave = new Date(allTabs[allTabs.length - 1].savedAt);
      stats.newestSave = new Date(allTabs[0].savedAt);
    }
    
    return stats;
  }
}

// Export a singleton instance
const tabDatabase = new TabDatabase();