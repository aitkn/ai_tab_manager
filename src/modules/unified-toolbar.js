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
  
  // Don't set default toolbar state - will be set by app initializer
}

/**
 * Update toolbar when switching tabs
 */
export async function updateToolbarVisibility(tabType) {
  console.log('🔄 FLICKER DEBUG: updateToolbarVisibility called with tabType:', tabType);
  
  currentActiveTab = tabType;
  
  // For Settings tab: hide entire toolbar and return
  if (tabType === 'settings') {
    console.log('🔄 TOOLBAR: Hiding entire toolbar for settings');
    hideToolbar();
    return;
  }
  
  // For all other tabs: show toolbar first
  console.log('🔄 TOOLBAR: Showing toolbar for', tabType);
  showToolbar();
  
  const currentTabControls = $id('currentTabControls');
  const savedTabControls = $id('savedTabControls');
  const searchInput = $id('unifiedSearchInput');
  const groupingSelect = $id('unifiedGroupingSelect');
  
  console.log('🔄 FLICKER DEBUG: Elements found:', {
    currentTabControls: !!currentTabControls,
    savedTabControls: !!savedTabControls,
    searchInput: !!searchInput,
    groupingSelect: !!groupingSelect
  });
  
  // The middle section (grouping dropdown + expand) is always visible when toolbar is shown
  // Only manage the left and right tab-specific sections
  console.log('🔄 FLICKER DEBUG: Managing tab-specific controls for:', tabType);
  
  if (tabType === 'categorize') {
    console.log('🔄 CONTROLS: Setting up Current tab controls');
    
    // Show current tab controls, hide saved tab controls
    show(currentTabControls, 'flex');
    hide(savedTabControls);
    
    // Set search placeholder
    searchInput.placeholder = 'Search tabs...';
    
    // Populate grouping options for current tab
    populateGroupingOptions(CURRENT_TAB_GROUPING_OPTIONS);
    
    // Show the close all button
    const closeAllBtn = $id(DOM_IDS.CLOSE_ALL_BTN2);
    if (closeAllBtn) {
      show(closeAllBtn, 'inline-block');
    }
    
    // Restore grouping selection
    if (state.popupState.groupingSelections?.categorize) {
      groupingSelect.value = state.popupState.groupingSelections.categorize;
      console.log('📍 CURRENT TAB: Restored grouping selection:', state.popupState.groupingSelections.categorize);
    }
    
    // Update close all button color
    await updateCloseAllButtonColor();
    
    // Note: Categorize button state is automatically updated when tabs are displayed
    
  } else if (tabType === 'saved') {
    console.log('🔄 CONTROLS: Setting up Saved tab controls');
    
    // Hide current tab controls, show saved tab controls
    hide(currentTabControls);
    show(savedTabControls, 'flex');
    
    // Set search placeholder
    searchInput.placeholder = 'Search tabs...';
    
    // Populate grouping options for saved tab
    populateGroupingOptions(SAVED_TAB_GROUPING_OPTIONS);
    
    // Hide the close all button for saved tabs
    const closeAllBtn = $id(DOM_IDS.CLOSE_ALL_BTN2);
    if (closeAllBtn) {
      hide(closeAllBtn);
    }
    
    // Restore grouping selection and checkbox
    if (state.popupState.groupingSelections?.saved) {
      groupingSelect.value = state.popupState.groupingSelections.saved;
      console.log('📍 SAVED TAB: Restored grouping selection:', state.popupState.groupingSelections.saved);
    }
    
    const showAllCheckbox = $id('showAllCheckbox');
    if (showAllCheckbox && state.popupState.showAllCategories !== undefined) {
      showAllCheckbox.checked = state.popupState.showAllCategories;
    }
    
  }
  
  // Clear search when switching tabs (except settings which doesn't have toolbar)
  if (tabType !== 'settings') {
    clearSearch();
  }
}

/**
 * Show the toolbar
 */
export function showToolbar() {
  const toolbar = $id('unifiedToolbar');
  if (toolbar) {
    console.log('🔄 TOOLBAR: Showing toolbar');
    show(toolbar, 'flex');
    console.log('🔄 TOOLBAR: Toolbar display after show:', getComputedStyle(toolbar).display);
  } else {
    console.error('❌ TOOLBAR: Toolbar element not found');
  }
}

/**
 * Hide the toolbar
 */
export function hideToolbar() {
  const toolbar = $id('unifiedToolbar');
  if (toolbar) {
    console.log('🔄 TOOLBAR: Hiding toolbar');
    hide(toolbar);
    console.log('🔄 TOOLBAR: Toolbar display after hide:', getComputedStyle(toolbar).display);
  } else {
    console.error('❌ TOOLBAR: Toolbar element not found for hiding');
  }
}

/**
 * Populate grouping options based on active tab
 */
function populateGroupingOptions(options) {
  console.log('🔄 FLICKER DEBUG: populateGroupingOptions called with:', options);
  const groupingSelect = $id('unifiedGroupingSelect');
  console.log('📊 FLICKER DEBUG: groupingSelect element:', groupingSelect);
  if (!groupingSelect) {
    console.warn('⚠️ FLICKER DEBUG: No groupingSelect element found!');
    return;
  }
  
  console.log('🔄 FLICKER DEBUG: Clearing groupingSelect and adding options');
  groupingSelect.innerHTML = '';
  options.forEach((option, index) => {
    const optionEl = document.createElement('option');
    optionEl.value = option.value;
    optionEl.textContent = option.text;
    groupingSelect.appendChild(optionEl);
    console.log(`📊 FLICKER DEBUG: Added option ${index}: ${option.value} - ${option.text}`);
  });
  
  console.log('📊 FLICKER DEBUG: Final groupingSelect HTML:', groupingSelect.outerHTML);
  console.log('📊 FLICKER DEBUG: groupingSelect visibility:', getComputedStyle(groupingSelect).visibility);
  console.log('📊 FLICKER DEBUG: groupingSelect display:', getComputedStyle(groupingSelect).display);
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

/**
 * Update categorize button state based on uncategorized tabs
 */
async function updateCategorizeButtonState() {
  const categorizeBtn = $id('categorizeBtn2');
  if (!categorizeBtn) {
    console.log('📍 CATEGORIZE BTN: Button not found');
    return;
  }
  
  try {
    // Get current tabs to check for uncategorized ones
    const { getCurrentTabs } = await import('./tab-data-source.js');
    const { categorizedTabs } = await getCurrentTabs();
    
    // Check if there are uncategorized tabs (category 0)
    const uncategorizedTabs = categorizedTabs[0] || [];
    const hasUncategorized = uncategorizedTabs.length > 0;
    
    console.log(`📍 CATEGORIZE BTN: Found ${uncategorizedTabs.length} uncategorized tabs`);
    
    // Update button state
    categorizeBtn.disabled = !hasUncategorized;
    
    if (hasUncategorized) {
      categorizeBtn.title = `Categorize ${uncategorizedTabs.length} uncategorized tab${uncategorizedTabs.length === 1 ? '' : 's'}`;
      categorizeBtn.classList.remove('disabled');
      console.log(`📍 CATEGORIZE BTN: Enabled - ${uncategorizedTabs.length} tabs to categorize`);
    } else {
      categorizeBtn.title = 'No uncategorized tabs to process';
      categorizeBtn.classList.add('disabled');
      console.log('📍 CATEGORIZE BTN: Disabled - no uncategorized tabs');
    }
    
  } catch (error) {
    console.error('❌ CATEGORIZE BTN: Error updating button state:', error);
    // On error, keep button enabled but update title
    categorizeBtn.disabled = false;
    categorizeBtn.title = 'Categorize tabs';
  }
}

// Export functions
export { updateCategorizeButtonState };

export default {
  initializeUnifiedToolbar,
  updateToolbarVisibility,
  showToolbar,
  hideToolbar,
  updateCategorizeButtonState
};