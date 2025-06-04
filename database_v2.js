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

  // Export tabs as CSV
  async exportAsCSV(tabIds = null) {
    let tabs;
    if (tabIds) {
      tabs = await this.getTabsByIds(tabIds);
    } else {
      tabs = await this.getAllSavedTabs();
    }
    
    // CSV header - now includes both timestamps
    const headers = ['Title', 'URL', 'Domain', 'Category', 'Saved Date', 'Saved Time', 'Last Accessed Date', 'Last Accessed Time'];
    const rows = [headers];
    
    tabs.forEach(tab => {
      const savedDate = new Date(tab.savedAt);
      const savedDateStr = savedDate.toLocaleDateString();
      const savedTimeStr = savedDate.toLocaleTimeString();
      
      // Handle lastAccessed timestamp
      let lastAccessedDateStr = '';
      let lastAccessedTimeStr = '';
      if (tab.lastAccessed) {
        const lastAccessedDate = new Date(tab.lastAccessed);
        lastAccessedDateStr = lastAccessedDate.toLocaleDateString();
        lastAccessedTimeStr = lastAccessedDate.toLocaleTimeString();
      }
      
      const categoryName = tab.category === 3 ? 'Important' : 'Save for Later';
      
      // Escape fields that might contain commas or quotes
      const escapeCSV = (field) => {
        if (field === null || field === undefined) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      rows.push([
        escapeCSV(tab.title),
        escapeCSV(tab.url),
        escapeCSV(tab.domain),
        escapeCSV(categoryName),
        escapeCSV(savedDateStr),
        escapeCSV(savedTimeStr),
        escapeCSV(lastAccessedDateStr),
        escapeCSV(lastAccessedTimeStr)
      ]);
    });
    
    return rows.map(row => row.join(',')).join('\n');
  }

  // Import tabs from CSV
  async importFromCSV(csvContent, settings = {}) {
    if (!csvContent || typeof csvContent !== 'string') {
      throw new Error('Invalid CSV content');
    }
    
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must contain headers and at least one data row');
    }
    
    // Parse CSV (simple parser, handles basic escaping)
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++; // Skip next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current);
      
      return result;
    };
    
    // Parse header to find column indices
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const titleIdx = headers.findIndex(h => h.includes('title'));
    const urlIdx = headers.findIndex(h => h.includes('url'));
    const domainIdx = headers.findIndex(h => h.includes('domain'));
    const categoryIdx = headers.findIndex(h => h.includes('category'));
    const dateIdx = headers.findIndex(h => h.includes('saved') && h.includes('date'));
    const savedIdx = headers.findIndex(h => h === 'saved' || (h.includes('saved') && !h.includes('date') && !h.includes('time')));
    const lastAccessedDateIdx = headers.findIndex(h => h.includes('accessed') && h.includes('date'));
    const lastAccessedTimeIdx = headers.findIndex(h => h.includes('accessed') && h.includes('time'));
    const lastAccessedIdx = headers.findIndex(h => h === 'last accessed' || h === 'lastaccessed' || (h.includes('accessed') && !h.includes('date') && !h.includes('time')));
    
    if (titleIdx === -1 || urlIdx === -1) {
      throw new Error('CSV must contain at least Title and URL columns');
    }
    
    // Get existing tabs to check for duplicates
    const existingTabs = await this.getAllSavedTabs();
    const existingUrls = new Set(existingTabs.map(tab => tab.url));
    
    // Process data rows
    const tabsToImport = [];
    const tabsNeedingCategorization = [];
    const duplicates = [];
    const urlToProcessedTab = new Map(); // Track all processed tabs by URL
    
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 2) continue; // Skip empty rows
      
      const url = row[urlIdx]?.trim();
      const title = row[titleIdx]?.trim() || 'Untitled';
      
      if (!url) continue; // Skip rows without URL
      
      // Check for duplicates - skip ALL saved URLs regardless of category
      if (existingUrls.has(url)) {
        duplicates.push({ title, url });
        continue; // Skip this URL entirely - it's already saved
      }
      
      // Parse domain
      let domain = 'unknown';
      if (domainIdx !== -1 && row[domainIdx]) {
        domain = row[domainIdx].trim();
      } else {
        // Extract domain from URL
        try {
          if (url.startsWith('http')) {
            domain = new URL(url).hostname;
          }
        } catch (e) {
          // Keep 'unknown' as domain
        }
      }
      
      // Parse category
      let category = null;
      if (categoryIdx !== -1 && row[categoryIdx]) {
        const catStr = row[categoryIdx].toLowerCase().trim();
        if (catStr.includes('important') || catStr === '3') {
          category = 3;
        } else if (catStr.includes('save') || catStr.includes('later') || catStr === '2') {
          category = 2;
        }
      }
      
      // Parse saved date/timestamp
      let savedAt = Date.now();
      // First check for single "Saved" timestamp column
      if (savedIdx !== -1 && row[savedIdx]) {
        const parsedDate = new Date(row[savedIdx]);
        if (!isNaN(parsedDate.getTime())) {
          savedAt = parsedDate.getTime();
        }
      } else if (dateIdx !== -1 && row[dateIdx]) {
        // Fall back to separate date column
        const parsedDate = new Date(row[dateIdx]);
        if (!isNaN(parsedDate.getTime())) {
          savedAt = parsedDate.getTime();
        }
      }
      
      // Parse last accessed date/timestamp
      let lastAccessed = null;
      // First check for single "Last Accessed" timestamp column
      if (lastAccessedIdx !== -1 && row[lastAccessedIdx]) {
        const parsedDate = new Date(row[lastAccessedIdx]);
        if (!isNaN(parsedDate.getTime())) {
          lastAccessed = parsedDate.getTime();
        }
      } else if (lastAccessedDateIdx !== -1 && row[lastAccessedDateIdx]) {
        // Fall back to separate date/time columns
        let dateTimeStr = row[lastAccessedDateIdx];
        // If we have a separate time column, combine them
        if (lastAccessedTimeIdx !== -1 && row[lastAccessedTimeIdx]) {
          dateTimeStr += ' ' + row[lastAccessedTimeIdx];
        }
        const parsedDate = new Date(dateTimeStr);
        if (!isNaN(parsedDate.getTime())) {
          lastAccessed = parsedDate.getTime();
        }
      }
      
      const tab = {
        title,
        url,
        domain,
        savedAt,
        savedDate: new Date(savedAt).toISOString(),
        metadata: {
          importedAt: Date.now(),
          source: 'csv'
        }
      };
      
      // Include lastAccessed if available
      if (lastAccessed) {
        tab.lastAccessed = lastAccessed;
      }
      
      // Track this tab by URL to prevent duplicates after categorization
      urlToProcessedTab.set(url, tab);
      
      if (category) {
        tab.category = category;
        tabsToImport.push(tab);
      } else {
        // Format tab for categorization to match what the AI expects
        const tabForCategorization = {
          id: i, // Use row index as ID for categorization
          title: title,
          url: url,
          domain: domain,
          windowId: 0, // Dummy window ID
          lastAccessed: lastAccessed || savedAt
        };
        tabsNeedingCategorization.push(tabForCategorization);
      }
    }
    
    // If we have tabs needing categorization, categorize them
    let categorizationResults = null;
    if (tabsNeedingCategorization.length > 0 && settings.apiKey && settings.provider && settings.model) {
      try {
        console.log(`Categorizing ${tabsNeedingCategorization.length} imported tabs...`);
        console.log('Tabs needing categorization:', tabsNeedingCategorization.map(t => ({ title: t.title.substring(0, 30) + '...', url: t.url.substring(0, 50) + '...' })));
        console.log('Existing saved URLs count:', existingUrls.size);
        
        // For very large imports, batch the categorization to avoid timeouts
        const BATCH_SIZE = 100;
        
        if (tabsNeedingCategorization.length > BATCH_SIZE) {
          console.log(`Large import detected, processing in batches of ${BATCH_SIZE}`);
          categorizationResults = { 1: [], 2: [], 3: [] };
          
          for (let i = 0; i < tabsNeedingCategorization.length; i += BATCH_SIZE) {
            const batch = tabsNeedingCategorization.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(tabsNeedingCategorization.length / BATCH_SIZE)}`);
            
            const response = await chrome.runtime.sendMessage({
              action: 'categorizeTabs',
              data: {
                tabs: batch,
                apiKey: settings.apiKey,
                provider: settings.provider,
                model: settings.model,
                customPrompt: settings.customPrompt,
                savedUrls: Array.from(existingUrls)
              }
            });
            
            if (response && response.success && response.data) {
              // Merge batch results
              [1, 2, 3].forEach(category => {
                if (response.data[category]) {
                  categorizationResults[category].push(...response.data[category]);
                }
              });
            }
          }
        } else {
          // Small batch, process all at once
          const response = await chrome.runtime.sendMessage({
            action: 'categorizeTabs',
            data: {
              tabs: tabsNeedingCategorization,
              apiKey: settings.apiKey,
              provider: settings.provider,
              model: settings.model,
              customPrompt: settings.customPrompt,
              savedUrls: Array.from(existingUrls)
            }
          });
          
          if (response && response.success && response.data) {
            categorizationResults = response.data;
          }
        }
      } catch (error) {
        console.error('Failed to categorize imported tabs:', error);
      }
    }
    
    // If categorization succeeded, merge results
    if (categorizationResults) {
      // Include all categories, even category 1 (we'll filter it out if needed)
      [1, 2, 3].forEach(category => {
        if (categorizationResults[category]) {
          categorizationResults[category].forEach(categorizedTab => {
            // Only import categories 2 and 3 (skip category 1 - "Can Be Closed")
            if (category === 2 || category === 3) {
              // Get the original tab data from our tracking map
              const originalTab = urlToProcessedTab.get(categorizedTab.url);
              
              if (originalTab && !existingUrls.has(originalTab.url)) {
                tabsToImport.push({
                  ...originalTab,
                  category,
                  metadata: {
                    ...originalTab.metadata,
                    categorizedDuringImport: true
                  }
                });
              }
            }
          });
        }
      });
    } else if (tabsNeedingCategorization.length > 0) {
      // Default uncategorized tabs to category 2
      tabsNeedingCategorization.forEach(categorizedTab => {
        // Get the original tab data from our tracking map
        const originalTab = urlToProcessedTab.get(categorizedTab.url);
        
        if (originalTab && !existingUrls.has(originalTab.url)) {
          tabsToImport.push({
            ...originalTab,
            category: 2,
            metadata: {
              ...originalTab.metadata,
              defaultCategorized: true
            }
          });
        }
      });
    }
    
    // Import tabs to database
    const transaction = this.db.transaction([TABS_STORE], 'readwrite');
    const store = transaction.objectStore(TABS_STORE);
    const imported = [];
    
    for (const tab of tabsToImport) {
      try {
        await new Promise((resolve, reject) => {
          const request = store.add(tab);
          request.onsuccess = () => {
            imported.push(tab);
            resolve();
          };
          request.onerror = () => reject(new Error(`Failed to import tab: ${tab.url}`));
        });
      } catch (error) {
        console.error('Error importing tab:', error);
      }
    }
    
    return {
      imported: imported.length,
      duplicates: duplicates.length,
      categorized: categorizationResults ? tabsNeedingCategorization.length : 0,
      total: lines.length - 1, // Minus header
      importedTabs: imported,
      duplicateTabs: duplicates
    };
  }
}

// Export a singleton instance
const tabDatabase = new TabDatabase();