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
      console.log('Applying CONFIG defaults to settings');
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
    
    // Apply default rules if not already applied
    if (!state.settings.defaultRulesApplied) {
      const defaultRules = getDefaultRules();
      state.settings.rules = [...defaultRules, ...state.settings.rules];
      state.settings.defaultRulesApplied = true;
      await StorageService.saveSettings(state.settings);
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
    // IMPORTANT: Rules are evaluated in order - first match wins!
    // More specific rules should come before general ones
    // 
    // Pattern: Specific content URLs come before domain rules
    // Example: youtube.com/watch?v=X (Save Later) before youtube.com (Ignore)
    // This ensures specific videos/posts are saved while homepages can be closed
    
    // Category 3: Hard to Refind (> 2min) - Most specific rules first
    {
      id: 'default-1',
      type: 'urlContains',
      value: 'claude.ai/chat/',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-2',
      type: 'urlContains',
      value: 'chatgpt.com/c/',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-3',
      type: 'urlContains',
      value: 'gemini.google.com/app/',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-4',
      type: 'urlContains',
      value: 'localhost',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-5',
      type: 'urlContains',
      value: '127.0.0.1',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-6',
      type: 'urlContains',
      value: '/order/',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-7',
      type: 'urlContains',
      value: '/checkout',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-8',
      type: 'urlContains',
      value: '/payment',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-9',
      type: 'urlContains',
      value: '/transaction/',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-10',
      type: 'urlContains',
      value: 'session=',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-11',
      type: 'urlContains',
      value: 'token=',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-12',
      type: 'titleContains',
      value: 'Unsaved',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-13',
      type: 'titleContains',
      value: 'Draft',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    {
      id: 'default-14',
      type: 'regex',
      value: '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',
      category: TAB_CATEGORIES.IMPORTANT,
      enabled: true
    },
    
    // Category 2: Moderate Effort (10s-2min) - Less specific, searchable content
    // Specific content on general sites (must come before domain rules)
    {
      id: 'default-15',
      type: 'urlContains',
      value: 'youtube.com/watch?v=',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-16',
      type: 'urlContains',
      value: 'youtube.com/playlist',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-17',
      type: 'urlContains',
      value: 'reddit.com/r/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-18',
      type: 'urlContains',
      value: 'twitter.com/status/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-19',
      type: 'urlContains',
      value: 'x.com/status/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-20',
      type: 'urlContains',
      value: 'linkedin.com/posts/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-21',
      type: 'urlContains',
      value: 'facebook.com/posts/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-22',
      type: 'urlContains',
      value: 'instagram.com/p/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-23',
      type: 'urlContains',
      value: 'amazon.com/dp/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-24',
      type: 'urlContains',
      value: 'amazon.com/gp/product/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-25',
      type: 'urlContains',
      value: 'github.com/pull/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-26',
      type: 'urlContains',
      value: 'github.com/issues/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-27',
      type: 'domain',
      value: 'stackoverflow.com',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-28',
      type: 'domain',
      value: 'medium.com',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-29',
      type: 'domain',
      value: 'dev.to',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-30',
      type: 'urlContains',
      value: '/docs/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-31',
      type: 'urlContains',
      value: '/documentation/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-32',
      type: 'urlContains',
      value: '/guide/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-33',
      type: 'urlContains',
      value: '/tutorial/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-34',
      type: 'urlContains',
      value: '/article/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    {
      id: 'default-35',
      type: 'urlContains',
      value: '/blog/',
      category: TAB_CATEGORIES.SAVE_LATER,
      enabled: true
    },
    
    // Category 1: Easy to Refind (< 10 seconds) - Most general rules last
    // These should be homepages only, not specific content
    {
      id: 'default-36',
      type: 'domain',
      value: 'google.com',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-37',
      type: 'domain',
      value: 'youtube.com',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-38',
      type: 'domain',
      value: 'gmail.com',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-39',
      type: 'domain',
      value: 'amazon.com',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-40',
      type: 'domain',
      value: 'facebook.com',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-41',
      type: 'domain',
      value: 'twitter.com',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-42',
      type: 'domain',
      value: 'x.com',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-43',
      type: 'domain',
      value: 'instagram.com',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-44',
      type: 'domain',
      value: 'linkedin.com',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-45',
      type: 'domain',
      value: 'reddit.com',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-46',
      type: 'domain',
      value: 'netflix.com',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-47',
      type: 'urlContains',
      value: '/login',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-48',
      type: 'urlContains',
      value: '/signin',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-49',
      type: 'titleContains',
      value: 'New Tab',
      category: TAB_CATEGORIES.CAN_CLOSE,
      enabled: true
    },
    {
      id: 'default-50',
      type: 'titleContains',
      value: 'Google Search',
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
  console.log('Initialization complete, state saving enabled');
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