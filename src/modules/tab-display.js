/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Tab Display Module - handles rendering of tabs in various views
 */

import { DOM_IDS, CSS_CLASSES, TAB_CATEGORIES, CATEGORY_NAMES, GROUPING_OPTIONS, URLS, STATUS_MESSAGES } from '../utils/constants.js';
import { $, $id, show, hide, classes, createElement } from '../utils/dom-helpers.js';
import { getRootDomain, getSubdomain, sortTabsInGroup, getWeekNumber, getWeekStartDate, formatDate, extractDateFromGroupName } from '../utils/helpers.js';
import { createOptimizedFavicon, preloadFavicons } from '../utils/favicon-loader.js';
import { state } from './state-manager.js';
import { showStatus } from './ui-manager.js';
import { getCurrentTabs } from './tab-data-source.js';
import { moveTab } from './tab-operations.js';
import { createTabElement as createUnifiedTabElement, unifiedTabRenderer } from './unified-tab-renderer.js';
import { createCategorySection as createUnifiedCategorySection, createGroupSection as createUnifiedGroupSection } from './unified-group-renderer.js';

/**
 * Display tabs based on current state and grouping
 */
export async function displayTabs(isFromSaved = false) {
  try {
    console.log(`🔄 TAB DISPLAY: displayTabs called (isFromSaved: ${isFromSaved})`);
    state.isViewingSaved = isFromSaved;
    
    if (!isFromSaved) {
      const groupingType = state.popupState.groupingSelections.categorize || 'category';
      console.log(`🔄 TAB DISPLAY: Displaying current tabs with grouping: ${groupingType}`);
      
      await showCurrentTabsContent(groupingType);
      
      console.log('🔄 TAB DISPLAY: Updating Close All button color...');
      // Update Close All button color
      const { updateCloseAllButtonColor } = await import('./ui-utilities.js');
      await updateCloseAllButtonColor();
      
      console.log('🔄 TAB DISPLAY: Updating categorize button state...');
      // Update categorize button state based on current tabs
      const { updateCategorizeButtonState } = await import('./unified-toolbar.js');
      await updateCategorizeButtonState();
      
      console.log('✅ TAB DISPLAY: displayTabs completed successfully');
    }
  } catch (error) {
    console.error('❌ TAB DISPLAY: Error displaying tabs:', error);
    showStatus('Error displaying tabs', 'error');
  }
}

/**
 * Show current tabs content - unified approach like saved tabs
 */
export async function showCurrentTabsContent(groupingType) {
  try {
    console.log(`🔄 CURRENT TABS: showCurrentTabsContent called with grouping: ${groupingType}`);
    
    // Make sure the tabs container exists and is ready
    const tabsContainer = $id(DOM_IDS.TABS_CONTAINER);
    if (!tabsContainer) {
      console.error('❌ CURRENT TABS: Tabs container not found');
      return;
    }
    
    // Ensure the main tabs container is visible
    show(tabsContainer);
    
    // Get the current content container
    const currentContent = $id(DOM_IDS.CURRENT_CONTENT);
    if (!currentContent) {
      console.error('❌ CURRENT TABS: Current content container not found');
      return;
    }
    
    // Fetch current tabs from background
    const { categorizedTabs } = await getCurrentTabs();
    
    console.log('🔄 CURRENT TABS: Retrieved categorized tabs:', {
      categories: Object.keys(categorizedTabs),
      counts: Object.entries(categorizedTabs).map(([cat, tabs]) => `${cat}: ${tabs.length}`).join(', ')
    });
    
    // Preload favicons for better performance
    const allTabs = Object.values(categorizedTabs).flat();
    if (allTabs.length > 0) {
      console.log('🔄 CURRENT TABS: Preloading favicons for', allTabs.length, 'tabs');
      preloadFavicons(allTabs);
    }
    
    // Store current scroll position
    const scrollTop = currentContent.scrollTop;
    
    // Hide content to prevent scroll jump
    currentContent.style.opacity = '0';
    currentContent.style.pointerEvents = 'none';
    
    currentContent.innerHTML = '';
    
    if (groupingType === 'category') {
      // Create category sections directly in current content using unified renderer
      for (const category of [TAB_CATEGORIES.UNCATEGORIZED, TAB_CATEGORIES.IMPORTANT, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.CAN_CLOSE]) {
        const tabs = categorizedTabs[category] || [];
        if (tabs.length > 0) {
          const section = await createUnifiedCategorySection(category, tabs, false);
          if (section) {
            currentContent.appendChild(section);
          }
        }
      }
    } else {
      // For non-category groupings, use the grouped view approach
      const groupedView = await displayGroupedView(groupingType, false, categorizedTabs);
      if (groupedView) {
        currentContent.appendChild(groupedView);
      }
    }
    
    // Show content with smooth transition
    requestAnimationFrame(() => {
      currentContent.style.transition = 'opacity 150ms ease-in-out';
      currentContent.style.opacity = '1';
      currentContent.style.pointerEvents = 'auto';
      
      // Restore scroll position after content is visible and layout is calculated
      if (state.popupState.scrollPositions?.current) {
        const scrollPos = state.popupState.scrollPositions.current;
        console.log(`📍 Current: Restoring scroll position: ${scrollPos}px`);
        // Use another frame to ensure layout is complete
        requestAnimationFrame(() => {
          // Additional small delay to ensure content height is calculated
          setTimeout(() => {
            currentContent.scrollTop = scrollPos;
            console.log(`✅ Current: Scroll position restored to ${currentContent.scrollTop}px`);
          }, 10);
        });
      } else {
        // Restore the previous scroll position from before the content update
        currentContent.scrollTop = scrollTop;
        console.log('📍 Current: Restored previous scroll position');
      }
      
      // Clean up transition after it completes
      setTimeout(() => {
        currentContent.style.transition = '';
      }, 150);
    });
    
    console.log('✅ CURRENT TABS: showCurrentTabsContent completed');
  } catch (error) {
    console.error('❌ CURRENT TABS: Error in showCurrentTabsContent:', error);
    showStatus('Error displaying current tabs', 'error');
  }
}



/**
 * Display tabs in grouped view
 * @param {string} groupingType - Type of grouping
 * @param {boolean} isFromSaved - Whether displaying saved tabs
 * @param {Object} tabsToDisplay - Optional tabs to display
 */
export async function displayGroupedView(groupingType, isFromSaved = false, tabsToDisplay = null) {
  // Set viewing state for group rendering
  state.isViewingSaved = isFromSaved;
  
  // Fetch current tabs if not provided
  let tabs = tabsToDisplay;
  if (!tabs && !isFromSaved) {
    const { categorizedTabs } = await getCurrentTabs();
    tabs = categorizedTabs;
  } else if (!tabs) {
    tabs = {};
  }
  
  // Always create a new grouped view element for consistency
  const groupedView = createElement('div', {
    className: 'grouping-view',
    id: isFromSaved ? 'savedGroupedView' : 'currentGroupedView'
  });
  
  // Flatten all tabs from all categories
  const allTabs = [];
  [TAB_CATEGORIES.UNCATEGORIZED, TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.IMPORTANT].forEach(category => {
    if (tabs[category]) {
      tabs[category].forEach(tab => {
        allTabs.push({ ...tab, category });
      });
    }
  });
  
  // Group tabs based on grouping type
  let groups = {};
  switch (groupingType) {
    case GROUPING_OPTIONS.DOMAIN:
      groups = groupByDomain(allTabs);
      break;
    case GROUPING_OPTIONS.SAVED_DATE:
      groups = groupBySavedDate(allTabs);
      break;
    case GROUPING_OPTIONS.SAVED_WEEK:
      groups = groupBySavedWeek(allTabs);
      break;
    case GROUPING_OPTIONS.SAVED_MONTH:
      groups = groupBySavedMonth(allTabs);
      break;
    case GROUPING_OPTIONS.LAST_ACCESSED_DATE:
      groups = groupByLastAccessedDate(allTabs);
      break;
    case GROUPING_OPTIONS.LAST_ACCESSED_WEEK:
      groups = groupByLastAccessedWeek(allTabs);
      break;
    case GROUPING_OPTIONS.LAST_ACCESSED_MONTH:
      groups = groupByLastAccessedMonth(allTabs);
      break;
    case GROUPING_OPTIONS.CLOSE_TIME:
      groups = groupByCloseTime(allTabs);
      break;
    default:
      groups = { 'All Tabs': allTabs };
  }
  
  // Sort groups and create sections
  const sortedGroups = Object.entries(groups).sort((a, b) => {
    // Sort by date for date-based groupings
    if (groupingType.includes('Date') || groupingType.includes('Week') || groupingType.includes('Month') || groupingType === 'closeTime') {
      // For close time, extract date from "Closed MM/DD/YYYY, HH:MM:SS AM/PM" format
      if (groupingType === 'closeTime') {
        const extractCloseDate = (groupName) => {
          if (groupName === 'Never Closed') return new Date(0); // Sort to end
          const match = groupName.match(/Closed (.+)/);
          return match ? new Date(match[1]) : new Date(0);
        };
        const dateA = extractCloseDate(a[0]);
        const dateB = extractCloseDate(b[0]);
        return dateB - dateA; // Newest first
      } else {
        const dateA = extractDateFromGroupName(a[0]);
        const dateB = extractDateFromGroupName(b[0]);
        return dateB - dateA; // Newest first
      }
    }
    // Sort alphabetically for domain grouping
    return a[0].localeCompare(b[0]);
  });
  
  for (const [groupName, groupTabs] of sortedGroups) {
    if (groupTabs.length > 0) {
      const section = await createUnifiedGroupSection(groupName, groupTabs, groupingType, isFromSaved);
      groupedView.appendChild(section);
    }
  }
  
  // Always return the grouped view element
  return groupedView;
}


/**
 * Create a tab element using the unified renderer
 * @param {Object} tab - Tab object
 * @param {number} category - Tab category
 * @param {boolean} isFromSaved - Whether this is a saved tab
 * @returns {Promise<HTMLElement>}
 */
export async function createTabElement(tab, category, isFromSaved = false) {
  // Log duplicate info for debugging
  if (tab.duplicateIds || tab.duplicateCount) {
    console.log('Creating tab element with duplicates:', tab.url, 'duplicateIds:', tab.duplicateIds, 'count:', tab.duplicateCount);
  }
  
  return await createUnifiedTabElement(tab, category, isFromSaved);
}

// Grouping functions
function groupByDomain(tabs) {
  const groups = {};
  
  tabs.forEach(tab => {
    const domain = tab.domain || 'unknown';
    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(tab);
  });
  
  return groups;
}

function groupBySavedDate(tabs) {
  const groups = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  tabs.forEach(tab => {
    const savedDate = new Date(tab.savedAt || tab.lastAccessed || Date.now());
    const dateOnly = new Date(savedDate.getFullYear(), savedDate.getMonth(), savedDate.getDate());
    
    let groupName;
    if (dateOnly.getTime() === today.getTime()) {
      groupName = 'Today';
    } else if (dateOnly.getTime() === yesterday.getTime()) {
      groupName = 'Yesterday';
    } else {
      const daysAgo = Math.floor((today - dateOnly) / (1000 * 60 * 60 * 24));
      if (daysAgo <= 7) {
        groupName = `${daysAgo} days ago`;
      } else {
        groupName = `Saved ${formatDate(savedDate.getTime())}`;
      }
    }
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
  });
  
  return groups;
}

function groupBySavedWeek(tabs) {
  const groups = {};
  
  tabs.forEach(tab => {
    const savedDate = new Date(tab.savedAt || tab.lastAccessed || Date.now());
    const weekStart = getWeekStartDate(savedDate);
    const weekNum = getWeekNumber(savedDate);
    
    // Format: "Week of Mon DD"
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const groupName = `Week of ${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}`;
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
  });
  
  return groups;
}

function groupBySavedMonth(tabs) {
  const groups = {};
  
  tabs.forEach(tab => {
    const savedDate = new Date(tab.savedAt || tab.lastAccessed || Date.now());
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const groupName = `${monthNames[savedDate.getMonth()]} ${savedDate.getFullYear()}`;
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
  });
  
  return groups;
}

function groupByLastAccessedDate(tabs) {
  // Same logic as saved date but using lastAccessed timestamp
  return groupBySavedDate(tabs.map(tab => ({
    ...tab,
    savedAt: tab.lastAccessed || tab.savedAt
  })));
}

function groupByLastAccessedWeek(tabs) {
  // Same logic as saved week but using lastAccessed timestamp
  return groupBySavedWeek(tabs.map(tab => ({
    ...tab,
    savedAt: tab.lastAccessed || tab.savedAt
  })));
}

function groupByLastAccessedMonth(tabs) {
  // Same logic as saved month but using lastAccessed timestamp
  return groupBySavedMonth(tabs.map(tab => ({
    ...tab,
    savedAt: tab.lastAccessed || tab.savedAt
  })));
}

function groupByCloseTime(tabs) {
  const groups = {};
  
  tabs.forEach(tab => {
    if (tab.closeEvents && tab.closeEvents.length > 0) {
      // Group by each close event
      tab.closeEvents.forEach(event => {
        if (event.closeTime) {
          const closeDate = new Date(event.closeTime);
          const groupName = `Closed ${closeDate.toLocaleString()}`;
          
          if (!groups[groupName]) {
            groups[groupName] = [];
          }
          
          // Create a copy of the tab for this close event
          const tabCopy = {
            ...tab,
            closeTime: event.closeTime,
            groupKey: groupName
          };
          
          groups[groupName].push(tabCopy);
        }
      });
    } else if (tab.lastCloseTime) {
      // Fallback to single close time if available
      const closeDate = new Date(tab.lastCloseTime);
      const groupName = `Closed ${closeDate.toLocaleString()}`;
      
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      
      groups[groupName].push({
        ...tab,
        closeTime: tab.lastCloseTime,
        groupKey: groupName
      });
    } else {
      // No close time available
      const groupName = 'Never Closed';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(tab);
    }
  });
  
  return groups;
}

/**
 * Group tabs by the specified type
 * @param {Array} tabs - Array of tabs to group
 * @param {string} groupingType - Type of grouping
 * @returns {Object} Grouped tabs
 */
export function groupTabsBy(tabs, groupingType) {
  switch (groupingType) {
    case GROUPING_OPTIONS.DOMAIN:
      return groupByDomain(tabs);
    case GROUPING_OPTIONS.SAVED_DATE:
      return groupBySavedDate(tabs);
    case GROUPING_OPTIONS.SAVED_WEEK:
      return groupBySavedWeek(tabs);
    case GROUPING_OPTIONS.SAVED_MONTH:
      return groupBySavedMonth(tabs);
    case GROUPING_OPTIONS.LAST_ACCESSED_DATE:
      return groupByLastAccessedDate(tabs);
    case GROUPING_OPTIONS.LAST_ACCESSED_WEEK:
      return groupByLastAccessedWeek(tabs);
    case GROUPING_OPTIONS.LAST_ACCESSED_MONTH:
      return groupByLastAccessedMonth(tabs);
    case GROUPING_OPTIONS.CLOSE_TIME:
      return groupByCloseTime(tabs);
    default:
      return { 'All Tabs': tabs };
  }
}

// Note: extractDateFromGroupName is already imported from helpers.js at the top of the file

/**
 * Render tabs to a specific container (for background renderer)
 * @param {HTMLElement} container - Container to render tabs into
 * @param {Object} categorizedTabs - Categorized tabs data
 */
export async function renderTabsToContainer(container, categorizedTabs) {
  if (!container || !categorizedTabs) return;
  
  console.log('🔄 TabDisplay: Rendering tabs to custom container');
  
  // Clear container
  container.innerHTML = '';
  
  // Save current state
  const originalCategorizedTabs = state.categorizedTabs;
  const originalIsViewingSaved = state.isViewingSaved;
  
  try {
    // Temporarily set state for rendering
    state.categorizedTabs = categorizedTabs;
    state.isViewingSaved = false;
    
    const groupingType = state.popupState.groupingSelections.categorize || 'category';
    console.log('Rendering with grouping:', groupingType);
    
    if (groupingType === 'category') {
      await renderCategoryViewToContainer(container);
    } else {
      await renderGroupedViewToContainer(container, groupingType);
    }
    
  } finally {
    // Restore original state
    state.categorizedTabs = originalCategorizedTabs;
    state.isViewingSaved = originalIsViewingSaved;
  }
}

/**
 * Render category view to a specific container
 * @param {HTMLElement} container - Container to render into
 */
async function renderCategoryViewToContainer(container) {
  const categorizedTabs = state.categorizedTabs;
  
  // Create category sections
  for (const category of [TAB_CATEGORIES.IMPORTANT, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.UNCATEGORIZED]) {
    const tabs = categorizedTabs[category] || [];
    if (tabs.length > 0) {
      const categorySection = await createUnifiedCategorySection(category, tabs, false);
      if (categorySection) {
        container.appendChild(categorySection);
      }
    }
  }
}

/**
 * Render grouped view to a specific container
 * @param {HTMLElement} container - Container to render into
 * @param {string} groupingType - Type of grouping
 */
async function renderGroupedViewToContainer(container, groupingType) {
  const categorizedTabs = state.categorizedTabs;
  
  // Get all tabs
  const allTabs = Object.values(categorizedTabs).flat();
  
  if (allTabs.length === 0) {
    container.innerHTML = '<div class="no-tabs">No tabs to display</div>';
    return;
  }
  
  // Group tabs by the specified type
  const groups = groupTabsBy(allTabs, groupingType);
  
  // Create sections for each group
  for (const [groupName, tabs] of Object.entries(groups)) {
    if (tabs.length > 0) {
      const groupSection = await createUnifiedGroupSection(groupName, tabs, groupingType, false);
      if (groupSection) {
        container.appendChild(groupSection);
      }
    }
  }
}


// Import tab operations
import { saveAndCloseCategory, openAllInCategory, closeAllInCategory, openAllTabsInGroup, closeTabsInGroup, saveAndCloseTabsInGroup, deleteTabsInGroup, closeTab, deleteSavedTab } from './tab-operations.js';

// Re-export unified functions for backward compatibility
export { createUnifiedGroupSection as createGroupSection, createUnifiedCategorySection as createCategorySection };

// Export functions
export default {
  displayTabs,
  showCurrentTabsContent,
  displayGroupedView,
  createGroupSection: createUnifiedGroupSection,
  createTabElement,
  renderTabsToContainer,
  groupTabsBy
};