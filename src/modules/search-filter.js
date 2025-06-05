/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Search Filter Module - handles search functionality for tabs
 */

import { TAB_CATEGORIES, DOM_IDS, CSS_CLASSES } from '../utils/constants.js';
import { $id, classes } from '../utils/dom-helpers.js';
import { state, updateState, savePopupState } from './state-manager.js';
import { showStatus, updateCategorizeBadge } from './ui-manager.js';

/**
 * Handle search input for categorized tabs
 */
export function onSearchInput(e) {
  const query = e.target.value.toLowerCase().trim();
  updateState('searchQuery', query);
  applySearchFilter();
  savePopupState();
}

/**
 * Clear search and reset filter
 */
export function clearSearch() {
  const searchInput = $id(DOM_IDS.SEARCH_INPUT);
  if (searchInput) {
    searchInput.value = '';
  }
  updateState('searchQuery', '');
  applySearchFilter();
  savePopupState();
  
  // Reset category counts
  resetCategoryCounts();
}

/**
 * Check if a tab matches the search query
 */
export function matchesSearch(tab, query) {
  if (!query) return true;
  
  const searchableText = [
    tab.title || '',
    tab.url || '',
    tab.domain || ''
  ].join(' ').toLowerCase();
  
  return searchableText.includes(query);
}

/**
 * Apply search filter to all displayed tabs
 */
export function applySearchFilter() {
  const allTabs = document.querySelectorAll('.tab-item');
  let visibleCount = 0;
  const visibleByCategory = { 
    [TAB_CATEGORIES.CAN_CLOSE]: 0, 
    [TAB_CATEGORIES.SAVE_LATER]: 0, 
    [TAB_CATEGORIES.IMPORTANT]: 0 
  };
  
  allTabs.forEach(tabElement => {
    const tabId = parseInt(tabElement.dataset.tabId);
    const category = parseInt(tabElement.dataset.category);
    
    // Find the tab data
    let tab = null;
    if (state.categorizedTabs[category]) {
      tab = state.categorizedTabs[category].find(t => t.id === tabId);
    }
    
    if (tab && matchesSearch(tab, state.searchQuery)) {
      classes.remove(tabElement, CSS_CLASSES.TAB_ITEM_HIDDEN);
      classes.add(tabElement, 'search-match');
      visibleCount++;
      visibleByCategory[category]++;
    } else {
      classes.add(tabElement, CSS_CLASSES.TAB_ITEM_HIDDEN);
      classes.remove(tabElement, 'search-match');
    }
  });
  
  // Update category counts
  updateCategoryCountsWithSearch(visibleByCategory);
  
  // Update categorize tab badge
  updateCategorizeBadge();
  
  // Update status
  if (state.searchQuery) {
    showStatus(`Found ${visibleCount} tabs matching "${state.searchQuery}"`, 'success');
  }
}

/**
 * Update category counts to show filtered results
 */
function updateCategoryCountsWithSearch(visibleByCategory) {
  [TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.IMPORTANT].forEach(category => {
    const countElement = document.querySelector(`#category${category} .count`);
    if (countElement) {
      if (state.searchQuery) {
        const total = state.categorizedTabs[category] ? state.categorizedTabs[category].length : 0;
        countElement.textContent = `${visibleByCategory[category]} of ${total}`;
      } else {
        countElement.textContent = state.categorizedTabs[category] ? state.categorizedTabs[category].length : 0;
      }
    }
  });
}

/**
 * Reset category counts to show all tabs
 */
function resetCategoryCounts() {
  [TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.IMPORTANT].forEach(category => {
    const countElement = document.querySelector(`#category${category} .count`);
    if (countElement && state.categorizedTabs[category]) {
      countElement.textContent = state.categorizedTabs[category].length;
    }
  });
}

/**
 * Filter tabs in a group section
 */
export function filterGroupTabs(groupSection, searchQuery) {
  const tabs = groupSection.querySelectorAll('.tab-item');
  let visibleCount = 0;
  
  tabs.forEach(tabElement => {
    const title = tabElement.querySelector('.tab-title')?.textContent || '';
    const url = tabElement.querySelector('.tab-url')?.textContent || '';
    
    const matchesSearch = !searchQuery || 
      title.toLowerCase().includes(searchQuery) || 
      url.toLowerCase().includes(searchQuery);
    
    if (matchesSearch) {
      classes.remove(tabElement, CSS_CLASSES.TAB_ITEM_HIDDEN);
      visibleCount++;
    } else {
      classes.add(tabElement, CSS_CLASSES.TAB_ITEM_HIDDEN);
    }
  });
  
  // Hide group if no visible tabs
  if (visibleCount === 0 && searchQuery) {
    classes.add(groupSection, CSS_CLASSES.GROUP_HIDDEN);
  } else {
    classes.remove(groupSection, CSS_CLASSES.GROUP_HIDDEN);
  }
  
  return visibleCount;
}

/**
 * Apply search filter to grouped view
 */
export function applyGroupedSearchFilter(searchQuery) {
  const groupSections = document.querySelectorAll('.group-section');
  let totalVisible = 0;
  let visibleGroups = 0;
  
  groupSections.forEach(section => {
    const visibleInGroup = filterGroupTabs(section, searchQuery);
    if (visibleInGroup > 0) {
      visibleGroups++;
    }
    totalVisible += visibleInGroup;
  });
  
  if (searchQuery) {
    showStatus(`Found ${totalVisible} tabs in ${visibleGroups} groups matching "${searchQuery}"`, 'success');
  }
}

/**
 * Initialize search functionality
 */
export function initializeSearch() {
  // Set up search input handlers
  const searchInput = $id(DOM_IDS.SEARCH_INPUT);
  if (searchInput) {
    searchInput.addEventListener('input', onSearchInput);
    
    // Restore search value if any
    if (state.searchQuery) {
      searchInput.value = state.searchQuery;
    }
  }
  
  // Set up clear search button
  const clearSearchBtn = $id(DOM_IDS.CLEAR_SEARCH_BTN);
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', clearSearch);
  }
  
  // Set up saved tabs search
  const savedSearchInput = $id(DOM_IDS.SAVED_SEARCH_INPUT);
  if (savedSearchInput) {
    savedSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      handleSavedTabSearch(query);
    });
  }
  
  const clearSavedSearchBtn = $id(DOM_IDS.CLEAR_SAVED_SEARCH_BTN);
  if (clearSavedSearchBtn) {
    clearSavedSearchBtn.addEventListener('click', () => {
      if (savedSearchInput) {
        savedSearchInput.value = '';
        handleSavedTabSearch('');
      }
    });
  }
}

// Re-export handleSavedTabSearch from saved-tabs-manager
import { handleSavedTabSearch } from './saved-tabs-manager.js';

/**
 * Apply search filter to saved tabs
 */
export function applySavedSearchFilter(query) {
  handleSavedTabSearch(query);
}

// Export default object
export default {
  onSearchInput,
  clearSearch,
  matchesSearch,
  applySearchFilter,
  filterGroupTabs,
  applyGroupedSearchFilter,
  initializeSearch,
  applySavedSearchFilter
};