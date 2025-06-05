/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Database v3 - Normalized structure with URL and event tracking
 */

class TabDatabase {
  constructor() {
    this.dbName = 'AITabManagerDB_v3';
    this.dbVersion = 1;
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
        console.log('Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('Upgrading database schema...');

        // URLs table - stores unique URL/title combinations with their category
        if (!db.objectStoreNames.contains('urls')) {
          const urlStore = db.createObjectStore('urls', { keyPath: 'id', autoIncrement: true });
          // Composite index for URL + title uniqueness
          urlStore.createIndex('url_title', ['url', 'title'], { unique: true });
          urlStore.createIndex('url', 'url', { unique: false });
          urlStore.createIndex('category', 'category', { unique: false });
          urlStore.createIndex('domain', 'domain', { unique: false });
          urlStore.createIndex('lastCategorized', 'lastCategorized', { unique: false });
        }

        // Events table - stores open/close events for each URL
        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
          eventStore.createIndex('urlId', 'urlId', { unique: false });
          eventStore.createIndex('openTime', 'openTime', { unique: false });
          eventStore.createIndex('closeTime', 'closeTime', { unique: false });
          // Composite index for finding sessions
          eventStore.createIndex('closeTime_urlId', ['closeTime', 'urlId'], { unique: false });
        }

        // Migration from old database if needed
        if (!db.objectStoreNames.contains('migrationStatus')) {
          db.createObjectStore('migrationStatus', { keyPath: 'id' });
        }
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
      const index = store.index('url_title');

      // Try to find existing URL with same url+title
      const request = index.get([tabData.url, tabData.title]);

      request.onsuccess = () => {
        if (request.result) {
          // URL exists, update category if different
          const existing = request.result;
          if (existing.category !== category && category !== 0) {
            existing.category = category;
            existing.lastCategorized = new Date().toISOString();
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

      request.onerror = () => reject(request.error);
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
          // No open event found
          console.warn('No open event found for tab:', tabId);
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
      if (category === '0') continue; // Skip uncategorized

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

      const request = index.get(url);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all saved URLs by category
   * @param {number[]} categories - Array of categories to retrieve (default: [2,3] for save later & important)
   * @returns {Promise<Object[]>} Array of URL objects
   */
  async getSavedUrls(categories = [2, 3]) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['urls'], 'readonly');
      const store = transaction.objectStore('urls');
      const results = [];

      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (categories.includes(cursor.value.category)) {
            results.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
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
   * Update URL category
   * @param {number} urlId - URL ID
   * @param {number} newCategory - New category
   * @returns {Promise<void>}
   */
  async updateUrlCategory(urlId, newCategory) {
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

  /**
   * Migrate from old database format
   * @returns {Promise<void>}
   */
  async migrateFromOldDatabase() {
    try {
      // Check if migration already done
      const transaction = this.db.transaction(['migrationStatus'], 'readonly');
      const store = transaction.objectStore('migrationStatus');
      const request = store.get('v2_to_v3');

      const migrationDone = await new Promise((resolve) => {
        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => resolve(false);
      });

      if (migrationDone) {
        console.log('Migration already completed');
        return;
      }

      // Open old database
      const oldDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open('AITabManagerDB', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (oldDb.objectStoreNames.contains('tabs')) {
        console.log('Migrating from old database...');
        
        const oldTransaction = oldDb.transaction(['tabs'], 'readonly');
        const oldStore = oldTransaction.objectStore('tabs');
        const getAllRequest = oldStore.getAll();

        const oldTabs = await new Promise((resolve, reject) => {
          getAllRequest.onsuccess = () => resolve(getAllRequest.result);
          getAllRequest.onerror = () => reject(getAllRequest.error);
        });

        // Migrate each tab
        for (const oldTab of oldTabs) {
          try {
            // Create URL entry
            const urlId = await this.getOrCreateUrl({
              url: oldTab.url,
              title: oldTab.title,
              domain: oldTab.domain,
              favIconUrl: oldTab.favicon
            }, oldTab.category || 2); // Default to "save for later"

            // Create a close event for migration
            await this.recordOpenEvent(urlId, -1); // Use -1 for migrated tabs
            await this.recordCloseEvent(-1, oldTab.savedDate || oldTab.lastAccessedDate);
          } catch (error) {
            console.error('Error migrating tab:', error, oldTab);
          }
        }

        // Mark migration as complete
        const migrationTransaction = this.db.transaction(['migrationStatus'], 'readwrite');
        const migrationStore = migrationTransaction.objectStore('migrationStatus');
        migrationStore.put({ id: 'v2_to_v3', timestamp: new Date().toISOString() });

        console.log(`Migration completed. Migrated ${oldTabs.length} tabs.`);
      }

      oldDb.close();
    } catch (error) {
      console.error('Migration failed:', error);
    }
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

  async importData(data) {
    // Implementation for importing data
    // This would clear existing data and import the new data
  }
}

// Create and expose the database instance
// Use globalThis to work in both service workers and regular scripts
globalThis.tabDatabase = new TabDatabase();
console.log('TabDatabase v3 initialized');