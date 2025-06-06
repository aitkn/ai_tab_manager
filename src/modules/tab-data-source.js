/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Tab Data Source - Single source of truth for tab data
 */

/**
 * Get current tabs from background script
 * @returns {Promise<Object>} Categorized tabs and duplicate info
 */
export async function getCurrentTabs() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCategorizedTabs' });
    if (response && response.categorizedTabs) {
      return {
        categorizedTabs: response.categorizedTabs,
        urlToDuplicateIds: response.urlToDuplicateIds || {}
      };
    }
    return {
      categorizedTabs: {},
      urlToDuplicateIds: {}
    };
  } catch (error) {
    console.error('Error fetching current tabs:', error);
    return {
      categorizedTabs: {},
      urlToDuplicateIds: {}
    };
  }
}

/**
 * Get saved tabs from database
 * @param {Object} options - Query options
 * @returns {Promise<Object[]>} Array of saved tabs
 */
export async function getSavedTabs(options = {}) {
  try {
    // Use the database directly
    if (window.tabDatabase && window.tabDatabase.getAllSavedTabs) {
      return await window.tabDatabase.getAllSavedTabs(options);
    }
    return [];
  } catch (error) {
    console.error('Error fetching saved tabs:', error);
    return [];
  }
}

/**
 * Check if we have any current tabs
 * @returns {Promise<boolean>}
 */
export async function hasCurrentTabs() {
  const { categorizedTabs } = await getCurrentTabs();
  return Object.values(categorizedTabs).some(tabs => tabs.length > 0);
}

/**
 * Get current tabs by category
 * @param {number} category - Category ID
 * @returns {Promise<Array>} Tabs in that category
 */
export async function getCurrentTabsByCategory(category) {
  const { categorizedTabs } = await getCurrentTabs();
  return categorizedTabs[category] || [];
}

/**
 * Get all current tab categories with counts
 * @returns {Promise<Object>} Category counts
 */
export async function getCurrentTabCounts() {
  const { categorizedTabs } = await getCurrentTabs();
  const counts = {};
  
  for (const [category, tabs] of Object.entries(categorizedTabs)) {
    counts[category] = tabs.length;
  }
  
  return counts;
}