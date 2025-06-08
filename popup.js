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
console.log('AI Tab Manager Debug Mode - Version:', window.DEBUG.version);

// Set up auto-save handlers
setupAutoSave();

// Pre-initialize state synchronously before DOM is ready
async function preInitialize() {
  console.log('=== POPUP LIFECYCLE: Pre-initialization started ===');
  try {
    // Load saved state from storage synchronously
    const savedPopupState = await StorageService.loadPopupState();
    const savedSettings = await StorageService.loadSettings();
    console.log('Loaded saved state:', { savedPopupState, savedSettings });
    
    // Apply saved state
    if (savedPopupState) {
      Object.assign(state.popupState, savedPopupState);
      state.isViewingSaved = savedPopupState.isViewingSaved || false;
      state.searchQuery = savedPopupState.searchQuery || '';
    }
    
    if (savedSettings) {
      Object.assign(state.settings, savedSettings);
    }
    
    // Determine which tab should be active
    let targetTab = 'categorize'; // Default to categorize
    
    // Only override if we have a valid saved activeTab
    if (savedPopupState && savedPopupState.activeTab) {
      targetTab = savedPopupState.activeTab;
    }
    
    console.log('DEBUG: Target tab determined:', {
      fromSavedState: savedPopupState?.activeTab,
      finalTarget: targetTab,
      hasConfiguredSettings: state.settings?.hasConfiguredSettings,
      fullSavedState: savedPopupState,
      fullSettings: savedSettings
    });
    
    // Quick check if we have any current tabs (just check chrome tabs, not database)
    const allTabs = await ChromeAPIService.queryTabs({});
    const hasTabs = allTabs && allTabs.length > 0;
    
    console.log('DEBUG: Tab switching logic:', {
      hasTabs: hasTabs,
      tabCount: allTabs?.length || 0,
      originalTarget: targetTab
    });
    
    if (!hasTabs && targetTab === 'categorize') {
      console.log('DEBUG: No tabs found, switching from categorize to saved');
      targetTab = 'saved';
    }
    
    // Set initial DOM state before it's visible
    const initializeDom = () => {
      // Set the correct active classes immediately
      document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === targetTab) {
          btn.classList.add('active');
        }
      });
      
      document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane.id === `${targetTab}Tab`) {
          pane.classList.add('active');
        }
      });
      
      // Store the target tab for initializeApp to use
      window._targetTab = targetTab;
      
      // Now initialize the app
      console.log('=== POPUP LIFECYCLE: About to call initializeApp ===');
      initializeApp();
    };
    
    // Check if DOM is already loaded
    if (document.readyState === 'loading') {
      console.log('=== POPUP LIFECYCLE: DOM still loading, adding DOMContentLoaded listener ===');
      document.addEventListener('DOMContentLoaded', initializeDom);
    } else {
      // DOM is already loaded, initialize immediately
      console.log('=== POPUP LIFECYCLE: DOM already loaded, initializing immediately ===');
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
    console.log('=== CSP PROMISE REJECTION: TensorFlow.js eval blocked (expected) ===');
    event.preventDefault();
    return false;
  }
});

// Log when popup becomes visible/hidden
document.addEventListener('visibilitychange', () => {
  console.log('=== POPUP LIFECYCLE: Visibility changed ===');
  console.log('Hidden:', document.hidden);
  console.log('Visibility state:', document.visibilityState);
  console.log('Timestamp:', new Date().toISOString());
});

// Log when popup is about to close
window.addEventListener('beforeunload', () => {
  console.log('=== POPUP LIFECYCLE: About to unload ===');
  console.log('Timestamp:', new Date().toISOString());
});

// Log when popup loses focus
window.addEventListener('blur', () => {
  console.log('=== POPUP LIFECYCLE: Window blur ===');
  console.log('Timestamp:', new Date().toISOString());
});

// Log when popup gains focus
window.addEventListener('focus', () => {
  console.log('=== POPUP LIFECYCLE: Window focus ===');
  console.log('Timestamp:', new Date().toISOString());
});

// Start pre-initialization immediately
console.log('=== POPUP LIFECYCLE: Starting pre-initialization ===');
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