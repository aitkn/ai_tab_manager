/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * State management module - handles all state persistence and restoration
 */

import { STORAGE_KEYS, TAB_CATEGORIES } from '../utils/constants.js';
import StorageService from '../services/StorageService.js';

// Global state object
export const state = {
  isViewingSaved: false,
  searchQuery: '',
  isInitializing: true,
  popupState: {
    isViewingSaved: false,
    searchQuery: '',
    activeTab: 'categorize',
    groupingSelections: {
      categorize: 'category',
      saved: 'category'
    },
    scrollPositions: {},
    showAllCategories: false
  },
  settings: {
    provider: 'Claude',
    model: '',
    apiKeys: {},
    selectedModels: {},
    customPrompt: '',
    promptVersion: 1,
    isPromptCustomized: false,
    maxTabsToOpen: 50,
    rules: [],  // Array of rule objects
    useLLM: true,  // Whether to use LLM for categorization
    useML: true,  // Whether to use ML categorization
    mlEpochs: 10,  // Number of epochs for ML training
    hasConfiguredSettings: false,  // First-time use flag
    defaultRulesApplied: false  // Whether default rules have been added
  }
};

// State change listeners
const stateListeners = [];

/**
 * Subscribe to state changes
 * @param {Function} listener - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribeToState(listener) {
  stateListeners.push(listener);
  return () => {
    const index = stateListeners.indexOf(listener);
    if (index > -1) {
      stateListeners.splice(index, 1);
    }
  };
}

/**
 * Notify all state listeners
 */
function notifyStateListeners() {
  stateListeners.forEach(listener => listener(state));
}

/**
 * Update state and notify listeners
 * @param {string} key - State key to update
 * @param {any} value - New value
 */
export function updateState(key, value) {
  if (state.hasOwnProperty(key)) {
    state[key] = value;
    notifyStateListeners();
  }
}

/**
 * Update nested state
 * @param {string} path - Dot notation path (e.g., 'popupState.isViewingSaved')
 * @param {any} value - New value
 */
export function updateNestedState(path, value) {
  const keys = path.split('.');
  let obj = state;
  
  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
  }
  
  obj[keys[keys.length - 1]] = value;
  notifyStateListeners();
}

/**
 * Save current popup state to storage
 */
export async function savePopupState() {
  if (state.isInitializing) {
    console.log('Skipping state save during initialization');
    return;
  }

  // Update popup state object
  state.popupState.isViewingSaved = state.isViewingSaved;
  state.popupState.searchQuery = state.searchQuery;
  
  // Get current scroll positions for all scrollable containers
  const tabsContainer = document.getElementById('tabsContainer');
  const savedContent = document.getElementById('savedContent');
  
  if (tabsContainer && tabsContainer.scrollTop > 0) {
    state.popupState.scrollPositions.categorize = tabsContainer.scrollTop;
  }
  if (savedContent && savedContent.scrollTop > 0) {
    state.popupState.scrollPositions.saved = savedContent.scrollTop;
  }

  try {
    await StorageService.savePopupState(state.popupState);
    console.log('Popup state saved:', state.popupState);
  } catch (error) {
    console.error('Error saving popup state:', error);
  }
}

/**
 * Load saved state from storage
 */
export async function loadSavedState() {
  try {
    // Load popup state
    const savedPopupState = await StorageService.loadPopupState();
    if (savedPopupState) {
      Object.assign(state.popupState, savedPopupState);
      
      state.isViewingSaved = savedPopupState.isViewingSaved || false;
      state.searchQuery = savedPopupState.searchQuery || '';
    }
    
    // Load settings
    const savedSettings = await StorageService.loadSettings();
    if (savedSettings) {
      Object.assign(state.settings, savedSettings);
    }
    
    // Apply defaults from CONFIG if available and not already set
    if (typeof CONFIG !== 'undefined') {
      if (!state.settings.provider || state.settings.provider === '') {
        state.settings.provider = CONFIG.DEFAULT_PROVIDER || 'Claude';
      }
      if (!state.settings.customPrompt || state.settings.customPrompt === '') {
        state.settings.customPrompt = CONFIG.DEFAULT_PROMPT || '';
      }
      if (!state.settings.promptVersion || state.settings.promptVersion === 1) {
        state.settings.promptVersion = CONFIG.PROMPT_VERSION || 1;
      }
    } else {
      console.warn('CONFIG not available when loading settings');
    }
    
    // Apply default rules if not already applied or if rules array is empty
    
    if (!state.settings.defaultRulesApplied || !state.settings.rules || state.settings.rules.length === 0) {
      const defaultRules = getDefaultRules();
      
      // Ensure rules array exists
      if (!state.settings.rules) {
        state.settings.rules = [];
      }
      
      // Only add rules that don't already exist (check by id)
      const existingIds = new Set(state.settings.rules.map(r => r.id));
      const newRules = defaultRules.filter(rule => !existingIds.has(rule.id));
      
      if (newRules.length > 0) {
        // Add new default rules at the beginning
        state.settings.rules = [...newRules, ...state.settings.rules];
        console.log('Added', newRules.length, 'new default rules');
      }
      
      state.settings.defaultRulesApplied = true;
      // Also mark as configured since we've set up default rules
      state.settings.hasConfiguredSettings = true;
      await StorageService.saveSettings(state.settings);
      console.log('Default rules initialization complete. Total rules:', state.settings.rules.length);
    }
    
    return true;
  } catch (error) {
    console.error('Error loading saved state:', error);
    return false;
  }
}

/**
 * Restore scroll position for a container
 * @param {string} containerId - ID of the container
 * @param {number} scrollTop - Scroll position
 * @param {number} retryCount - Number of retries
 */
export function restoreScrollPosition(containerId, scrollTop, retryCount = 0) {
  const container = document.getElementById(containerId);
  
  if (container && scrollTop > 0) {
    // Check if content is ready (has height)
    if (container.scrollHeight > container.clientHeight) {
      console.log(`Restoring scroll position for ${containerId}: ${scrollTop}`);
      container.scrollTop = scrollTop;
      
      // Verify it was set (sometimes needs a delay)
      setTimeout(() => {
        if (container.scrollTop !== scrollTop && retryCount < 2) {
          console.log(`Retrying scroll restoration for ${containerId}`);
          restoreScrollPosition(containerId, scrollTop, retryCount + 1);
        }
      }, 100);
    } else if (retryCount < 3) {
      // Content not ready yet, retry
      setTimeout(() => {
        restoreScrollPosition(containerId, scrollTop, retryCount + 1);
      }, retryCount === 0 ? 100 : 500);
    }
  }
}

/**
 * Get default categorization rules
 * @returns {Array} Default rules
 */
export function getDefaultRules() {
  return [
    // Essential rules covering most common patterns - let ML learn user preferences over time
    
    // Category 3: Important - Specific content that's hard to find again
    {
      id: 'default-1',
      type: 'urlContains',
      value: '/checkout',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-2',
      type: 'urlContains',
      value: '/payment',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-3',
      type: 'titleContains',
      value: 'Unsaved',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-4',
      type: 'titleContains',
      value: 'Draft',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    // Specific articles and posts
    {
      id: 'default-5',
      type: 'urlContains',
      value: 'youtube.com/watch',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-6',
      type: 'urlContains',
      value: 'x.com/status/',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-7',
      type: 'urlContains',
      value: 'twitter.com/status/',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-8',
      type: 'urlContains',
      value: 'reddit.com/r/',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-9',
      type: 'urlContains',
      value: '/article',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-10',
      type: 'urlContains',
      value: '/news/',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-11',
      type: 'urlContains',
      value: 'techcrunch.com/',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-12',
      type: 'urlContains',
      value: 'arstechnica.com/',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    
    // Category 2: Useful - LLM conversations and useful content
    {
      id: 'default-13',
      type: 'urlContains',
      value: 'claude.ai/chat/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-14',
      type: 'urlContains',
      value: 'chatgpt.com/c/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-15',
      type: 'urlContains',
      value: 'gemini.google.com/app/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-16',
      type: 'urlContains',
      value: 'poe.com/chat/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    
    // Category 1: Ignore (Can Close) - Homepages that are easy to find again
    {
      id: 'default-17',
      type: 'titleContains',
      value: 'New Tab',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-18',
      type: 'titleContains',
      value: 'Google Search',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    // Top 10 sites homepages
    {
      id: 'default-19',
      type: 'regex',
      value: '^https?://(www\\.)?google\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-20',
      type: 'regex',
      value: '^https?://(www\\.)?youtube\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-21',
      type: 'regex',
      value: '^https?://(www\\.)?facebook\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-22',
      type: 'regex',
      value: '^https?://(www\\.)?amazon\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-23',
      type: 'regex',
      value: '^https?://(www\\.)?wikipedia\\.org/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-24',
      type: 'regex',
      value: '^https?://(www\\.)?twitter\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-25',
      type: 'regex',
      value: '^https?://(www\\.)?x\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-26',
      type: 'regex',
      value: '^https?://(www\\.)?instagram\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-27',
      type: 'regex',
      value: '^https?://(www\\.)?linkedin\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-28',
      type: 'regex',
      value: '^https?://(www\\.)?reddit\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    // Email homepages
    {
      id: 'default-29',
      type: 'regex',
      value: '^https?://(mail\\.)?google\\.com/(mail/?)?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-30',
      type: 'regex',
      value: '^https?://(www\\.)?outlook\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-31',
      type: 'regex',
      value: '^https?://(www\\.)?yahoo\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    // Bank homepages
    {
      id: 'default-32',
      type: 'regex',
      value: '^https?://(www\\.)?bankofamerica\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-33',
      type: 'regex',
      value: '^https?://(www\\.)?chase\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-34',
      type: 'regex',
      value: '^https?://(www\\.)?wellsfargo\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    // News homepages
    {
      id: 'default-35',
      type: 'regex',
      value: '^https?://(www\\.)?cnn\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-36',
      type: 'regex',
      value: '^https?://(www\\.)?bbc\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-37',
      type: 'regex',
      value: '^https?://(www\\.)?nytimes\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-38',
      type: 'regex',
      value: '^https?://(www\\.)?washingtonpost\\.com/?$',
      field: 'url',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    }
  ];
}

/**
 * Clear categorized tabs state
 */
export function clearCategorizedTabs() {
  state.categorizedTabs = {
    [TAB_CATEGORIES.UNCATEGORIZED]: [],
    [TAB_CATEGORIES.CAN_CLOSE]: [],
    [TAB_CATEGORIES.SAVE_LATER]: [],
    [TAB_CATEGORIES.IMPORTANT]: []
  };
  state.urlToDuplicateIds = {};
  notifyStateListeners();
}

/**
 * Set initialization complete
 */
export function setInitializationComplete() {
  state.isInitializing = false;
}

/**
 * Get current state (read-only)
 * @returns {Object} Current state
 */
export function getState() {
  return JSON.parse(JSON.stringify(state)); // Deep clone to prevent mutations
}

/**
 * Check if currently viewing saved tabs
 * @returns {boolean}
 */
export function isViewingSavedTabs() {
  return state.isViewingSaved;
}

/**
 * Set viewing saved tabs state
 * @param {boolean} viewing
 */
export function setViewingSavedTabs(viewing) {
  state.isViewingSaved = viewing;
  state.popupState.isViewingSaved = viewing;
  notifyStateListeners();
}

// Auto-save state on changes
let saveTimeout;
export function debouncedSaveState() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    savePopupState();
  }, 500);
}

// Export default object for convenience
export default {
  state,
  subscribeToState,
  updateState,
  updateNestedState,
  savePopupState,
  loadSavedState,
  restoreScrollPosition,
  clearCategorizedTabs,
  setInitializationComplete,
  getState,
  isViewingSavedTabs,
  setViewingSavedTabs,
  debouncedSaveState,
  getDefaultRules
};