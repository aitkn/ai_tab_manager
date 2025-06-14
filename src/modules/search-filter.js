/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Search Filter Module - handles search functionality for tabs
 */

import { TAB_CATEGORIES, DOM_IDS, CSS_CLASSES, GROUPING_OPTIONS } from '../utils/constants.js';
import { $id, classes } from '../utils/dom-helpers.js';
import { state, updateState, savePopupState } from './state-manager.js';
import { showStatus, updateCategorizeBadge } from './ui-manager.js';
import { extractDomain, getRootDomain, getSubdomain, formatDate, getWeekNumber, getWeekStartDate } from '../utils/helpers.js';
import { unifiedSearchService } from '../services/UnifiedSearchService.js';

/**
 * Handle search input for categorized tabs
 */
export function onSearchInput(e) {
  const query = e.target.value.toLowerCase().trim();
  updateState('searchQuery', query);
  
  // Update unified search service
  unifiedSearchService.setSearchQuery(query);
  unifiedSearchService.setContext('current');
  
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
  
  // Clear unified search service
  unifiedSearchService.setSearchQuery('');
  
  // Use unified search service to clear and reset
  const container = $id(DOM_IDS.CURRENT_CONTENT) || document;
  const allTabs = container.querySelectorAll('.tab-item');
  unifiedSearchService.clearSearch(container, allTabs, true);
  
  savePopupState();
}

/**
 * Check if a tab matches the search query
 * @deprecated Use unifiedSearchService.matchesSearch() instead
 */
export function matchesSearch(tab, query) {
  // Legacy compatibility - use unified search service
  const originalQuery = unifiedSearchService.searchQuery;
  if (query !== undefined) {
    unifiedSearchService.setSearchQuery(query);
  }
  const result = unifiedSearchService.matchesSearch(tab, false);
  if (query !== undefined) {
    unifiedSearchService.setSearchQuery(originalQuery);
  }
  return result;
}

/**
 * Apply search filter to all displayed tabs
 */
export async function applySearchFilter() {
  const container = $id(DOM_IDS.CURRENT_CONTENT) || document;
  const groupSections = container.querySelectorAll('.group-section');
  
  // Update unified search service context
  unifiedSearchService.setContext('current');
  
  if (groupSections.length > 0) {
    // We're in grouped view - use unified search service
    applyGroupedSearchFilter(state.searchQuery);
    return;
  }
  
  // We're in category view - use unified search service
  const allTabs = container.querySelectorAll('.tab-item');
  
  // Use unified search service for filtering
  const results = unifiedSearchService.filterTabs(allTabs, container, true, {
    groupingType: 'category',
    updateCounts: true,
    hideEmptyGroups: true,
    smartShowMore: true
  });
  
  // Update categorize tab badge
  updateCategorizeBadge();
}

/**
 * Update category counts to show filtered results
 */
function updateCategoryCountsWithSearch(visibleByCategory, categorizedTabs) {
  [TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.IMPORTANT].forEach(category => {
    const countElement = document.querySelector(`#category${category} .count`);
    if (countElement) {
      if (state.searchQuery) {
        const total = categorizedTabs[category] ? categorizedTabs[category].length : 0;
        countElement.textContent = `${visibleByCategory[category]} of ${total}`;
      } else {
        countElement.textContent = categorizedTabs[category] ? categorizedTabs[category].length : 0;
      }
    }
  });
}

/**
 * Reset category counts to show all tabs
 */
async function resetCategoryCounts() {
  const { getCurrentTabs } = await import('./tab-data-source.js');
  const { categorizedTabs } = await getCurrentTabs();
  
  [TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.IMPORTANT].forEach(category => {
    const countElement = document.querySelector(`#category${category} .count`);
    if (countElement && categorizedTabs[category]) {
      countElement.textContent = categorizedTabs[category].length;
    }
  });
}

/**
 * Reset group header counts to show all tabs
 */
function resetGroupHeaderCounts() {
  const groupSections = document.querySelectorAll('.group-section');
  
  groupSections.forEach(groupSection => {
    const tabs = groupSection.querySelectorAll('.tab-item');
    const visibleByCategory = { 
      [TAB_CATEGORIES.UNCATEGORIZED]: 0,
      [TAB_CATEGORIES.CAN_CLOSE]: 0, 
      [TAB_CATEGORIES.SAVE_LATER]: 0, 
      [TAB_CATEGORIES.IMPORTANT]: 0 
    };
    
    // Count all tabs in the group by category
    tabs.forEach(tabElement => {
      const category = parseInt(tabElement.dataset.category) || TAB_CATEGORIES.UNCATEGORIZED;
      visibleByCategory[category]++;
    });
    
    // Reset all counts to show all tabs (no search query)
    updateGroupHeaderCounts(groupSection, tabs.length, visibleByCategory, '');
    
    // Make sure all tabs are visible
    tabs.forEach(tabElement => {
      classes.remove(tabElement, CSS_CLASSES.TAB_ITEM_HIDDEN);
    });
    
    // Make sure group is visible
    classes.remove(groupSection, CSS_CLASSES.GROUP_HIDDEN);
  });
}

/**
 * Filter tabs in a group section based on actual tab data, not DOM visibility
 * @deprecated Use unifiedSearchService.filterTabs() instead
 */
export function filterGroupTabs(groupSection, searchQuery) {
  // Use unified search service
  unifiedSearchService.setSearchQuery(searchQuery);
  const tabs = groupSection.querySelectorAll('.tab-item');
  
  const results = unifiedSearchService.filterTabs(tabs, groupSection, true, {
    groupingType: 'domain',
    updateCounts: true,
    hideEmptyGroups: true,
    smartShowMore: true
  });
  
  return results.visibleCount;
}

/**
 * Fallback DOM-based filtering (for backwards compatibility)
 */
function filterGroupTabsDOM(groupSection, searchQuery) {
  const tabs = groupSection.querySelectorAll('.tab-item');
  let visibleCount = 0;
  const visibleByCategory = { 
    [TAB_CATEGORIES.UNCATEGORIZED]: 0,
    [TAB_CATEGORIES.CAN_CLOSE]: 0, 
    [TAB_CATEGORIES.SAVE_LATER]: 0, 
    [TAB_CATEGORIES.IMPORTANT]: 0 
  };
  
  tabs.forEach(tabElement => {
    const title = tabElement.querySelector('.tab-title')?.textContent || '';
    const url = tabElement.querySelector('.tab-url')?.textContent || '';
    const category = parseInt(tabElement.dataset.category) || TAB_CATEGORIES.UNCATEGORIZED;
    
    const matchesSearchLocal = !searchQuery || 
      title.toLowerCase().includes(searchQuery) || 
      url.toLowerCase().includes(searchQuery);
    
    if (matchesSearchLocal) {
      classes.remove(tabElement, CSS_CLASSES.TAB_ITEM_HIDDEN);
      visibleCount++;
      visibleByCategory[category]++;
    } else {
      classes.add(tabElement, CSS_CLASSES.TAB_ITEM_HIDDEN);
    }
  });
  
  // Update group header counts to reflect filtered results
  updateGroupHeaderCounts(groupSection, visibleCount, visibleByCategory, searchQuery);
  
  // Hide group if no visible tabs
  if (visibleCount === 0 && searchQuery) {
    classes.add(groupSection, CSS_CLASSES.GROUP_HIDDEN);
  } else {
    classes.remove(groupSection, CSS_CLASSES.GROUP_HIDDEN);
  }
  
  return visibleCount;
}

/**
 * Get the group name for a tab based on current grouping mode
 */
function getTabGroupName(tab, groupingType) {
  try {
    switch (groupingType) {
      case GROUPING_OPTIONS.DOMAIN:
        return extractDomain(tab.url || '');
      
      case GROUPING_OPTIONS.SUBDOMAIN:
        return getSubdomain(tab.url || '');
      
      case GROUPING_OPTIONS.ROOT_DOMAIN:
        return getRootDomain(tab.url || '');
      
      case GROUPING_OPTIONS.SAVE_DATE:
        if (tab.saveDate) {
          return formatDate(new Date(tab.saveDate));
        }
        return 'Not Saved';
      
      case GROUPING_OPTIONS.SAVE_WEEK:
        if (tab.saveDate) {
          const date = new Date(tab.saveDate);
          const weekStart = getWeekStartDate(date);
          return `Week of ${formatDate(weekStart)}`;
        }
        return 'Not Saved';
      
      case GROUPING_OPTIONS.SAVE_MONTH:
        if (tab.saveDate) {
          const date = new Date(tab.saveDate);
          return `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
        }
        return 'Not Saved';
      
      case 'category':
      default:
        // For category view, return the category name
        return getCategoryName(tab.category);
    }
  } catch (error) {
    console.error('Error getting tab group name:', error);
    return 'Unknown';
  }
}

/**
 * Get category name for a category number
 */
function getCategoryName(category) {
  switch (category) {
    case TAB_CATEGORIES.IMPORTANT:
      return 'Important';
    case TAB_CATEGORIES.SAVE_LATER:
      return 'Save Later';
    case TAB_CATEGORIES.CAN_CLOSE:
      return 'Can Close';
    case TAB_CATEGORIES.UNCATEGORIZED:
    default:
      return 'Uncategorized';
  }
}

/**
 * Update group header counts to reflect filtered results
 */
function updateGroupHeaderCounts(groupSection, visibleCount, visibleByCategory, searchQuery) {
  try {
    const statsContainer = groupSection.querySelector('.group-stats');
    if (!statsContainer) return;
    
    // Update category-specific counts
    Object.keys(visibleByCategory).forEach(category => {
      const categoryNum = parseInt(category);
      let selector = '';
      
      // Map categories to their CSS classes for stats
      if (categoryNum === TAB_CATEGORIES.UNCATEGORIZED) {
        selector = '.stat-item.uncategorized';
      } else if (categoryNum === TAB_CATEGORIES.IMPORTANT) {
        selector = '.stat-item.important';
      } else if (categoryNum === TAB_CATEGORIES.SAVE_LATER) {
        selector = '.stat-item.somewhat';
      } else if (categoryNum === TAB_CATEGORIES.CAN_CLOSE) {
        selector = '.stat-item.not-important';
      }
      
      if (selector) {
        const statElement = statsContainer.querySelector(selector);
        if (statElement) {
          const icon = statElement.querySelector('svg')?.outerHTML || '';
          const count = visibleByCategory[categoryNum];
          
          if (searchQuery && count === 0) {
            // Hide category stat if no visible tabs in this category
            statElement.style.display = 'none';
          } else {
            statElement.style.display = '';
            // Update count while preserving icon
            statElement.innerHTML = `${icon} ${count}`;
          }
        }
      }
    });
    
    // Update total count
    const totalStat = statsContainer.querySelector('.stat-item.total');
    if (totalStat) {
      if (searchQuery) {
        // Show filtered count vs original count
        const originalCount = groupSection.querySelectorAll('.tab-item').length;
        totalStat.textContent = `Total: ${visibleCount} of ${originalCount}`;
      } else {
        // Show original count
        totalStat.textContent = `Total: ${visibleCount}`;
      }
    }
  } catch (error) {
    console.error('Error updating group header counts:', error);
  }
}

/**
 * Apply search filter to grouped view
 */
export function applyGroupedSearchFilter(searchQuery) {
  const container = $id(DOM_IDS.CURRENT_CONTENT) || document;
  const groupSections = container.querySelectorAll('.group-section');
  
  // Update unified search service
  unifiedSearchService.setSearchQuery(searchQuery);
  unifiedSearchService.setContext('current');
  
  // Use unified search service for each group
  groupSections.forEach(section => {
    const tabs = section.querySelectorAll('.tab-item');
    unifiedSearchService.filterTabs(tabs, section, true, {
      groupingType: 'domain', // Most common grouped view
      updateCounts: true,
      hideEmptyGroups: true,
      smartShowMore: true
    });
  });
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