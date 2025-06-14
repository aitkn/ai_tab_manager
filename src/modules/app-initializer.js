/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * App Initializer - handles application initialization
 */

import { DOM_IDS, CSS_CLASSES, EVENTS, TAB_TYPES, TAB_CATEGORIES, CATEGORY_NAMES } from '../utils/constants.js';
import { $id, show, hide, on } from '../utils/dom-helpers.js';
import { initializeTheme, switchToTab, showStatus, updateCategorizeBadge, showApiKeyPrompt } from './ui-manager.js';
import { state, loadSavedState, setInitializationComplete, restoreScrollPosition, savePopupState, updateState } from './state-manager.js';
import { setupEventListeners } from './event-handlers.js';
import { displayTabs } from './tab-display.js';
import { applySearchFilter } from './search-filter.js';
import { showSavedTabsContent, loadSavedTabsCount } from './saved-tabs-manager.js';
import { initializeTabDataSource, getCurrentTabs, setupTabEventListeners } from './tab-data-source.js';
// Database is available as window.window.tabDatabase
import StorageService from '../services/StorageService.js';
import ChromeAPIService from '../services/ChromeAPIService.js';
import { getBackgroundMLService } from '../services/BackgroundMLService.js';
import { initializeAllTabContent, markContentDirty } from './content-manager.js';

// Import flicker-free UI for data change notifications
let flickerFreeUI = null;
async function getFlickerFreeUI() {
  if (!flickerFreeUI) {
    flickerFreeUI = (await import('../core/flicker-free-ui.js')).default;
  }
  return flickerFreeUI;
}

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
  console.log('🔄 APP INIT: Waiting for database to load...');
  const maxAttempts = 50; // 5 seconds max
  let attempts = 0;
  
  while (!window.tabDatabase && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
    if (attempts % 10 === 0) {
      console.log(`🔄 APP INIT: Still waiting for database... (${attempts * 100}ms)`);
    }
  }
  
  if (!window.tabDatabase) {
    console.error('❌ APP INIT: Database failed to load after 5 seconds');
    throw new Error('Database failed to load after 5 seconds');
  }
  
  console.log('✅ APP INIT: Database loaded successfully');
  
}

/**
 * Main initialization function
 */
export async function initializeApp() {
  console.log('🔄 APP INIT: initializeApp started');
  
  try {
    // Wait for database to be available
    if (!window.tabDatabase) {
      console.log('🔄 APP INIT: Database not available, waiting...');
      await waitForDatabase();
    } else {
      console.log('🔄 APP INIT: Database already available');
    }
    
    // Check for unauthorized copies
    console.log('🔄 APP INIT: Checking extension integrity...');
    checkExtensionIntegrity();
    
    // Initialize theme
    console.log('🔄 APP INIT: Initializing theme...');
    initializeTheme();
    
    // Initialize category names from constants
    console.log('🔄 APP INIT: Initializing category names...');
    initializeCategoryNames();
    
    // Initialize database
    console.log('🔄 APP INIT: Initializing database...');
    await window.tabDatabase.init();
    
    // Initialize tab data source with database
    console.log('🔄 APP INIT: Initializing tab data source...');
    initializeTabDataSource(window.tabDatabase);
    
    // Only load saved state if not already pre-loaded
    if (!window._targetTab) {
      console.log('🔄 APP INIT: Loading saved state...');
      await loadSavedState();
    } else {
      console.log('🔄 APP INIT: Using pre-loaded state');
    }
    
    // Check if default prompt needs updating
    console.log('🔄 APP INIT: Checking prompt version...');
    if (!state.settings.isPromptCustomized && 
        state.settings.promptVersion < CONFIG.PROMPT_VERSION) {
      console.log('🔄 APP INIT: Updating default prompt...');
      state.settings.customPrompt = CONFIG.DEFAULT_PROMPT;
      state.settings.promptVersion = CONFIG.PROMPT_VERSION;
      await StorageService.saveSettings(state.settings);
    }
    
    // Don't show API key prompt on startup - only when user tries to categorize
    
    // Set up event listeners early
    console.log('🔄 APP INIT: Setting up event listeners...');
    setupEventListeners();
    
    // Initialize tab navigation
    console.log('🔄 APP INIT: Initializing tab navigation...');
    initializeTabNavigation();
    
    // Initialize settings UI
    console.log('🔄 APP INIT: Initializing settings UI...');
    const { initializeSettings } = await import('./settings-manager.js');
    await initializeSettings();
    
    // Use the pre-determined target tab (DOM classes already set by preInitialize)
    let targetTab = window._targetTab || state.popupState?.activeTab || 'categorize';
    
    console.log('🔄 APP INIT: App initializer target tab:', targetTab);
    console.log('🔄 APP INIT: window._targetTab:', window._targetTab);
    console.log('🔄 APP INIT: state.popupState.activeTab:', state.popupState?.activeTab);
    
    // Update state to match (DOM classes already set)
    state.popupState.activeTab = targetTab;
    updateState('activeTab', targetTab);
    
    console.log('🔄 APP INIT: About to initialize unified toolbar');
    
    // Initialize unified toolbar with correct active tab
    const { initializeUnifiedToolbar, updateToolbarVisibility } = await import('./unified-toolbar.js');
    initializeUnifiedToolbar();
    
    console.log('🔄 APP INIT: About to update toolbar visibility for:', targetTab);
    
    // Update toolbar visibility for the correct tab
    await updateToolbarVisibility(targetTab);
    
    console.log('🔄 APP INIT: Toolbar visibility updated');
    
    // Show the toolbar now that state is loaded and controls are set correctly
    console.log('🔄 APP INIT: Setting up toolbar state...');
    const toolbar = $id('unifiedToolbar');
    if (toolbar) {
      toolbar.classList.add('state-loaded');
      console.log('🔄 APP INIT: Added state-loaded class to toolbar');
    }
    
    // Initialize all tab content at startup (this loads everything once)
    console.log('🔄 APP INIT: Initializing all tab content...');
    await initializeAllTabContent();
    console.log('🔄 APP INIT: All tab content initialized');
    
    // Restore UI state (search, grouping, etc) for current tab
    if (targetTab === 'categorize') {
      console.log('🔄 APP INIT: Restoring UI state for categorize tab...');
      await restoreUIState();
      
      // Restore scroll position for categorize tab
      const currentContent = $id(DOM_IDS.CURRENT_CONTENT);
      if (state.popupState?.scrollPositions?.categorize && currentContent) {
        console.log('🔄 APP INIT: Restoring scroll position for categorize tab');
        currentContent.scrollTop = state.popupState.scrollPositions.categorize;
      }
      
      // Always show the unified toolbar on categorize tab
      console.log('🔄 APP INIT: Showing toolbar for categorize tab...');
      const { showToolbar } = await import('./unified-toolbar.js');
      showToolbar();
    }
    
    
    // Mark initialization complete
    setInitializationComplete();
    
    // Update saved tab badge
    await loadSavedTabsCount();
    
    // Set up tab change listener
    setupTabChangeListener();
    
    // Initialize background ML service
    try {
      const backgroundMLService = await getBackgroundMLService();
    } catch (error) {
    }
    
    
  } catch (error) {
    console.error('Error during initialization:', error);
    showStatus('Error initializing extension', 'error');
  }
}

/**
 * Load current tabs from browser and database
 */
async function loadCategorizedTabsFromBackground() {
  try {
    // Ensure database is ready first
    if (!window.tabDatabase) {
      console.warn('Database not ready, waiting...');
      await waitForDatabase();
      
      // Initialize database after waiting
      await window.tabDatabase.init();
      console.log('Database re-initialized after wait');
    }
    
    // Always re-initialize tab data source to ensure it's ready
    initializeTabDataSource(window.tabDatabase);
    console.log('Tab data source re-initialized');
    
    console.log('DEBUG: Getting current tabs...');
    const result = await getCurrentTabs();
    console.log('DEBUG: getCurrentTabs result type:', typeof result);
    console.log('DEBUG: getCurrentTabs result:', result);
    
    const { categorizedTabs, urlToDuplicateIds } = result || { categorizedTabs: {}, urlToDuplicateIds: {} };
    console.log('DEBUG: Current tabs result:', {
      categorizedTabs: Object.keys(categorizedTabs).map(cat => `${cat}: ${categorizedTabs[cat]?.length || 0}`),
      totalTabs: Object.values(categorizedTabs).reduce((sum, tabs) => sum + (tabs?.length || 0), 0),
      rawCategorizedTabs: categorizedTabs
    });
    
    const hasTabs = Object.values(categorizedTabs).some(tabs => tabs.length > 0);
    
    if (hasTabs) {
      console.log('DEBUG: Loaded current tabs from browser, displaying...');
      state.categorizedTabs = categorizedTabs;
      state.urlToDuplicateIds = urlToDuplicateIds;
      
      // Update UI - make sure container is visible first
      const tabsContainer = $id(DOM_IDS.TABS_CONTAINER);
      if (tabsContainer) {
        show(tabsContainer);
        console.log('DEBUG: Tabs container shown for existing tabs');
      }
      
      // Force display update
      await displayTabs();
      console.log('DEBUG: displayTabs completed for existing tabs');
      
      updateCategorizeBadge();
      
      // Show unified toolbar
      const { showToolbar } = await import('./unified-toolbar.js');
      showToolbar();
      
      // Update categorize button state based on uncategorized tabs
      const hasUncategorized = categorizedTabs[0] && categorizedTabs[0].length > 0;
      const categorizeBtn = $id(DOM_IDS.CATEGORIZE_BTN);
      if (categorizeBtn) {
        categorizeBtn.disabled = !hasUncategorized;
        categorizeBtn.title = hasUncategorized ? 'Categorize tabs using AI' : 'No uncategorized tabs';
      }
    } else {
      console.log('DEBUG: No current tabs found, initializing empty UI');
      
      // Initialize empty state but make sure UI is visible
      const tabsContainer = $id(DOM_IDS.TABS_CONTAINER);
      if (tabsContainer) {
        show(tabsContainer);
        console.log('DEBUG: Tabs container shown for empty state');
      }
      
      // Force display update even with empty state
      await displayTabs(); // This will show empty state
      console.log('DEBUG: displayTabs completed for empty state');
      
      const categorizeBtn = $id(DOM_IDS.CATEGORIZE_BTN);
      if (categorizeBtn) {
        categorizeBtn.disabled = true;
        categorizeBtn.title = 'No tabs to categorize';
      }
      
      // Show unified toolbar even with no tabs
      const { showToolbar } = await import('./unified-toolbar.js');
      showToolbar();
    }
  } catch (error) {
    console.error('Error loading categorized tabs from background:', error);
    // Initialize empty state on error
    state.categorizedTabs = {
      0: [], // uncategorized
      1: [], // can close  
      2: [], // save later
      3: []  // important
    };
    state.urlToDuplicateIds = {};
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
 * @deprecated - Now handled directly in initializeApp
 */
async function restoreActiveTab() {
  // This function is kept for compatibility but is no longer used
  // Tab restoration is now handled directly in initializeApp to avoid flicker
}

/**
 * Initialize tab navigation
 */
function initializeTabNavigation() {
  // Tab navigation is now handled by event-handlers.js
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
      savePopupState();
    }
  });
  
  // Also save when window loses focus
  window.addEventListener(EVENTS.BLUR, () => {
    console.log('=== POPUP LIFECYCLE: Window blur detected ===');
    console.log('Initializing:', state.isInitializing);
    if (!state.isInitializing) {
      console.log('=== POPUP LIFECYCLE: Saving state on blur ===');
      savePopupState();
    }
  });
  
  // Save state on window unload
  window.addEventListener('beforeunload', () => {
    if (!state.isInitializing) {
      savePopupState();
    }
  });
}

/**
 * Set up listener for tab changes from background script
 */
function setupTabChangeListener() {
  
  // Set up listeners through tab data source
  const port = setupTabEventListeners((changeData) => {
    handleTabChange(changeData);
  });
  
  // Also expose handler to window for testing
  window.handleTabChangeFromBackground = (data) => {
    handleTabChange(data);
  };
}

// Debounce timer for tab changes
let tabChangeDebounceTimer = null;

/**
 * Handle tab change notifications with debouncing
 */
async function handleTabChange(data) {
  const { changeType, tab, timestamp } = data;
  
  // Only handle changes if we're on the categorize tab
  if (state.popupState.activeTab !== TAB_TYPES.CATEGORIZE) {
    return;
  }
  
  // Clear existing debounce timer
  if (tabChangeDebounceTimer) {
    clearTimeout(tabChangeDebounceTimer);
  }
  
  // Debounce rapid changes
  tabChangeDebounceTimer = setTimeout(async () => {
    await processTabChange(changeType, tab);
  }, 200); // 200ms debounce
}

/**
 * Process tab change after debounce
 */
async function processTabChange(changeType, tab) {
  console.log('🔥 POPUP: Processing tab change:', {
    changeType,
    tabId: tab?.id,
    tabUrl: tab?.url?.substring(0, 50) + '...',
    activeTab: state.popupState.activeTab
  });
  
  // Check if we have categorized tabs
  const { hasCurrentTabs } = await import('./tab-data-source.js');
  const hasCategorizedTabs = await hasCurrentTabs();
  
  // Only skip if we have no tabs AND we're not viewing the Current tab (where users expect real-time updates)
  if (!hasCategorizedTabs && changeType !== 'created' && state.popupState.activeTab !== 'categorize') {
    console.log('🔥 POPUP: Skipping - no categorized tabs, not creation, and not on Current tab');
    return;
  }
  
  // If we're on Current tab and all tabs were removed, we should still update to show empty state
  if (!hasCategorizedTabs && state.popupState.activeTab === 'categorize') {
    console.log('🔥 POPUP: Updating Current tab to show empty state after all tabs removed');
  }
  
  
  // For all tab changes, mark content as dirty and update current tabs
  try {
    // Mark current tab content as needing update
    markContentDirty('current');
    
    const { categorizedTabs, urlToDuplicateIds } = await getCurrentTabs();
    
    // Update state
    state.categorizedTabs = categorizedTabs;
    state.urlToDuplicateIds = urlToDuplicateIds;
    
    // Check for duplicate changes
    let duplicatesChanged = false;
    for (const category of Object.keys(categorizedTabs)) {
      for (const tab of categorizedTabs[category]) {
        if (tab.duplicateIds && tab.duplicateIds.length > 1) {
          console.log('Popup: Tab has duplicates:', tab.url, 'count:', tab.duplicateCount);
          duplicatesChanged = true;
        }
      }
    }
    
    // Check if all tabs are gone
    const totalTabs = Object.values(categorizedTabs).reduce((sum, tabs) => sum + tabs.length, 0);
    
    if (totalTabs === 0 && state.popupState.activeTab === 'categorize') {
      console.log('🔥 POPUP: All tabs closed, staying on Current tab to show empty state');
      // Continue processing to show empty state instead of auto-switching to Saved tab
    }
    
    // Notify flicker-free UI of data changes
    const ffUI = await getFlickerFreeUI();
    if (ffUI && ffUI.initialized) {
      // Determine change type based on the original changeType
      let dataChangeType = 'tabs_opened';
      if (changeType === 'removed') {
        dataChangeType = 'tabs_closed';
      } else if (changeType === 'updated') {
        dataChangeType = 'tabs_opened'; // Title/URL changes
      }
      
      await ffUI.handleDataChange(dataChangeType);
    } else {
      // Fallback to legacy content management
      const { updateCurrentTabContent, syncHiddenTabContent } = await import('./content-manager.js');
      await updateCurrentTabContent();
      
      // Update any hidden tabs in the background
      await syncHiddenTabContent();
    }
    
    await updateCategorizeBadge();
    
    // Note: Categorize button state is automatically updated by displayTabs/updateCurrentTabContent
    
    // Check if there are uncategorized tabs for status message
    const hasUncategorized = categorizedTabs[0] && categorizedTabs[0].length > 0;
    
    // Show appropriate status message
    if (changeType === 'removed') {
      showStatus('Tab closed - display updated', 'success', 2000);
    } else if (duplicatesChanged) {
      showStatus('Duplicate tab detected', 'success', 2000);
    } else if (changeType === 'created' && hasUncategorized) {
      showStatus('New uncategorized tab detected', 'success', 2000);
    }
  } catch (error) {
    console.error('Error refreshing tabs:', error);
  }
}

// Export default object
export default {
  initializeApp,
  setupAutoSave
};

// Export additional functions
export { loadCategorizedTabsFromBackground };