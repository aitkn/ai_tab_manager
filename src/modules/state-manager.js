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
    rules: []  // Array of rule objects
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
  debouncedSaveState
};