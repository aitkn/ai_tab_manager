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

// Import flicker-free UI system
import flickerFreeUI from './src/core/flicker-free-ui.js';

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

// Load state and initialize DOM atomically - no async operations
function initializeWithState() {
  console.log('🔄 POPUP INIT: initializeWithState called');
  
  // Load both popup state and settings in a single call
  chrome.storage.local.get(['popupState', 'settings'], (result) => {
    console.log('🔄 POPUP INIT: Storage callback fired', result);
    
    // Apply loaded state immediately
    const savedPopupState = result.popupState || null;
    const savedSettings = result.settings || null;
    
    console.log('🔄 POPUP INIT: Saved popup state:', savedPopupState);
    
    if (savedPopupState) {
      Object.assign(state.popupState, savedPopupState);
      state.isViewingSaved = savedPopupState.isViewingSaved || false;
      state.searchQuery = savedPopupState.searchQuery || '';
      console.log('🔄 POPUP INIT: Applied saved popup state');
    }
    
    if (savedSettings) {
      Object.assign(state.settings, savedSettings);
      console.log('🔄 POPUP INIT: Applied saved settings');
    }
    
    // Determine target tab
    let targetTab = 'categorize'; // Default
    if (savedPopupState && savedPopupState.activeTab) {
      targetTab = savedPopupState.activeTab;
    }
    
    console.log('🔄 POPUP INIT: Target tab determined:', targetTab);
    
    // Store globally and update state
    window._targetTab = targetTab;
    state.popupState.activeTab = targetTab;
    
    console.log('🔄 POPUP INIT: Setting DOM classes for tab:', targetTab);
    
    // Check initial DOM state
    console.log('🔄 POPUP INIT: Initial active tab buttons:', 
      Array.from(document.querySelectorAll('.tab-btn.active')).map(btn => btn.dataset.tab));
    console.log('🔄 POPUP INIT: Initial active tab panes:', 
      Array.from(document.querySelectorAll('.tab-pane.active')).map(pane => pane.id));
    
    // Set correct DOM state immediately BEFORE any initialization
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === targetTab) {
        btn.classList.add('active');
        console.log('🔄 POPUP INIT: Set active class on tab btn:', btn.dataset.tab);
      }
    });
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
      if (pane.id === `${targetTab}Tab`) {
        pane.classList.add('active');
        console.log('🔄 POPUP INIT: Set active class on tab pane:', pane.id);
      }
    });
    
    // Check final DOM state
    console.log('🔄 POPUP INIT: Final active tab buttons:', 
      Array.from(document.querySelectorAll('.tab-btn.active')).map(btn => btn.dataset.tab));
    console.log('🔄 POPUP INIT: Final active tab panes:', 
      Array.from(document.querySelectorAll('.tab-pane.active')).map(pane => pane.id));
    
    console.log('🔄 POPUP INIT: About to call app initialization');
    
    // Initialize the app
    console.log('🔄 POPUP INIT: Starting app initialization');
    
    // Initialize only the legacy system
    initializeApp().then(() => {
      console.log('✅ POPUP INIT: App initialization completed successfully');
    }).catch(error => {
      console.error('❌ POPUP INIT: App initialization failed:', error);
    });
  });
}

// Initialize when DOM is ready
function preInitialize() {
  console.log('🔄 FLICKER DEBUG: preInitialize called, readyState:', document.readyState);
  
  if (document.readyState === 'loading') {
    console.log('🔄 FLICKER DEBUG: Adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', initializeWithState);
  } else {
    console.log('🔄 FLICKER DEBUG: DOM already loaded, calling initializeWithState');
    // DOM is already loaded, initialize immediately
    initializeWithState();
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