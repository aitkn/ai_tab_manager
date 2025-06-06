/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * App Initializer - handles application initialization
 */

import { DOM_IDS, CSS_CLASSES, EVENTS, TAB_TYPES, TAB_CATEGORIES, CATEGORY_NAMES } from '../utils/constants.js';
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
 * Initialize category names from constants
 */
function initializeCategoryNames() {
  // Update category names in the DOM from constants
  const categoryElements = [
    { id: DOM_IDS.CATEGORY_1, category: TAB_CATEGORIES.CAN_CLOSE },
    { id: DOM_IDS.CATEGORY_2, category: TAB_CATEGORIES.SAVE_LATER },
    { id: DOM_IDS.CATEGORY_3, category: TAB_CATEGORIES.IMPORTANT }
  ];
  
  categoryElements.forEach(({ id, category }) => {
    const categorySection = $id(id);
    if (categorySection) {
      const nameElement = categorySection.querySelector('.category-name');
      if (nameElement) {
        nameElement.textContent = CATEGORY_NAMES[category];
      }
    }
  });
}

/**
 * Wait for database to be loaded
 */
async function waitForDatabase() {
  const maxAttempts = 50; // 5 seconds max
  let attempts = 0;
  
  while (!window.tabDatabase && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
    if (attempts % 10 === 0) {
      console.log(`Waiting for database... (${attempts * 100}ms)`);
    }
  }
  
  if (!window.tabDatabase) {
    throw new Error('Database failed to load after 5 seconds');
  }
  
  console.log(`Database loaded after ${attempts * 100}ms`);
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
    
    // Initialize category names from constants
    initializeCategoryNames();
    
    // Initialize database
    await window.tabDatabase.init();
    console.log('Database initialized');
    
    // Migrate from old database if needed
    await window.tabDatabase.migrateFromOldDatabase();
    
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
    
    // Load categorized tabs from background
    await loadCategorizedTabsFromBackground();
    
    console.log('Loaded settings:', state.settings);
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize tab navigation
    initializeTabNavigation();
    
    // Initialize saved tabs content
    if (state.popupState) {
      const savedGrouping = state.popupState.groupingSelections?.saved || 'category';
      const includeCanClose = state.popupState.showAllCategories || false;
      await showSavedTabsContent(savedGrouping, includeCanClose).catch(console.error);
      
      // Restore checkbox state
      const showAllCheckbox = $id('showAllCategoriesCheckbox');
      if (showAllCheckbox) {
        showAllCheckbox.checked = includeCanClose;
      }
    }
    
    // Initialize settings UI
    const { initializeSettings } = await import('./settings-manager.js');
    await initializeSettings();
    
    // Initialize unified toolbar
    const { initializeUnifiedToolbar } = await import('./unified-toolbar.js');
    initializeUnifiedToolbar();
    
    // Restore active tab
    await restoreActiveTab();
    
    // Mark initialization complete
    setInitializationComplete();
    
    // Update saved tab badge
    await loadSavedTabsCount();
    
    // Set up tab change listener
    setupTabChangeListener();
    
  } catch (error) {
    console.error('Error during initialization:', error);
    showStatus('Error initializing extension', 'error');
  }
}

/**
 * Load categorized tabs from background script
 */
async function loadCategorizedTabsFromBackground() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCategorizedTabs' });
    if (response && response.categorizedTabs) {
      const hasTabs = Object.values(response.categorizedTabs).some(tabs => tabs.length > 0);
      
      if (hasTabs) {
        console.log('Loaded categorized tabs from background');
        state.categorizedTabs = response.categorizedTabs;
        state.urlToDuplicateIds = response.urlToDuplicateIds || {};
        
        // Update UI
        show($id(DOM_IDS.TABS_CONTAINER));
        displayTabs();
        updateCategorizeBadge();
        
        // Show unified toolbar
        const { showToolbar } = await import('./unified-toolbar.js');
        showToolbar();
        
        // Update categorize button state based on uncategorized tabs
        const hasUncategorized = response.categorizedTabs[0] && response.categorizedTabs[0].length > 0;
        const categorizeBtn = $id(DOM_IDS.CATEGORIZE_BTN);
        if (categorizeBtn) {
          categorizeBtn.disabled = !hasUncategorized;
          categorizeBtn.title = hasUncategorized ? 'Categorize tabs using AI' : 'No uncategorized tabs';
        }
      }
    }
  } catch (error) {
    console.error('Error loading categorized tabs from background:', error);
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
  // Tab navigation is now handled by event-handlers.js
  console.log('Tab navigation initialized via event handlers');
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
    if (!state.isInitializing) {
      console.log('Window unloading, saving state');
      savePopupState();
    }
  });
}

/**
 * Set up listener for tab changes from background script
 */
function setupTabChangeListener() {
  console.log('Popup: Setting up tab change listener');
  
  // Connect to background script
  const port = chrome.runtime.connect({ name: 'popup' });
  
  // Listen for messages from background
  port.onMessage.addListener((message) => {
    if (message.action === 'tabChanged') {
      console.log('Popup: Received tab change:', message.data);
      handleTabChange(message.data);
    }
  });
  
  // Also expose handler to window for testing
  window.handleTabChangeFromBackground = (data) => {
    handleTabChange(data);
  };
}

/**
 * Handle tab change notifications
 */
async function handleTabChange(data) {
  console.log('Popup: handleTabChange called with:', data);
  const { changeType, tab, timestamp } = data;
  
  // Only handle changes if we're on the categorize tab
  if (state.popupState.activeTab !== TAB_TYPES.CATEGORIZE) {
    console.log('Popup: Skipping - not on categorize tab');
    return;
  }
  
  // Check if we have categorized tabs
  const { hasCurrentTabs } = await import('./tab-data-source.js');
  const hasCategorizedTabs = await hasCurrentTabs();
  
  if (!hasCategorizedTabs && changeType !== 'created') {
    console.log('Popup: Skipping - no categorized tabs and not a create event');
    return;
  }
  
  console.log('Popup: Tab change detected:', changeType, tab);
  
  // For now, just refresh the display
  // In the future, we could be smarter about updating only the affected tab
  if (changeType === 'removed') {
    // Remove the tab from categorized tabs
    for (const category of Object.keys(state.categorizedTabs)) {
      state.categorizedTabs[category] = state.categorizedTabs[category]
        .filter(t => t.id !== tab.id);
    }
    
    // Update display
    displayTabs();
    updateCategorizeBadge();
    showStatus('Tab closed - display updated', 'success', 2000);
  } else if (changeType === 'created' || changeType === 'updated' || changeType === 'refresh') {
    // Load latest categorized tabs from background
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCategorizedTabs' });
      if (response && response.categorizedTabs) {
        console.log('Popup: Received updated tabs from background:', response);
        
        // Check for duplicate changes
        let duplicatesChanged = false;
        for (const category of Object.keys(response.categorizedTabs)) {
          for (const tab of response.categorizedTabs[category]) {
            if (tab.duplicateIds && tab.duplicateIds.length > 1) {
              console.log('Popup: Tab has duplicates:', tab.url, 'count:', tab.duplicateCount);
              duplicatesChanged = true;
            }
          }
        }
        
        // Just update display - data will be fetched from background
        const { displayTabs } = await import('./tab-display.js');
        await displayTabs();
        await updateCategorizeBadge();
        
        // Update categorize button state
        const hasUncategorized = response.categorizedTabs[0] && response.categorizedTabs[0].length > 0;
        const categorizeBtn = $id(DOM_IDS.CATEGORIZE_BTN);
        if (categorizeBtn) {
          categorizeBtn.disabled = !hasUncategorized;
          categorizeBtn.title = hasUncategorized ? 'Categorize tabs using AI' : 'No uncategorized tabs';
        }
        
        if (duplicatesChanged) {
          showStatus('Duplicate tab detected', 'success', 2000);
        } else if (hasUncategorized) {
          showStatus('New uncategorized tab detected', 'success', 2000);
        }
      }
    } catch (error) {
      console.error('Error loading categorized tabs:', error);
    }
  }
}

// Export default object
export default {
  initializeApp,
  setupAutoSave
};