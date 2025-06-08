/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Categorization Service - handles tab categorization using LLMs
 */

import { TAB_CATEGORIES, STATUS_MESSAGES, CATEGORY_NAMES, RULE_TYPES, RULE_FIELDS } from '../utils/constants.js';
import { extractDomain, fallbackCategorization } from '../utils/helpers.js';
import MessageService from '../services/MessageService.js';
import ChromeAPIService from '../services/ChromeAPIService.js';
import { state, updateState, clearCategorizedTabs, savePopupState } from './state-manager.js';
import { showStatus, clearStatus, updateCategorizeBadge, hideApiKeyPrompt } from './ui-manager.js';
import { getCurrentTabs } from './tab-data-source.js';
// Database is available as window.window.tabDatabase

/**
 * Handle categorize button click
 */
export async function handleCategorize() {
  console.log('Categorize clicked');
  
  // Check if this is first-time use
  if (!state.settings.hasConfiguredSettings) {
    const shouldRedirect = confirm('Welcome to AI Tab Manager! Would you like to configure your categorization settings first?\n\nYou can choose to use AI-powered categorization or set up rules-based categorization.');
    if (shouldRedirect) {
      const { switchToTab } = await import('./ui-manager.js');
      switchToTab('settings');
      showStatus('Please configure your categorization settings', 'info', 5000);
      return;
    }
  }
  
  // Check if LLM is disabled
  if (!state.settings.useLLM) {
    // Only use rule-based categorization
    await categorizeTabs();
    return;
  }
  
  // Check for API key if LLM is enabled
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
 * Apply rules to categorize tabs
 * @param {Array} tabs - Array of tabs to categorize
 * @param {Array} rules - Array of rules to apply
 * @returns {Object} Object with categorized tabs and remaining uncategorized tabs
 */
export function applyRulesToTabs(tabs, rules) {
  const categorizedByRules = {
    [TAB_CATEGORIES.CAN_CLOSE]: [],
    [TAB_CATEGORIES.SAVE_LATER]: [],
    [TAB_CATEGORIES.IMPORTANT]: []
  };
  const uncategorizedTabs = [];
  
  tabs.forEach(tab => {
    let categorized = false;
    
    // Check each rule
    for (const rule of rules) {
      if (!rule.enabled) continue;
      
      let matches = false;
      
      switch (rule.type) {
        case RULE_TYPES.DOMAIN:
          const tabDomain = extractDomain(tab.url);
          matches = tabDomain === rule.value;
          break;
          
        case RULE_TYPES.URL_CONTAINS:
          matches = tab.url.includes(rule.value);
          break;
          
        case RULE_TYPES.TITLE_CONTAINS:
          matches = tab.title && tab.title.includes(rule.value);
          break;
          
        case RULE_TYPES.REGEX:
          try {
            const regex = new RegExp(rule.value);
            const field = rule.field === RULE_FIELDS.TITLE ? tab.title : tab.url;
            matches = regex.test(field);
          } catch (e) {
            console.error('Invalid regex:', rule.value, e);
          }
          break;
      }
      
      if (matches) {
        categorizedByRules[rule.category].push(tab);
        categorized = true;
        break; // Apply first matching rule only
      }
    }
    
    if (!categorized) {
      uncategorizedTabs.push(tab);
    }
  });
  
  return { categorizedByRules, uncategorizedTabs };
}

/**
 * Categorize tabs using ML ensemble
 */
async function categorizeWithML(tabs, mlCategorizer) {
  try {
    // Process tabs to add domain info
    const processedTabs = tabs.map(tab => ({
      ...tab,
      domain: extractDomain(tab.url)
    }));
    
    // Get saved URLs to exclude from LLM
    let savedUrls = [];
    try {
      const savedTabs = await window.tabDatabase.getAllSavedTabs();
      savedUrls = savedTabs
        .filter(tab => tab.category !== 0)
        .map(tab => tab.url);
    } catch (error) {
      console.error('Error getting saved tabs:', error);
    }
    
    // Prepare LLM results if enabled
    let llmResults = null;
    if (state.settings.useLLM) {
      const apiKey = state.settings.apiKeys[state.settings.provider];
      const provider = state.settings.provider;
      const model = state.settings.model || state.settings.selectedModels[provider];
      const customPrompt = state.settings.customPrompt;
      
      if (apiKey && provider && model) {
        try {
          llmResults = await MessageService.categorizeTabs({
            tabs: processedTabs,
            apiKey,
            provider,
            model,
            customPrompt,
            savedUrls
          });
        } catch (error) {
          console.error('Error calling LLM:', error);
        }
      }
    }
    
    // Use ML ensemble to categorize
    const mlResults = await mlCategorizer.categorizeTabs(processedTabs, {
      rules: state.settings.rules || [],
      llmResults,
      useLLM: state.settings.useLLM && llmResults !== null,
      useML: true,
      useRules: true
    });
    
    // Extract categorized tabs
    const result = mlResults.categorized;
    
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
    
    // Get fresh current state including already categorized tabs
    const currentState = await getCurrentTabs();
    const existingCategorized = currentState.categorizedTabs || {};
    
    // Merge result - keep existing categorized tabs and add newly categorized ones
    const mergedResult = {
      [TAB_CATEGORIES.UNCATEGORIZED]: [], // Clear uncategorized
      [TAB_CATEGORIES.CAN_CLOSE]: result[TAB_CATEGORIES.CAN_CLOSE] || [],
      [TAB_CATEGORIES.SAVE_LATER]: result[TAB_CATEGORIES.SAVE_LATER] || [],
      [TAB_CATEGORIES.IMPORTANT]: result[TAB_CATEGORIES.IMPORTANT] || []
    };
    
    // Keep existing categorized tabs that weren't recategorized
    const processedIds = new Set(tabs.map(t => t.id));
    [TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.IMPORTANT].forEach(cat => {
      const existing = existingCategorized[cat] || [];
      
      // Add existing tabs that weren't in the processed list
      existing.forEach(tab => {
        if (!processedIds.has(tab.id)) {
          mergedResult[cat].push(tab);
        }
      });
    });
    
    // Update state with categorized tabs for immediate UI update
    updateState('categorizedTabs', mergedResult);
    updateState('urlToDuplicateIds', urlToDuplicateIds);
    updateState('mlMetadata', mlResults.metadata);
    
    // Save categorized tabs to database
    await window.tabDatabase.saveCategorizedTabs(mergedResult);
    
    // Update UI
    updateCategorizeBadge();
    
    // Show success with ML info
    const summary = mlResults.summary;
    const mlUsed = summary?.decisionSources?.model > 0;
    const message = mlUsed 
      ? `${STATUS_MESSAGES.SUCCESS_CATEGORIZED} (ML: ${Math.round(summary.averageConfidence * 100)}% confidence)`
      : STATUS_MESSAGES.SUCCESS_CATEGORIZED;
    showStatus(message, 'success');
    
    // Save state
    await savePopupState();
    
    // Trigger display update
    const { displayTabs } = await import('./tab-display.js');
    displayTabs();
    
    // Show the tabs container and toolbar
    const { show } = await import('../utils/dom-helpers.js');
    const { DOM_IDS } = await import('../utils/constants.js');
    const { $id } = await import('../utils/dom-helpers.js');
    show($id(DOM_IDS.TABS_CONTAINER));
    
    // Show unified toolbar
    const { showToolbar } = await import('./unified-toolbar.js');
    showToolbar();
    
    // Process user acceptance for ML learning
    await mlCategorizer.processAcceptance(tabs, mlResults);
    
    return mergedResult;
    
  } catch (error) {
    console.error('Error in ML categorization:', error);
    showStatus(`${STATUS_MESSAGES.ERROR_CATEGORIZATION} ${error.message}`, 'error');
    return null;
  }
}

/**
 * Categorize all open tabs
 */
export async function categorizeTabs() {
  showStatus(STATUS_MESSAGES.LOADING, 'loading', 0);
  
  try {
    // Get current tabs from tab data source
    const { categorizedTabs } = await getCurrentTabs();
    
    // Get uncategorized tabs (category 0)
    const uncategorizedTabs = categorizedTabs[TAB_CATEGORIES.UNCATEGORIZED] || [];
    console.log(`Found ${uncategorizedTabs.length} uncategorized tabs`);
    
    // If no uncategorized tabs, nothing to categorize
    if (uncategorizedTabs.length === 0) {
      showStatus('No uncategorized tabs to process', 'info', 3000);
      return;
    }
    
    // Check if ML is enabled and available
    let useML = state.settings.useML !== false; // Default to true if not set
    let mlCategorizer = null;
    
    if (useML) {
      try {
        const { getMLCategorizer } = await import('../ml/categorization/ml-categorizer.js');
        mlCategorizer = await getMLCategorizer();
        useML = await mlCategorizer.isMLAvailable();
        console.log('ML categorization available:', useML);
      } catch (error) {
        console.log('ML system not available:', error.message);
        useML = false;
      }
    }
    
    // If ML is available and we have all methods enabled, use ensemble
    if (useML && state.settings.rules?.length > 0) {
      // Use ML ensemble approach
      return await categorizeWithML(uncategorizedTabs, mlCategorizer);
    }
    
    // Otherwise use traditional approach
    // Apply rules first if any are defined
    let tabsForLLM = uncategorizedTabs;
    let ruleCategorizedTabs = {};
    
    if (state.settings.rules && state.settings.rules.length > 0) {
      const { categorizedByRules, uncategorizedTabs: remainingTabs } = applyRulesToTabs(uncategorizedTabs, state.settings.rules);
      ruleCategorizedTabs = categorizedByRules;
      tabsForLLM = remainingTabs;
      
      console.log(`Rules applied: ${uncategorizedTabs.length - remainingTabs.length} tabs categorized by rules`);
      console.log('Rule categorization:', {
        category1: ruleCategorizedTabs[TAB_CATEGORIES.CAN_CLOSE].length,
        category2: ruleCategorizedTabs[TAB_CATEGORIES.SAVE_LATER].length,
        category3: ruleCategorizedTabs[TAB_CATEGORIES.IMPORTANT].length
      });
    }
    
    const tabs = tabsForLLM;
    
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
    
    // Get saved URLs to exclude from LLM (but only if they're already categorized)
    let savedUrls = [];
    try {
      const savedTabs = await window.tabDatabase.getAllSavedTabs();
      // Only exclude saved tabs that have been properly categorized (not category 0)
      savedUrls = savedTabs
        .filter(tab => tab.category !== 0)
        .map(tab => tab.url);
      console.log(`Found ${savedUrls.length} categorized saved URLs to exclude from LLM`);
      const uncategorizedSavedCount = savedTabs.filter(tab => tab.category === 0).length;
      if (uncategorizedSavedCount > 0) {
        console.log(`Found ${uncategorizedSavedCount} uncategorized saved tabs that will be re-categorized`);
      }
    } catch (error) {
      console.error('Error getting saved tabs:', error);
    }
    
    let categorized;
    
    // Check if LLM is enabled
    if (state.settings.useLLM && tabs.length > 0) {
      const apiKey = state.settings.apiKeys[state.settings.provider];
      const provider = state.settings.provider;
      const model = state.settings.model || state.settings.selectedModels[provider];
      const customPrompt = state.settings.customPrompt;
      
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
    } else if (!state.settings.useLLM && tabs.length > 0) {
      // LLM is disabled, put remaining tabs in "Useful" category
      categorized = {
        [TAB_CATEGORIES.CAN_CLOSE]: [],
        [TAB_CATEGORIES.SAVE_LATER]: tabs, // Put all uncategorized tabs in "Useful"
        [TAB_CATEGORIES.IMPORTANT]: []
      };
      console.log('LLM disabled, categorizing remaining tabs as Useful');
    } else {
      // No tabs for LLM, just use empty categories
      categorized = {
        [TAB_CATEGORIES.CAN_CLOSE]: [],
        [TAB_CATEGORIES.SAVE_LATER]: [],
        [TAB_CATEGORIES.IMPORTANT]: []
      };
      console.log('All tabs categorized by rules, skipping LLM');
    }
    
    // Merge rule-based and LLM categorizations
    const result = {
      [TAB_CATEGORIES.UNCATEGORIZED]: [], // Clear uncategorized after categorization
      [TAB_CATEGORIES.CAN_CLOSE]: [
        ...(ruleCategorizedTabs[TAB_CATEGORIES.CAN_CLOSE] || []),
        ...(categorized[TAB_CATEGORIES.CAN_CLOSE] || [])
      ],
      [TAB_CATEGORIES.SAVE_LATER]: [
        ...(ruleCategorizedTabs[TAB_CATEGORIES.SAVE_LATER] || []),
        ...(categorized[TAB_CATEGORIES.SAVE_LATER] || [])
      ],
      [TAB_CATEGORIES.IMPORTANT]: [
        ...(ruleCategorizedTabs[TAB_CATEGORIES.IMPORTANT] || []),
        ...(categorized[TAB_CATEGORIES.IMPORTANT] || [])
      ]
    };
    
    console.log('Final categorization:', {
      category1: result[TAB_CATEGORIES.CAN_CLOSE].length,
      category2: result[TAB_CATEGORIES.SAVE_LATER].length,
      category3: result[TAB_CATEGORIES.IMPORTANT].length
    });
    
    // Get fresh current state including already categorized tabs
    const currentState = await getCurrentTabs();
    const existingCategorized = currentState.categorizedTabs || {};
    
    // Merge result - keep existing categorized tabs and add newly categorized ones
    const mergedResult = {
      [TAB_CATEGORIES.UNCATEGORIZED]: [], // Clear uncategorized
      [TAB_CATEGORIES.CAN_CLOSE]: result[TAB_CATEGORIES.CAN_CLOSE] || [],
      [TAB_CATEGORIES.SAVE_LATER]: result[TAB_CATEGORIES.SAVE_LATER] || [],
      [TAB_CATEGORIES.IMPORTANT]: result[TAB_CATEGORIES.IMPORTANT] || []
    };
    
    // Keep existing categorized tabs that weren't recategorized
    const processedIds = new Set(tabs.map(t => t.id));
    [TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.IMPORTANT].forEach(cat => {
      const existing = existingCategorized[cat] || [];
      
      // Add existing tabs that weren't in the processed list
      existing.forEach(tab => {
        if (!processedIds.has(tab.id)) {
          mergedResult[cat].push(tab);
        }
      });
    });
    
    // Update state with categorized tabs for immediate UI update
    updateState('categorizedTabs', mergedResult);
    updateState('urlToDuplicateIds', urlToDuplicateIds);
    
    // Save categorized tabs to database
    await window.tabDatabase.saveCategorizedTabs(mergedResult);
    
    // Update UI
    updateCategorizeBadge();
    showStatus(STATUS_MESSAGES.SUCCESS_CATEGORIZED, 'success');
    
    // Save state
    await savePopupState();
    
    // Trigger display update
    const { displayTabs } = await import('./tab-display.js');
    displayTabs();
    
    // Show the tabs container and toolbar
    const { show } = await import('../utils/dom-helpers.js');
    const { DOM_IDS } = await import('../utils/constants.js');
    const { $id } = await import('../utils/dom-helpers.js');
    show($id(DOM_IDS.TABS_CONTAINER));
    
    // Show unified toolbar
    const { showToolbar } = await import('./unified-toolbar.js');
    showToolbar();
    
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
export async function moveTabToCategory(tab, fromCategory, toCategory) {
  if (fromCategory === toCategory) return;
  
  try {
    // Process as user correction for ML learning
    if (state.mlMetadata && state.mlMetadata[tab.id]) {
      try {
        const { getMLCategorizer } = await import('../ml/categorization/ml-categorizer.js');
        const mlCategorizer = await getMLCategorizer();
        await mlCategorizer.processCorrection(
          tab, 
          fromCategory, 
          toCategory, 
          state.mlMetadata[tab.id]
        );
      } catch (error) {
        console.log('Could not process ML correction:', error);
      }
    }
    // Update database first
    const urlInfo = await window.tabDatabase.getUrlInfo(tab.url);
    
    if (urlInfo) {
      // Tab already exists in database, update it
      const success = await window.tabDatabase.updateUrlCategory(tab.url, toCategory);
      if (!success) {
        // If update failed, try to create new entry
        await window.tabDatabase.getOrCreateUrl(tab, toCategory);
      }
    } else {
      // Tab not in database yet, create it
      await window.tabDatabase.getOrCreateUrl(tab, toCategory);
    }
    
    // Update local state
    const categorizedTabs = state.categorizedTabs || {};
    
    // Remove tab from old category
    if (categorizedTabs[fromCategory]) {
      categorizedTabs[fromCategory] = categorizedTabs[fromCategory].filter(t => t.id !== tab.id);
    }
    
    // Add tab to new category
    if (!categorizedTabs[toCategory]) {
      categorizedTabs[toCategory] = [];
    }
    // Update the tab's category
    const updatedTab = { ...tab };
    updatedTab.knownCategory = toCategory;
    updatedTab.alreadySaved = true; // Mark as saved since we just saved it
    categorizedTabs[toCategory].push(updatedTab);
    
    // Update state
    updateState('categorizedTabs', categorizedTabs);
    
    // Save state
    await savePopupState();
    
    updateCategorizeBadge();
    
    // Trigger UI update
    const { displayTabs } = await import('./tab-display.js');
    await displayTabs();
    
    showStatus(`Moved to ${CATEGORY_NAMES[toCategory]}`, 'success');
    
  } catch (error) {
    console.error('Error moving tab:', error);
    showStatus('Error moving tab', 'error');
  }
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
 * @returns {Promise<Object>} Stats object
 */
export async function getCategorizationStats() {
  const { getCurrentTabs } = await import('./tab-data-source.js');
  const { categorizedTabs, urlToDuplicateIds } = await getCurrentTabs();
  
  const stats = {
    total: 0,
    byCategory: {
      [TAB_CATEGORIES.CAN_CLOSE]: categorizedTabs[TAB_CATEGORIES.CAN_CLOSE]?.length || 0,
      [TAB_CATEGORIES.SAVE_LATER]: categorizedTabs[TAB_CATEGORIES.SAVE_LATER]?.length || 0,
      [TAB_CATEGORIES.IMPORTANT]: categorizedTabs[TAB_CATEGORIES.IMPORTANT]?.length || 0
    },
    duplicates: Object.keys(urlToDuplicateIds).length,
    saved: 0
  };
  
  stats.total = stats.byCategory[TAB_CATEGORIES.CAN_CLOSE] + 
                stats.byCategory[TAB_CATEGORIES.SAVE_LATER] + 
                stats.byCategory[TAB_CATEGORIES.IMPORTANT];
  
  // Count saved tabs
  Object.values(categorizedTabs).forEach(tabs => {
    if (tabs) {
      tabs.forEach(tab => {
        if (tab.alreadySaved) stats.saved++;
      });
    }
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
  getCategorizationStats,
  applyRulesToTabs
};