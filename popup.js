/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Main popup entry point - coordinates all modules
 */

// Import all modules
import './config.js'; // Load CONFIG global first

// Import constants
import { TAB_CATEGORIES, DOM_IDS, CSS_CLASSES, DISPLAY, EVENTS } from './src/utils/constants.js';

// Import helpers
import { getRootDomain, extractDomain, formatDate } from './src/utils/helpers.js';
import { $, $id, show, hide, on } from './src/utils/dom-helpers.js';

// Import services
import ChromeAPIService from './src/services/ChromeAPIService.js';
import StorageService from './src/services/StorageService.js';
import MessageService from './src/services/MessageService.js';

// Import feature modules
import { state } from './src/modules/state-manager.js';
import { showStatus } from './src/modules/ui-manager.js';
import { displayTabs } from './src/modules/tab-display.js';
import { handleCategorize } from './src/modules/categorization-service.js';
import { closeTab, saveAndCloseAll, moveTab } from './src/modules/tab-operations.js';
import { showSavedTabsContent } from './src/modules/saved-tabs-manager.js';
import { onSearchInput, clearSearch } from './src/modules/search-filter.js';
import { exportToCSV, handleCSVImport } from './src/modules/import-export.js';
import { onProviderChange, onModelChange, saveApiKey, resetPrompt } from './src/modules/settings-manager.js';
import { initializeApp, setupAutoSave } from './src/modules/app-initializer.js';

// Database is loaded as a global in popup.html

// Debug utilities
window.DEBUG = {
  logState: () => console.log('Current state:', state),
  testCategorization: () => handleCategorize(),
  version: 'refactored-v2',
  checkDOM: () => {
    const elements = [
      'categorizeBtn', 'tabsContainer', 'searchInput', 
      'savedContent', 'groupingSelect', 'savedGroupingSelect'
    ];
    const missing = elements.filter(id => !document.getElementById(id));
    console.log('DOM Check:', missing.length ? `Missing: ${missing}` : 'All elements found');
  },
  testTabChange: () => {
    console.log('Testing tab change notification...');
    if (window.handleTabChangeFromBackground) {
      window.handleTabChangeFromBackground({
        changeType: 'removed',
        tab: { id: 12345 },
        timestamp: Date.now()
      });
    } else {
      console.log('Handler not found!');
    }
  }
};

// Set up auto-save handlers
setupAutoSave();

// Pre-initialize state synchronously before DOM is ready
async function preInitialize() {
  try {
    // Load saved state from storage COMPLETELY before any DOM operations
    const savedPopupState = await StorageService.loadPopupState();
    const savedSettings = await StorageService.loadSettings();
    
    // Apply saved state to global state object
    if (savedPopupState) {
      Object.assign(state.popupState, savedPopupState);
      state.isViewingSaved = savedPopupState.isViewingSaved || false;
      state.searchQuery = savedPopupState.searchQuery || '';
    }
    
    if (savedSettings) {
      Object.assign(state.settings, savedSettings);
    }
    
    // Determine which tab should be active BEFORE any DOM operations
    let targetTab = 'categorize'; // Default
    
    // Override with saved state if available
    if (savedPopupState && savedPopupState.activeTab) {
      targetTab = savedPopupState.activeTab;
    }
    
    // Check if we have current tabs (fallback logic)
    const allTabs = await ChromeAPIService.queryTabs({});
    const hasTabs = allTabs && allTabs.length > 0;
    
    if (!hasTabs && targetTab === 'categorize') {
      targetTab = 'saved';
    }
    
    // Store the determined tab globally for app initialization
    window._targetTab = targetTab;
    state.popupState.activeTab = targetTab;
    
    // Wait for DOM to be ready, then initialize with pre-loaded state
    const initializeDom = () => {
      // Initialize the app with pre-loaded state
      initializeApp();
    };
    
    // Check if DOM is already loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeDom);
    } else {
      // DOM is already loaded, initialize immediately
      initializeDom();
    }
  } catch (error) {
    console.error('Pre-initialization error:', error);
    // Fall back to normal initialization
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
      initializeApp();
    }
  }
}

// Add popup lifecycle logging
console.log('=== POPUP LIFECYCLE: Script loaded ===');
console.log('Document readyState:', document.readyState);
console.log('Timestamp:', new Date().toISOString());

// Handle CSP eval errors from TensorFlow.js gracefully
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('unsafe-eval')) {
    console.log('=== CSP ERROR: TensorFlow.js eval blocked (expected in Chrome extensions) ===');
    console.log('ML features will be disabled due to Chrome extension CSP restrictions');
    event.preventDefault(); // Prevent the error from being thrown
    return false;
  }
});

// Handle unhandled promise rejections that might be CSP related
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('unsafe-eval')) {
    event.preventDefault();
    return false;
  }
});





// Start pre-initialization immediately
preInitialize();

// Export commonly used functions for inline event handlers if needed
window.aiTabManager = {
  handleCategorize,
  displayTabs,
  closeTab,
  saveAndCloseAll,
  moveTab,
  showSavedTabsContent,
  onSearchInput,
  clearSearch,
  exportToCSV,
  handleCSVImport,
  showStatus
};