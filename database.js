/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Database - Normalized structure with URL and event tracking
 */

class TabDatabase {
  constructor() {
    this.dbName = 'AITabManagerDB';
    this.dbVersion = 2; // Match the existing database version
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('Upgrading database schema from version', event.oldVersion, 'to', event.newVersion);

        // Delete old object stores if they exist (for clean migration)
        const oldStores = ['tabs', 'savedTabs', 'collections', 'migrationStatus'];
        oldStores.forEach(storeName => {
          if (db.objectStoreNames.contains(storeName)) {
            console.log('Deleting old object store:', storeName);
            db.deleteObjectStore(storeName);
          }
        });

        // URLs table - stores unique URLs with their category
        if (!db.objectStoreNames.contains('urls')) {
          console.log('Creating urls object store');
          const urlStore = db.createObjectStore('urls', { keyPath: 'id', autoIncrement: true });
          // Composite index for URL + title uniqueness (for backward compatibility)
          urlStore.createIndex('url_title', ['url', 'title'], { unique: true });
          // URL should be unique - one entry per URL
          urlStore.createIndex('url', 'url', { unique: false }); // Keep as non-unique for now to avoid migration issues
          urlStore.createIndex('category', 'category', { unique: false });
          urlStore.createIndex('domain', 'domain', { unique: false });
          urlStore.createIndex('lastCategorized', 'lastCategorized', { unique: false });
        }

        // Events table - stores open/close events for each URL
        if (!db.objectStoreNames.contains('events')) {
          console.log('Creating events object store');
          const eventStore = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
          eventStore.createIndex('urlId', 'urlId', { unique: false });
          eventStore.createIndex('openTime', 'openTime', { unique: false });
          eventStore.createIndex('closeTime', 'closeTime', { unique: false });
          // Composite index for finding sessions
          eventStore.createIndex('closeTime_urlId', ['closeTime', 'urlId'], { unique: false });
        }

      };
    });
  }

  /**
   * Find a URL entry by URL and title
   * @param {string} url - The URL to find
   * @param {string} title - The title to find
   * @returns {Promise<Object|null>} URL entry or null if not found
   */
  async findUrlByUrlTitle(url, title) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['urls'], 'readonly');
      const store = transaction.objectStore('urls');
      const index = store.index('url_title');
      
      const request = index.get([url, title]);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get or create a URL entry
   * @param {Object} tabData - Tab data with url, title, domain
   * @param {number} category - Category (0=uncategorized, 1=can close, 2=save later, 3=important)
   * @returns {Promise<number>} URL ID
   */
  async getOrCreateUrl(tabData, category = 0) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['urls'], 'readwrite');
      const store = transaction.objectStore('urls');
      const urlIndex = store.index('url');

      // First, try to find existing URL (regardless of title)
      const urlRequest = urlIndex.getAll(tabData.url);

      urlRequest.onsuccess = () => {
        const existingRecords = urlRequest.result;
        
        if (existingRecords && existingRecords.length > 0) {
          // URL exists - use the first one (should ideally be only one)
          const existing = existingRecords[0];
          
          // Update the record with new data
          let needsUpdate = false;
          
          // Update title if different (keep the latest title)
          if (existing.title !== tabData.title) {
            existing.title = tabData.title;
            needsUpdate = true;
          }
          
          // Update category if different and new category is not 0
          if (existing.category !== category && category !== 0) {
            existing.category = category;
            existing.lastCategorized = new Date().toISOString();
            needsUpdate = true;
          }
          
          // Update favicon if provided
          if (tabData.favIconUrl && existing.favicon !== tabData.favIconUrl) {
            existing.favicon = tabData.favIconUrl;
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            store.put(existing);
          }
          
          resolve(existing.id);
        } else {
          // Create new URL entry
          const urlData = {
            url: tabData.url,
            title: tabData.title,
            domain: tabData.domain || this.extractDomain(tabData.url),
            category: category,
            firstSeen: new Date().toISOString(),
            lastCategorized: category !== 0 ? new Date().toISOString() : null,
            favicon: tabData.favIconUrl || null
          };

          const addRequest = store.add(urlData);
          addRequest.onsuccess = () => resolve(addRequest.result);
          addRequest.onerror = () => reject(addRequest.error);
        }
      };

      urlRequest.onerror = () => reject(urlRequest.error);
    });
  }

  /**
   * Record a tab open event
   * @param {number} urlId - URL ID from urls table
   * @param {number} tabId - Chrome tab ID
   * @returns {Promise<number>} Event ID
   */
  async recordOpenEvent(urlId, tabId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['events'], 'readwrite');
      const store = transaction.objectStore('events');

      const eventData = {
        urlId: urlId,
        tabId: tabId,
        openTime: new Date().toISOString(),
        closeTime: null
      };

      const request = store.add(eventData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Record a tab close event
   * @param {number} tabId - Chrome tab ID
   * @param {string} closeTime - Optional close time (defaults to now)
   * @returns {Promise<void>}
   */
  async recordCloseEvent(tabId, closeTime = null) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['events'], 'readwrite');
      const store = transaction.objectStore('events');

      // Find the most recent open event for this tab
      const request = store.openCursor(null, 'prev');
      let found = false;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && !found) {
          if (cursor.value.tabId === tabId && !cursor.value.closeTime) {
            // Update the close time
            cursor.value.closeTime = closeTime || new Date().toISOString();
            cursor.update(cursor.value);
            found = true;
            resolve();
          } else {
            cursor.continue();
          }
        } else if (!found) {
          // No open event found - this is okay, just resolve
          // console.warn('No open event found for tab:', tabId);
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save categorized tabs (called after LLM categorization)
   * @param {Object} categorizedTabs - Object with categories as keys and tab arrays as values
   * @returns {Promise<void>}
   */
  async saveCategorizedTabs(categorizedTabs) {
    const closeTime = new Date().toISOString();

    for (const [category, tabs] of Object.entries(categorizedTabs)) {
      // Skip uncategorized - check both string and number
      if (category === '0' || category === 0 || parseInt(category) === 0) continue;

      for (const tab of tabs) {
        try {
          // Get or create URL entry with the category
          const urlId = await this.getOrCreateUrl(tab, parseInt(category));

          // Record close event for this tab
          if (tab.id) {
            await this.recordCloseEvent(tab.id, closeTime);
          }
        } catch (error) {
          console.error('Error saving tab:', error, tab);
        }
      }
    }
  }

  /**
   * Get URL info by URL
   * @param {string} url - URL to look up
   * @returns {Promise<Object|null>} URL data or null
   */
  async getUrlInfo(url) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['urls'], 'readonly');
      const store = transaction.objectStore('urls');
      const index = store.index('url');

      // Use getAll since URL index is not unique (same URL can have different titles)
      const request = index.getAll(url);
      request.onsuccess = () => {
        const results = request.result;
        if (results.length === 0) {
          resolve(null);
        } else {
          // Return the highest category entry for this URL (Important > Useful > Ignore)
          const sorted = results.sort((a, b) => b.category - a.category);
          resolve(sorted[0]);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update URL category
   * @param {string} url - URL to update
   * @param {number} newCategory - New category
   * @returns {Promise<boolean>} Success status
   */
  async updateUrlCategory(url, newCategory) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['urls'], 'readwrite');
      const store = transaction.objectStore('urls');
      const index = store.index('url');
      
      // Find the URL record
      const request = index.getAll(url);
      request.onsuccess = () => {
        const results = request.result;
        if (results.length === 0) {
          resolve(false);
          return;
        }
        
        // Update the first matching record (or the one with highest category)
        const sorted = results.sort((a, b) => b.category - a.category);
        const record = sorted[0];
        record.category = newCategory;
        record.lastCategorized = new Date().toISOString();
        
        const updateRequest = store.put(record);
        updateRequest.onsuccess = () => resolve(true);
        updateRequest.onerror = () => reject(updateRequest.error);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all saved URLs by category
   * @param {number[]} categories - Array of categories to retrieve (default: [2,3] for save later & important)
   * @returns {Promise<Object[]>} Array of URL objects
   */
  async getSavedUrls(categories = [2, 3], includeEvents = false) {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = this.db.transaction(['urls', 'events'], 'readonly');
        const urlStore = transaction.objectStore('urls');
        const eventStore = transaction.objectStore('events');
        const results = [];
        let totalRecords = 0;
        let skippedRecords = 0;

      const request = urlStore.openCursor();
      request.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor) {
          totalRecords++;
          const record = cursor.value;
          // console.log('Found URL record:', record.id, 'category:', record.category, 'url:', record.url);
          
          if (categories.includes(cursor.value.category)) {
            const urlData = { ...cursor.value };
            
            // If includeEvents is true, get the most recent close event for this URL
            if (includeEvents) {
              const eventIndex = eventStore.index('urlId');
              const eventRequest = eventIndex.getAll(cursor.value.id);
              
              await new Promise((resolveEvents) => {
                eventRequest.onsuccess = () => {
                  const events = eventRequest.result;
                  // Find the most recent close event
                  const closeEvents = events.filter(e => e.closeTime).sort((a, b) => 
                    new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime()
                  );
                  
                  if (closeEvents.length > 0) {
                    urlData.lastCloseTime = closeEvents[0].closeTime;
                    urlData.closeEvents = closeEvents;
                  }
                  resolveEvents();
                };
              });
            }
            
            results.push(urlData);
          } else {
            skippedRecords++;
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
      } catch (error) {
        console.error('Error in getSavedUrls:', error);
        // If we get an error about missing object stores, return empty array
        if (error.name === 'NotFoundError') {
          console.warn('Database schema mismatch - returning empty array');
          resolve([]);
        } else {
          reject(error);
        }
      }
    });
  }

  /**
   * Get all URLs (for showing all saved tabs including "can close")
   * @returns {Promise<Object[]>} Array of all URL objects
   */
  async getAllUrls() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['urls'], 'readonly');
      const store = transaction.objectStore('urls');

      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all saved tabs (alias for getSavedUrls with events)
   * @param {Object} options - Query options
   * @returns {Promise<Object[]>} Array of saved tab objects
   */
  async getAllSavedTabs(options = {}) {
    const categories = options.categories || [1, 2, 3]; // All categories by default
    return this.getSavedUrls(categories, true);
  }

  /**
   * Get tabs closed at a specific time (for session restoration)
   * @param {string} closeTime - ISO timestamp
   * @returns {Promise<Object[]>} Array of URL objects
   */
  async getTabsClosedAt(closeTime) {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = this.db.transaction(['events', 'urls'], 'readonly');
        const eventStore = transaction.objectStore('events');
        const urlStore = transaction.objectStore('urls');
        const index = eventStore.index('closeTime');

        const results = [];
        const urlIds = new Set();

        const request = index.openCursor(IDBKeyRange.only(closeTime));
        request.onsuccess = async (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const urlId = cursor.value.urlId;
            if (!urlIds.has(urlId)) {
              urlIds.add(urlId);
              const urlRequest = urlStore.get(urlId);
              urlRequest.onsuccess = () => {
                if (urlRequest.result) {
                  results.push(urlRequest.result);
                }
              };
            }
            cursor.continue();
          } else {
            // Wait for all URL fetches to complete
            transaction.oncomplete = () => resolve(results);
          }
        };

        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get recent close sessions (grouped by close time)
   * @param {number} limit - Number of sessions to retrieve
   * @returns {Promise<Object[]>} Array of session objects
   */
  async getRecentSessions(limit = 10) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['events', 'urls'], 'readonly');
      const eventStore = transaction.objectStore('events');
      const closeTimeIndex = eventStore.index('closeTime');

      const sessions = new Map();
      const request = closeTimeIndex.openCursor(null, 'prev');

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && sessions.size < limit) {
          const event = cursor.value;
          if (event.closeTime) {
            if (!sessions.has(event.closeTime)) {
              sessions.set(event.closeTime, {
                closeTime: event.closeTime,
                urlIds: new Set(),
                count: 0
              });
            }
            sessions.get(event.closeTime).urlIds.add(event.urlId);
            sessions.get(event.closeTime).count++;
          }
          cursor.continue();
        } else {
          resolve(Array.from(sessions.values()));
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a URL and all its events
   * @param {number} urlId - URL ID to delete
   * @returns {Promise<void>}
   */
  async deleteUrl(urlId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['urls', 'events'], 'readwrite');
      const urlStore = transaction.objectStore('urls');
      const eventStore = transaction.objectStore('events');
      const eventIndex = eventStore.index('urlId');

      // Delete URL
      urlStore.delete(urlId);

      // Delete all events for this URL
      const request = eventIndex.openCursor(IDBKeyRange.only(urlId));
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Update URL category by ID (deprecated - use updateUrlCategory with URL string)
   * @param {number} urlId - URL ID
   * @param {number} newCategory - New category
   * @returns {Promise<void>}
   */
  async updateUrlCategoryById(urlId, newCategory) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['urls'], 'readwrite');
      const store = transaction.objectStore('urls');

      const request = store.get(urlId);
      request.onsuccess = () => {
        const url = request.result;
        if (url) {
          url.category = newCategory;
          url.lastCategorized = new Date().toISOString();
          const updateRequest = store.put(url);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('URL not found'));
        }
      };

      request.onerror = () => reject(request.error);
    });
  }


  // Utility functions
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  async exportData() {
    const urls = await this.getAllUrls();
    const events = await new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['events'], 'readonly');
      const store = transaction.objectStore('events');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return { urls, events, exportDate: new Date().toISOString() };
  }

  /**
   * Export tabs as CSV
   * @param {number[]} urlIds - Optional array of URL IDs to export (null for all)
   * @returns {Promise<string>} CSV content
   */
  async exportAsCSV(urlIds = null) {
    let urls;
    if (urlIds) {
      // Get specific URLs by IDs
      urls = await Promise.all(urlIds.map(id => this.getUrlById(id)));
      urls = urls.filter(url => url !== null);
    } else {
      // Get all saved URLs (categories 1, 2, 3)
      urls = await this.getSavedUrls([1, 2, 3], true);
    }
    
    // CSV header
    const headers = ['Title', 'URL', 'Domain', 'Category', 'Saved Date', 'Saved Time', 'Last Closed Date', 'Last Closed Time'];
    const rows = [headers];
    
    urls.forEach(url => {
      const savedDate = new Date(url.lastCategorized || url.firstSeen);
      const savedDateStr = savedDate.toLocaleDateString();
      const savedTimeStr = savedDate.toLocaleTimeString();
      
      // Handle last close time
      let lastClosedDateStr = '';
      let lastClosedTimeStr = '';
      if (url.lastCloseTime) {
        const lastClosedDate = new Date(url.lastCloseTime);
        lastClosedDateStr = lastClosedDate.toLocaleDateString();
        lastClosedTimeStr = lastClosedDate.toLocaleTimeString();
      }
      
      // Map category numbers to names
      const categoryNames = {
        1: 'Ignore',
        2: 'Useful',
        3: 'Important'
      };
      const categoryName = categoryNames[url.category] || 'Unknown';
      
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
        escapeCSV(url.title),
        escapeCSV(url.url),
        escapeCSV(url.domain),
        escapeCSV(categoryName),
        escapeCSV(savedDateStr),
        escapeCSV(savedTimeStr),
        escapeCSV(lastClosedDateStr),
        escapeCSV(lastClosedTimeStr)
      ]);
    });
    
    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Get URL by ID
   * @param {number} id - URL ID
   * @returns {Promise<Object|null>} URL object or null
   */
  async getUrlById(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['urls'], 'readonly');
      const store = transaction.objectStore('urls');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Import tabs from CSV
   * @param {string} csvContent - CSV content to import
   * @param {Object} settings - Import settings
   * @returns {Promise<Object>} Import results
   */
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
    const savedDateIdx = headers.findIndex(h => h.includes('saved') && h.includes('date'));
    const savedTimeIdx = headers.findIndex(h => h.includes('saved') && h.includes('time'));
    const closedDateIdx = headers.findIndex(h => h.includes('closed') && h.includes('date'));
    const closedTimeIdx = headers.findIndex(h => h.includes('closed') && h.includes('time'));
    
    if (titleIdx === -1 || urlIdx === -1) {
      throw new Error('CSV must contain at least Title and URL columns');
    }
    
    // Get existing URLs to check for duplicates
    const existingUrls = await this.getAllUrls();
    const existingUrlSet = new Set(existingUrls.map(url => url.url));
    
    // Process data rows
    const imported = [];
    const duplicates = [];
    const needsCategorization = [];
    const errors = [];
    let categorizedByRules = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 2) continue; // Skip empty rows
      
      const url = row[urlIdx]?.trim();
      const title = row[titleIdx]?.trim() || 'Untitled';
      
      if (!url) continue; // Skip rows without URL
      
      // Check for duplicates
      if (existingUrlSet.has(url)) {
        duplicates.push({ title, url, line: i + 1 });
        continue;
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
      let category = 0; // Default to uncategorized
      if (categoryIdx !== -1 && row[categoryIdx]) {
        const categoryStr = row[categoryIdx].trim().toLowerCase();
        // Map category names to numbers
        const categoryMap = {
          'ignore': 1,
          'can close': 1,
          'can be closed': 1,
          'useful': 2,
          'save for later': 2,
          'save later': 2,
          'important': 3
        };
        category = categoryMap[categoryStr] || 0;
      }
      
      // Parse dates
      let savedDate = new Date().toISOString();
      if (savedDateIdx !== -1 && row[savedDateIdx]) {
        try {
          const dateStr = row[savedDateIdx].trim();
          const timeStr = savedTimeIdx !== -1 ? row[savedTimeIdx]?.trim() || '' : '';
          const combinedDateTime = timeStr ? `${dateStr} ${timeStr}` : dateStr;
          const parsedDate = new Date(combinedDateTime);
          if (!isNaN(parsedDate.getTime())) {
            savedDate = parsedDate.toISOString();
          }
        } catch (e) {
          // Use current date if parsing fails
        }
      }
      
      // Apply rules if category is not set
      const originalCategory = category;
      if (category === 0 && settings.rules && settings.rules.length > 0) {
        const { applyRulesToTabs } = await import('./src/modules/categorization-service.js');
        const tabData = { url, title, domain };
        const { categorizedByRules: ruleResults } = applyRulesToTabs([tabData], settings.rules);
        
        // Check if any rule matched
        for (const [cat, tabs] of Object.entries(ruleResults)) {
          if (tabs.length > 0) {
            category = parseInt(cat);
            categorizedByRules++;
            break;
          }
        }
      }
      
      try {
        // Only import categorized tabs (1, 2, 3)
        if (category > 0) {
          const urlId = await this.getOrCreateUrl({
            url: url,
            title: title,
            domain: domain
          }, category);
          
          // Record a close event if we have close date
          if (closedDateIdx !== -1 && row[closedDateIdx]) {
            try {
              const dateStr = row[closedDateIdx].trim();
              const timeStr = closedTimeIdx !== -1 ? row[closedTimeIdx]?.trim() || '' : '';
              const combinedDateTime = timeStr ? `${dateStr} ${timeStr}` : dateStr;
              const parsedDate = new Date(combinedDateTime);
              if (!isNaN(parsedDate.getTime())) {
                await this.recordOpenEvent(urlId, -1); // Dummy tab ID for imports
                await this.recordCloseEvent(-1, parsedDate.toISOString());
              }
            } catch (e) {
              // Ignore close date parsing errors
            }
          }
          
          imported.push({ title, url, category, line: i + 1 });
        } else {
          needsCategorization.push({ title, url, line: i + 1 });
        }
      } catch (error) {
        errors.push({ 
          title, 
          url, 
          error: error.message, 
          line: i + 1 
        });
      }
    }
    
    return {
      imported: imported.length,
      duplicates: duplicates.length,
      needsCategorization: needsCategorization.length,
      errors: errors.length,
      categorizedByRules: categorizedByRules,
      details: {
        imported,
        duplicates,
        needsCategorization,
        errors
      }
    };
  }

  /**
   * Clean up uncategorized (category 0) records from database
   * @returns {Promise<number>} Number of records deleted
   */
  async cleanupUncategorizedRecords() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['urls', 'events'], 'readwrite');
      const urlStore = transaction.objectStore('urls');
      const eventStore = transaction.objectStore('events');
      let deletedCount = 0;
      
      const request = urlStore.openCursor();
      request.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.category === 0) {
            const urlId = cursor.value.id;
            
            // Delete URL record
            cursor.delete();
            deletedCount++;
            
            // Delete associated events
            const eventIndex = eventStore.index('urlId');
            const eventRequest = eventIndex.openCursor(IDBKeyRange.only(urlId));
            eventRequest.onsuccess = (eventEvent) => {
              const eventCursor = eventEvent.target.result;
              if (eventCursor) {
                eventCursor.delete();
                eventCursor.continue();
              }
            };
          }
          cursor.continue();
        } else {
          console.log(`Cleanup complete. Deleted ${deletedCount} uncategorized records.`);
          resolve(deletedCount);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async importData(data) {
    // Implementation for importing data
    // This would clear existing data and import the new data
  }

  /**
   * Update the category of a saved tab by URL
   * @param {string} url - The URL of the tab to update
   * @param {number} newCategory - The new category (1, 2, or 3)
   * @returns {Promise<Object>} Updated tab record
   */
  async updateTabCategory(url, newCategory) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['urls'], 'readwrite');
      const store = transaction.objectStore('urls');
      const index = store.index('url');

      // Find the tab by URL
      const getRequest = index.get(url);
      
      getRequest.onsuccess = () => {
        const urlRecord = getRequest.result;
        
        if (!urlRecord) {
          reject(new Error(`Tab not found with URL: ${url}`));
          return;
        }
        
        // Update the record with new category
        const updatedRecord = {
          ...urlRecord,
          category: newCategory,
          lastCategorized: Date.now()
        };
        
        // Save the updated record
        const putRequest = store.put(updatedRecord);
        
        putRequest.onsuccess = () => {
          console.log(`Updated tab category: ${url} -> category ${newCategory}`);
          resolve(updatedRecord);
        };
        
        putRequest.onerror = () => {
          reject(new Error(`Failed to update tab category: ${putRequest.error}`));
        };
      };
      
      getRequest.onerror = () => {
        reject(new Error(`Failed to find tab: ${getRequest.error}`));
      };
    });
  }
}

// Create and expose the database instance
// Use globalThis to work in both service workers and regular scripts
const tabDatabase = new TabDatabase();
globalThis.tabDatabase = tabDatabase;
