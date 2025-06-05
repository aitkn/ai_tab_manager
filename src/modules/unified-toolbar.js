/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Unified Toolbar - manages the shared toolbar across tabs
 */

import { DOM_IDS, TAB_TYPES, GROUPING_OPTIONS } from '../utils/constants.js';
import { $id, show, hide, on } from '../utils/dom-helpers.js';
import { state, updateState, savePopupState } from './state-manager.js';
import { updateCloseAllButtonColor } from './ui-utilities.js';
import { displayTabs } from './tab-display.js';
import { showSavedTabsContent } from './saved-tabs-manager.js';
import { applySearchFilter, applySavedSearchFilter } from './search-filter.js';
import { toggleAllGroups } from './ui-utilities.js';
import { handleCategorize } from './categorization-service.js';
import { saveAndCloseAll } from './tab-operations.js';
import { exportToCSV, handleCSVImport } from './import-export.js';

// Grouping options for different tabs
const CURRENT_TAB_GROUPING_OPTIONS = [
  { value: 'category', text: 'Category' },
  { value: 'domain', text: 'Domain' }
];

const SAVED_TAB_GROUPING_OPTIONS = [
  { value: 'category', text: 'Category' },
  { value: 'domain', text: 'Domain' },
  { value: 'savedDate', text: 'Save Date' },
  { value: 'savedWeek', text: 'Save Week' },
  { value: 'savedMonth', text: 'Save Month' },
  { value: 'lastAccessedDate', text: 'Open Date' },
  { value: 'lastAccessedWeek', text: 'Open Week' },
  { value: 'lastAccessedMonth', text: 'Open Month' },
  { value: 'closeTime', text: 'Close Time' }
];

let currentActiveTab = 'categorize';

/**
 * Initialize the unified toolbar
 */
export function initializeUnifiedToolbar() {
  // Get toolbar elements
  const searchInput = $id('unifiedSearchInput');
  const clearSearchBtn = $id('clearUnifiedSearchBtn');
  const groupingSelect = $id('unifiedGroupingSelect');
  const toggleBtn = $id('toggleGroupsBtn');
  const categorizeBtn = $id(DOM_IDS.CATEGORIZE_BTN2);
  const closeAllBtn = $id(DOM_IDS.CLOSE_ALL_BTN2);
  const showAllCheckbox = $id('showAllCheckbox');
  const exportBtn = $id('exportBtn');
  const importBtn = $id('importBtn');
  
  // Set up event listeners
  if (searchInput) {
    on(searchInput, 'input', handleSearch);
  }
  
  if (clearSearchBtn) {
    on(clearSearchBtn, 'click', clearSearch);
  }
  
  if (groupingSelect) {
    on(groupingSelect, 'change', handleGroupingChange);
  }
  
  if (toggleBtn) {
    on(toggleBtn, 'click', toggleAllGroups);
  }
  
  if (categorizeBtn) {
    on(categorizeBtn, 'click', handleCategorize);
  }
  
  if (closeAllBtn) {
    on(closeAllBtn, 'click', () => saveAndCloseAll());
  }
  
  if (showAllCheckbox) {
    on(showAllCheckbox, 'change', handleShowAllChange);
  }
  
  if (exportBtn) {
    on(exportBtn, 'click', exportToCSV);
  }
  
  if (importBtn) {
    on(importBtn, 'click', () => $id('csvFileInput')?.click());
  }
  
  // Initialize toolbar state
  updateToolbarVisibility('categorize');
}

/**
 * Update toolbar when switching tabs
 */
export function updateToolbarVisibility(tabType) {
  currentActiveTab = tabType;
  
  const currentTabControls = $id('currentTabControls');
  const savedTabControls = $id('savedTabControls');
  const searchInput = $id('unifiedSearchInput');
  const groupingSelect = $id('unifiedGroupingSelect');
  
  // Show/hide tab-specific controls
  if (tabType === 'categorize') {
    show(currentTabControls, 'flex');
    hide(savedTabControls);
    searchInput.placeholder = 'Search tabs by title or URL...';
    populateGroupingOptions(CURRENT_TAB_GROUPING_OPTIONS);
    
    // Restore grouping selection
    if (state.popupState.groupingSelections?.categorize) {
      groupingSelect.value = state.popupState.groupingSelections.categorize;
    }
    
    // Update close all button color
    updateCloseAllButtonColor();
    
    // Only show toolbar if we have tabs
    const hasTabs = Object.values(state.categorizedTabs).some(tabs => tabs.length > 0);
    if (hasTabs) {
      showToolbar();
    } else {
      hideToolbar();
    }
    
  } else if (tabType === 'saved') {
    hide(currentTabControls);
    show(savedTabControls, 'flex');
    searchInput.placeholder = 'Search saved tabs...';
    populateGroupingOptions(SAVED_TAB_GROUPING_OPTIONS);
    
    // Restore grouping selection and checkbox
    if (state.popupState.groupingSelections?.saved) {
      groupingSelect.value = state.popupState.groupingSelections.saved;
    }
    
    const showAllCheckbox = $id('showAllCheckbox');
    if (showAllCheckbox && state.popupState.showAllCategories !== undefined) {
      showAllCheckbox.checked = state.popupState.showAllCategories;
    }
    
    // Always show toolbar for saved tabs
    showToolbar();
    
  } else if (tabType === 'settings') {
    // Hide toolbar for settings
    hideToolbar();
  }
  
  // Clear search when switching tabs
  clearSearch();
}

/**
 * Show the toolbar
 */
export function showToolbar() {
  const toolbar = $id('unifiedToolbar');
  if (toolbar) {
    show(toolbar, 'flex');
  }
}

/**
 * Hide the toolbar
 */
export function hideToolbar() {
  const toolbar = $id('unifiedToolbar');
  if (toolbar) {
    hide(toolbar);
  }
}

/**
 * Populate grouping options based on active tab
 */
function populateGroupingOptions(options) {
  const groupingSelect = $id('unifiedGroupingSelect');
  if (!groupingSelect) return;
  
  groupingSelect.innerHTML = '';
  options.forEach(option => {
    const optionEl = document.createElement('option');
    optionEl.value = option.value;
    optionEl.textContent = option.text;
    groupingSelect.appendChild(optionEl);
  });
}

/**
 * Handle search input
 */
function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  
  if (currentActiveTab === 'categorize') {
    state.searchQuery = query;
    applySearchFilter();
  } else if (currentActiveTab === 'saved') {
    applySavedSearchFilter(query);
  }
}

/**
 * Clear search
 */
function clearSearch() {
  const searchInput = $id('unifiedSearchInput');
  if (searchInput) {
    searchInput.value = '';
    
    if (currentActiveTab === 'categorize') {
      state.searchQuery = '';
      applySearchFilter();
    } else if (currentActiveTab === 'saved') {
      applySavedSearchFilter('');
    }
  }
}

/**
 * Handle grouping change
 */
function handleGroupingChange(e) {
  const newGrouping = e.target.value;
  
  if (currentActiveTab === 'categorize') {
    state.popupState.groupingSelections.categorize = newGrouping;
    savePopupState();
    displayTabs();
  } else if (currentActiveTab === 'saved') {
    state.popupState.groupingSelections.saved = newGrouping;
    savePopupState();
    showSavedTabsContent(newGrouping, state.popupState.showAllCategories);
  }
}

/**
 * Handle show all checkbox change
 */
function handleShowAllChange(e) {
  state.popupState.showAllCategories = e.target.checked;
  savePopupState();
  
  const grouping = state.popupState.groupingSelections.saved || 'category';
  showSavedTabsContent(grouping, e.target.checked);
}

// Export functions
export default {
  initializeUnifiedToolbar,
  updateToolbarVisibility,
  showToolbar,
  hideToolbar
};