/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Categorization Service - handles tab categorization using LLMs
 */

import { TAB_CATEGORIES, STATUS_MESSAGES } from '../utils/constants.js';
import { extractDomain, fallbackCategorization } from '../utils/helpers.js';
import MessageService from '../services/MessageService.js';
import ChromeAPIService from '../services/ChromeAPIService.js';
import { state, updateState, clearCategorizedTabs, savePopupState } from './state-manager.js';
import { showStatus, clearStatus, updateCategorizeBadge, hideApiKeyPrompt } from './ui-manager.js';
// Database is available as window.window.tabDatabase

/**
 * Handle categorize button click
 */
export async function handleCategorize() {
  console.log('Categorize clicked');
  
  const apiKey = state.settings.apiKeys[state.settings.provider];
  const provider = state.settings.provider;
  const model = state.settings.model || state.settings.selectedModels[provider];
  const customPrompt = state.settings.customPrompt;
  
  if (!apiKey || !provider || !model) {
    showStatus(STATUS_MESSAGES.ERROR_NO_API_KEY, 'error', 5000);
    return;
  }
  
  hideApiKeyPrompt();
  await categorizeTabs();
}

/**
 * Categorize all open tabs
 */
export async function categorizeTabs() {
  showStatus(STATUS_MESSAGES.LOADING, 'loading', 0);
  
  try {
    // Get uncategorized tabs from background
    let uncategorizedTabs = [];
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCategorizedTabs' });
      if (response && response.categorizedTabs && response.categorizedTabs[0]) {
        uncategorizedTabs = response.categorizedTabs[0];
        console.log(`Found ${uncategorizedTabs.length} uncategorized tabs from background`);
      }
    } catch (error) {
      console.error('Error getting uncategorized tabs from background:', error);
    }
    
    // If no uncategorized tabs from background, get all tabs
    let tabs;
    if (uncategorizedTabs.length > 0) {
      tabs = uncategorizedTabs;
    } else {
      // Get all tabs from all windows
      tabs = await ChromeAPIService.getAllTabs();
    }
    
    // Process tabs to add domain info
    const processedTabs = tabs.map(tab => ({
      ...tab,
      domain: extractDomain(tab.url)
    }));
    
    console.log(`Found ${tabs.length} tabs to categorize`);
    
    // Track duplicate tabs by URL
    const urlToTabs = {};
    processedTabs.forEach(tab => {
      const url = tab.url;
      if (!urlToTabs[url]) {
        urlToTabs[url] = [];
      }
      urlToTabs[url].push(tab);
    });
    
    // Store URL to duplicate IDs mapping
    const urlToDuplicateIds = {};
    Object.entries(urlToTabs).forEach(([url, tabsWithUrl]) => {
      if (tabsWithUrl.length > 1) {
        urlToDuplicateIds[url] = tabsWithUrl.map(t => t.id);
      }
    });
    updateState('urlToDuplicateIds', urlToDuplicateIds);
    
    // Get saved URLs to exclude from LLM
    let savedUrls = [];
    try {
      const savedTabs = await window.tabDatabase.getAllSavedTabs();
      savedUrls = savedTabs.map(tab => tab.url);
      console.log(`Found ${savedUrls.length} saved URLs to exclude from LLM`);
    } catch (error) {
      console.error('Error getting saved tabs:', error);
    }
    
    const apiKey = state.settings.apiKeys[state.settings.provider];
    const provider = state.settings.provider;
    const model = state.settings.model || state.settings.selectedModels[provider];
    const customPrompt = state.settings.customPrompt;
    
    let categorized;
    
    try {
      // Call LLM for categorization
      categorized = await MessageService.categorizeTabs({
        tabs: processedTabs,
        apiKey,
        provider,
        model,
        customPrompt,
        savedUrls
      });
      
      console.log('Tabs categorized successfully');
    } catch (error) {
      console.error('Error calling API:', error);
      
      // Use fallback categorization
      console.log('Using fallback categorization');
      categorized = fallbackCategorization(processedTabs);
    }
    
    // Ensure all categories exist
    const result = {
      [TAB_CATEGORIES.UNCATEGORIZED]: [], // Clear uncategorized after categorization
      [TAB_CATEGORIES.CAN_CLOSE]: categorized[TAB_CATEGORIES.CAN_CLOSE] || [],
      [TAB_CATEGORIES.SAVE_LATER]: categorized[TAB_CATEGORIES.SAVE_LATER] || [],
      [TAB_CATEGORIES.IMPORTANT]: categorized[TAB_CATEGORIES.IMPORTANT] || []
    };
    
    console.log('Final categorization:', {
      category1: result[TAB_CATEGORIES.CAN_CLOSE].length,
      category2: result[TAB_CATEGORIES.SAVE_LATER].length,
      category3: result[TAB_CATEGORIES.IMPORTANT].length
    });
    
    // Merge with existing categorized tabs (if any were already categorized)
    // Keep any tabs that weren't in the uncategorized list
    const existingCategorized = state.categorizedTabs || {};
    const mergedResult = {
      [TAB_CATEGORIES.UNCATEGORIZED]: [], // Clear uncategorized
      [TAB_CATEGORIES.CAN_CLOSE]: result[TAB_CATEGORIES.CAN_CLOSE] || [],
      [TAB_CATEGORIES.SAVE_LATER]: result[TAB_CATEGORIES.SAVE_LATER] || [],
      [TAB_CATEGORIES.IMPORTANT]: result[TAB_CATEGORIES.IMPORTANT] || []
    };
    
    // If we only categorized uncategorized tabs, merge with existing
    if (uncategorizedTabs.length > 0) {
      // Keep existing tabs that weren't recategorized
      [TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.IMPORTANT].forEach(cat => {
        const existing = existingCategorized[cat] || [];
        const newlyProcessed = mergedResult[cat];
        const processedIds = new Set(tabs.map(t => t.id));
        
        // Add existing tabs that weren't in the processed list
        existing.forEach(tab => {
          if (!processedIds.has(tab.id)) {
            mergedResult[cat].push(tab);
          }
        });
      });
    }
    
    // Update state with categorized tabs
    updateState('categorizedTabs', mergedResult);
    updateState('urlToDuplicateIds', urlToDuplicateIds);
    
    // Sync with background script
    await chrome.runtime.sendMessage({
      action: 'storeCategorizedTabs',
      data: {
        categorizedTabs: mergedResult,
        urlToDuplicateIds: urlToDuplicateIds
      }
    });
    
    // Update UI
    updateCategorizeBadge();
    showStatus(STATUS_MESSAGES.SUCCESS_CATEGORIZED, 'success');
    
    // Save state
    await savePopupState();
    
    // Trigger display update
    const { displayTabs } = await import('./tab-display.js');
    displayTabs();
    
    // Show the tabs container and controls
    const { show } = await import('../utils/dom-helpers.js');
    const { DOM_IDS } = await import('../utils/constants.js');
    const { $id } = await import('../utils/dom-helpers.js');
    show($id(DOM_IDS.TABS_CONTAINER));
    show($id(DOM_IDS.SEARCH_CONTROLS), 'flex');
    show($id(DOM_IDS.CATEGORIZE_GROUPING_CONTROLS), 'flex');
    const actionButtons = document.querySelector('.action-buttons');
    if (actionButtons) {
      show(actionButtons, 'flex');
    }
    
    return result;
    
  } catch (error) {
    console.error('Error in categorizeTabs:', error);
    showStatus(`${STATUS_MESSAGES.ERROR_CATEGORIZATION} ${error.message}`, 'error');
    return null;
  }
}

/**
 * Re-categorize tabs (refresh)
 */
export async function refreshCategorization() {
  // Clear existing categorization
  clearCategorizedTabs();
  
  // Re-categorize
  return categorizeTabs();
}

/**
 * Move a tab to a different category
 * @param {Object} tab - Tab to move
 * @param {number} fromCategory - Source category
 * @param {number} toCategory - Target category
 */
export function moveTabToCategory(tab, fromCategory, toCategory) {
  if (fromCategory === toCategory) return;
  
  // Remove from source category
  const sourceIndex = state.categorizedTabs[fromCategory].findIndex(t => t.id === tab.id);
  if (sourceIndex > -1) {
    state.categorizedTabs[fromCategory].splice(sourceIndex, 1);
  }
  
  // Add to target category
  state.categorizedTabs[toCategory].push(tab);
  
  // Update state
  updateState('categorizedTabs', state.categorizedTabs);
  updateCategorizeBadge();
  
  // Save state
  savePopupState();
}

/**
 * Check if tab is already saved
 * @param {string} url - Tab URL
 * @returns {Promise<boolean>}
 */
export async function isTabSaved(url) {
  try {
    const savedTabs = await window.tabDatabase.getAllSavedTabs();
    return savedTabs.some(tab => tab.url === url);
  } catch (error) {
    console.error('Error checking if tab is saved:', error);
    return false;
  }
}

/**
 * Get categorization stats
 * @returns {Object} Stats object
 */
export function getCategorizationStats() {
  const stats = {
    total: 0,
    byCategory: {
      [TAB_CATEGORIES.CAN_CLOSE]: state.categorizedTabs[TAB_CATEGORIES.CAN_CLOSE].length,
      [TAB_CATEGORIES.SAVE_LATER]: state.categorizedTabs[TAB_CATEGORIES.SAVE_LATER].length,
      [TAB_CATEGORIES.IMPORTANT]: state.categorizedTabs[TAB_CATEGORIES.IMPORTANT].length
    },
    duplicates: Object.keys(state.urlToDuplicateIds).length,
    saved: 0
  };
  
  stats.total = stats.byCategory[TAB_CATEGORIES.CAN_CLOSE] + 
                stats.byCategory[TAB_CATEGORIES.SAVE_LATER] + 
                stats.byCategory[TAB_CATEGORIES.IMPORTANT];
  
  // Count saved tabs
  Object.values(state.categorizedTabs).forEach(tabs => {
    tabs.forEach(tab => {
      if (tab.alreadySaved) stats.saved++;
    });
  });
  
  return stats;
}

// Export default object
export default {
  handleCategorize,
  categorizeTabs,
  refreshCategorization,
  moveTabToCategory,
  isTabSaved,
  getCategorizationStats
};