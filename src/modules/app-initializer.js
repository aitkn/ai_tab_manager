/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * App Initializer - handles application initialization
 */

import { DOM_IDS, CSS_CLASSES, EVENTS, TAB_TYPES } from '../utils/constants.js';
import { $id, show, hide, on } from '../utils/dom-helpers.js';
import { initializeTheme, switchToTab, showStatus, updateCategorizeBadge, showApiKeyPrompt } from './ui-manager.js';
import { state, loadSavedState, setInitializationComplete, restoreScrollPosition, savePopupState } from './state-manager.js';
import { setupEventListeners } from './event-handlers.js';
import { displayTabs } from './tab-display.js';
import { applySearchFilter } from './search-filter.js';
import { showSavedTabsContent, loadSavedTabsCount } from './saved-tabs-manager.js';
// Database is available as window.window.tabDatabase
import StorageService from '../services/StorageService.js';
import ChromeAPIService from '../services/ChromeAPIService.js';

/**
 * Wait for database to be loaded
 */
async function waitForDatabase() {
  const maxAttempts = 50; // 5 seconds max
  let attempts = 0;
  
  while (!window.tabDatabase && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (!window.tabDatabase) {
    throw new Error('Database failed to load after 5 seconds');
  }
}

/**
 * Main initialization function
 */
export async function initializeApp() {
  console.log('Popup loaded, initializing...');
  
  try {
    // Wait for database to be available
    if (!window.tabDatabase) {
      console.log('Waiting for database to load...');
      await waitForDatabase();
    }
    
    // Check for unauthorized copies
    checkExtensionIntegrity();
    
    // Initialize theme
    initializeTheme();
    
    // Initialize database
    await window.tabDatabase.init();
    console.log('Database initialized');
    
    // Load saved state
    await loadSavedState();
    
    // Check if default prompt needs updating
    if (!state.settings.isPromptCustomized && 
        state.settings.promptVersion < CONFIG.PROMPT_VERSION) {
      console.log('Updating to new default prompt (version', CONFIG.PROMPT_VERSION, ')');
      state.settings.customPrompt = CONFIG.DEFAULT_PROMPT;
      state.settings.promptVersion = CONFIG.PROMPT_VERSION;
      await StorageService.saveSettings(state.settings);
    }
    
    // Check for API key
    const hasApiKey = Object.values(state.settings.apiKeys).some(key => key);
    if (!hasApiKey) {
      showApiKeyPrompt();
    }
    
    // Restore UI state
    await restoreUIState();
    
    console.log('Loaded settings:', state.settings);
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize tab navigation
    initializeTabNavigation();
    
    // Initialize saved tabs content
    if (state.popupState) {
      const savedGrouping = state.popupState.groupingSelections?.saved || 'category';
      await showSavedTabsContent(savedGrouping).catch(console.error);
    }
    
    // Restore active tab
    await restoreActiveTab();
    
    // Mark initialization complete
    setInitializationComplete();
    
    // Update saved tab badge
    await loadSavedTabsCount();
    
  } catch (error) {
    console.error('Error during initialization:', error);
    showStatus('Error initializing extension', 'error');
  }
}

/**
 * Restore UI state from saved data
 */
async function restoreUIState() {
  // Restore grouping selections
  const groupingSelect = $id(DOM_IDS.GROUPING_SELECT);
  if (groupingSelect && state.popupState.groupingSelections?.categorize) {
    groupingSelect.value = state.popupState.groupingSelections.categorize;
  }
  
  const savedGroupingSelect = $id(DOM_IDS.SAVED_GROUPING_SELECT);
  if (savedGroupingSelect && state.popupState.groupingSelections?.saved) {
    savedGroupingSelect.value = state.popupState.groupingSelections.saved;
  }
  
  // Restore categorized tabs if available
  if (state.popupState.categorizedTabs && !state.popupState.isViewingSaved) {
    state.categorizedTabs = state.popupState.categorizedTabs;
    
    const hasCategories = Object.values(state.categorizedTabs)
      .some(tabs => tabs.length > 0);
      
    if (hasCategories) {
      show($id(DOM_IDS.TABS_CONTAINER));
      show($id(DOM_IDS.SEARCH_CONTROLS), 'flex');
      show('.action-buttons', 'flex');
      show($id(DOM_IDS.CATEGORIZE_GROUPING_CONTROLS), 'flex');
      displayTabs();
      updateCategorizeBadge();
    }
  }
  
  // Restore search
  if (state.searchQuery) {
    const searchInput = $id(DOM_IDS.SEARCH_INPUT);
    if (searchInput) {
      searchInput.value = state.searchQuery;
      applySearchFilter();
    }
  }
}

/**
 * Restore active tab and scroll positions
 */
async function restoreActiveTab() {
  if (state.popupState?.activeTab) {
    // Set scroll positions with both panes temporarily visible
    if (state.popupState.scrollPositions) {
      const categorizeTab = $id('categorizeTab');
      const savedTab = $id('savedTab');
      
      if (categorizeTab) categorizeTab.classList.add(CSS_CLASSES.TAB_PANE_ACTIVE);
      if (savedTab) savedTab.classList.add(CSS_CLASSES.TAB_PANE_ACTIVE);
      
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        // Set scroll for categorize tab
        if (state.popupState.scrollPositions.categorize) {
          const tabsContainer = $id(DOM_IDS.TABS_CONTAINER);
          if (tabsContainer) {
            console.log('Pre-setting categorize scroll to:', state.popupState.scrollPositions.categorize);
            tabsContainer.scrollTop = state.popupState.scrollPositions.categorize;
          }
        }
        
        // Set scroll for saved tab
        if (state.popupState.scrollPositions.saved) {
          const savedContent = $id(DOM_IDS.SAVED_CONTENT);
          if (savedContent) {
            console.log('Pre-setting saved scroll to:', state.popupState.scrollPositions.saved);
            savedContent.scrollTop = state.popupState.scrollPositions.saved;
          }
        }
        
        // Now switch to the correct tab
        setTimeout(() => {
          console.log('Restoring active tab:', state.popupState.activeTab);
          switchToTab(state.popupState.activeTab);
          
          // Restore scroll position again after tab switch
          const activeTabName = state.popupState.activeTab;
          setTimeout(() => {
            restoreScrollPosition(activeTabName, 100);
            restoreScrollPosition(activeTabName, 500);
            restoreScrollPosition(activeTabName, 1000);
          }, 100);
        }, 50);
      });
    } else {
      // No scroll positions, just switch tab
      switchToTab(state.popupState.activeTab);
    }
  }
}

/**
 * Initialize tab navigation
 */
function initializeTabNavigation() {
  // Tab button event listeners
  document.querySelectorAll('.tab-btn').forEach(btn => {
    on(btn, EVENTS.CLICK, () => {
      const tabName = btn.dataset.tab;
      switchToTab(tabName);
      
      if (tabName === TAB_TYPES.SAVED) {
        const savedGroupingSelect = $id(DOM_IDS.SAVED_GROUPING_SELECT);
        showSavedTabsContent(savedGroupingSelect?.value);
      }
    });
  });
}

/**
 * Check extension integrity
 */
function checkExtensionIntegrity() {
  // This ID will be set when published to Chrome Web Store
  const OFFICIAL_IDS = [
    // Add your official Chrome Web Store ID here when published
  ];
  
  const currentId = chrome.runtime.id;
  
  // Check if running in development mode
  chrome.management.getSelf((extensionInfo) => {
    const isDevelopment = extensionInfo.installType === 'development';
    const isOfficial = OFFICIAL_IDS.includes(currentId) || isDevelopment;
    
    if (!isOfficial && OFFICIAL_IDS.length > 0) {
      console.warn('Unofficial version detected');
      // Show warning in UI
      setTimeout(() => {
        const status = $id(DOM_IDS.STATUS);
        if (status) {
          status.innerHTML = '⚠️ Unofficial version! Get the official extension from <a href="https://github.com/aitkn/ai_tab_manager" target="_blank">GitHub</a>';
          status.className = 'status error';
        }
      }, 2000);
    }
  });
}

/**
 * Set up auto-save on visibility change
 */
export function setupAutoSave() {
  // Save state when window loses focus or visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !state.isInitializing) {
      console.log('Window hidden, saving state');
      savePopupState();
    }
  });
  
  // Also save when window loses focus
  window.addEventListener(EVENTS.BLUR, () => {
    if (!state.isInitializing) {
      console.log('Window blur, saving state');
      savePopupState();
    }
  });
  
  // Save state on window unload
  window.addEventListener('beforeunload', () => {
    // Only save state if we have tabs displayed
    const tabsContainer = $id(DOM_IDS.TABS_CONTAINER);
    if (tabsContainer && tabsContainer.style.display !== 'none') {
      savePopupState();
    }
  });
}

// Export default object
export default {
  initializeApp,
  setupAutoSave
};