/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Tab Display Module - handles rendering of tabs in various views
 */

import { DOM_IDS, CSS_CLASSES, TAB_CATEGORIES, CATEGORY_NAMES, GROUPING_OPTIONS, URLS } from '../utils/constants.js';
import { $, $id, show, hide, classes, createElement } from '../utils/dom-helpers.js';
import { getRootDomain, getSubdomain, sortTabsInGroup, getWeekNumber, getWeekStartDate, formatDate } from '../utils/helpers.js';
import { state } from './state-manager.js';
import { showStatus } from './ui-manager.js';

/**
 * Display tabs based on current state and grouping
 */
export function displayTabs(isFromSaved = false) {
  try {
    state.isViewingSaved = isFromSaved;
    
    // Note: Grouping controls are now in the fixed controls area, not in the scrollable container
    
    if (!isFromSaved) {
      const groupingType = state.popupState.groupingSelections.categorize || 'category';
      console.log('Displaying tabs with grouping:', groupingType);
      
      if (groupingType === 'category') {
        displayCategoryView();
      } else {
        displayGroupedView(groupingType, false);
      }
    }
  } catch (error) {
    console.error('Error displaying tabs:', error);
    showStatus('Error displaying tabs', 'error');
  }
}

/**
 * Display tabs grouped by category
 */
export function displayCategoryView() {
  const container = $id(DOM_IDS.TABS_CONTAINER);
  if (!container) {
    console.error('Tabs container not found');
    return;
  }
  
  // Show category view, hide grouped view
  show($id(DOM_IDS.CATEGORY_VIEW));
  hide($id(DOM_IDS.GROUPED_VIEW));
  
  // Display each category in order of importance
  [TAB_CATEGORIES.IMPORTANT, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.CAN_CLOSE].forEach(category => {
    const categorySection = $id(`category${category}`);
    if (!categorySection) {
      console.error(`Category section not found for category ${category}`);
      return;
    }
    
    const tabsList = categorySection.querySelector('.tabs-list');
    const countElement = categorySection.querySelector('.count');
    const tabs = state.categorizedTabs[category] || [];
    
    // Update count
    if (countElement) {
      countElement.textContent = tabs.length;
    }
    
    // Clear existing tabs
    tabsList.innerHTML = '';
    
    // Mark section as empty if no tabs
    if (tabs.length === 0) {
      classes.add(categorySection, CSS_CLASSES.CATEGORY_EMPTY);
    } else {
      classes.remove(categorySection, CSS_CLASSES.CATEGORY_EMPTY);
      
      // Sort tabs by domain first, then add them
      const sortedTabs = sortTabsInGroup(tabs, 'category');
      
      sortedTabs.forEach(tab => {
        const shouldShow = !state.searchQuery || 
          tab.title.toLowerCase().includes(state.searchQuery) || 
          tab.url.toLowerCase().includes(state.searchQuery);
        
        if (shouldShow) {
          const tabElement = createTabElement(tab, category);
          tabsList.appendChild(tabElement);
        }
      });
    }
    
    // Add action buttons to category header if they don't exist
    const headerActions = categorySection.querySelector('.category-header-actions');
    if (headerActions && headerActions.children.length === 0 && tabs.length > 0) {
      // Only add buttons for categories 2 and 3 (not for "Can Be Closed")
      if (category === TAB_CATEGORIES.SAVE_LATER || category === TAB_CATEGORIES.IMPORTANT) {
        const saveBtn = createElement('button', {
          className: CSS_CLASSES.ICON_BTN_SMALL,
          title: 'Save tabs in this category',
          innerHTML: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
          onclick: () => saveAndCloseCategory(category)
        });
        headerActions.appendChild(saveBtn);
      }
      
      // Add open all button
      const openAllBtn = createElement('button', {
        className: CSS_CLASSES.ICON_BTN_SMALL,
        title: 'Open all tabs in this category',
        innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
        onclick: () => openAllInCategory(category)
      });
      headerActions.appendChild(openAllBtn);
      
      // Add close all button
      const closeAllBtn = createElement('button', {
        className: CSS_CLASSES.ICON_BTN_SMALL + ' ' + CSS_CLASSES.DANGER_BTN,
        title: 'Close all tabs in this category',
        innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        onclick: () => closeAllInCategory(category)
      });
      headerActions.appendChild(closeAllBtn);
    }
  });
}

/**
 * Display tabs in grouped view
 * @param {string} groupingType - Type of grouping
 * @param {boolean} isFromSaved - Whether displaying saved tabs
 * @param {Object} tabsToDisplay - Optional tabs to display (for saved tabs)
 */
export function displayGroupedView(groupingType, isFromSaved = false, tabsToDisplay = null) {
  const tabs = tabsToDisplay || state.categorizedTabs;
  const container = isFromSaved ? $id(DOM_IDS.SAVED_CONTENT) : $id(DOM_IDS.TABS_CONTAINER);
  if (!container) return;
  
  // For saved tabs, we create a new grouped view element
  let groupedView;
  if (isFromSaved) {
    groupedView = createElement('div', {
      className: 'grouping-view',
      id: 'savedGroupedView'
    });
  } else {
    // Hide category view, show grouped view
    hide($id(DOM_IDS.CATEGORY_VIEW));
    groupedView = $id(DOM_IDS.GROUPED_VIEW);
    show(groupedView);
    // Clear existing content
    groupedView.innerHTML = '';
  }
  
  // Flatten all tabs from all categories
  const allTabs = [];
  [TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.IMPORTANT].forEach(category => {
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
    default:
      groups = { 'All Tabs': allTabs };
  }
  
  // Sort groups and create sections
  const sortedGroups = Object.entries(groups).sort((a, b) => {
    // Sort by date for date-based groupings
    if (groupingType.includes('Date') || groupingType.includes('Week') || groupingType.includes('Month')) {
      const dateA = extractDateFromGroupName(a[0]);
      const dateB = extractDateFromGroupName(b[0]);
      return dateB - dateA; // Newest first
    }
    // Sort alphabetically for domain grouping
    return a[0].localeCompare(b[0]);
  });
  
  sortedGroups.forEach(([groupName, groupTabs]) => {
    if (groupTabs.length > 0) {
      const section = createGroupSection(groupName, groupTabs, groupingType);
      groupedView.appendChild(section);
    }
  });
  
  // Return the grouped view for saved tabs
  if (isFromSaved) {
    return groupedView;
  }
}

/**
 * Create a group section
 */
export function createGroupSection(groupName, tabs, groupingType) {
  // Sort tabs within the group
  const sortedTabs = sortTabsInGroup(tabs, groupingType);
  
  // Count tabs by category
  const categoryCounts = { 
    [TAB_CATEGORIES.CAN_CLOSE]: 0, 
    [TAB_CATEGORIES.SAVE_LATER]: 0, 
    [TAB_CATEGORIES.IMPORTANT]: 0 
  };
  
  sortedTabs.forEach(tab => {
    if (categoryCounts[tab.category] !== undefined) {
      categoryCounts[tab.category]++;
    }
  });
  
  const section = createElement('div', {
    className: CSS_CLASSES.GROUP_SECTION
  });
  
  // Create header
  const header = createElement('div', {
    className: 'group-header',
    onclick: () => classes.toggle(section, CSS_CLASSES.GROUP_COLLAPSED)
  });
  
  // Group title with icon
  const titleDiv = createElement('div', { className: 'group-title' });
  
  // Add appropriate icon based on grouping type
  let icon = '';
  if (groupingType === GROUPING_OPTIONS.DOMAIN) {
    icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
  } else if (groupingType.includes('Date') || groupingType.includes('Week') || groupingType.includes('Month')) {
    icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
  }
  
  titleDiv.innerHTML = icon + `<span>${groupName}</span>`;
  header.appendChild(titleDiv);
  
  // Create stats and actions container
  const headerRight = createElement('div', { className: 'header-right' });
  
  // Stats
  const stats = createElement('div', { className: CSS_CLASSES.GROUP_STATS });
  
  // Show counts with icons for each category
  if (categoryCounts[TAB_CATEGORIES.IMPORTANT] > 0) {
    const importantStat = createElement('span', {
      className: 'stat-item important',
      innerHTML: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ${categoryCounts[TAB_CATEGORIES.IMPORTANT]}`
    });
    stats.appendChild(importantStat);
  }
  
  if (categoryCounts[TAB_CATEGORIES.SAVE_LATER] > 0) {
    const saveForLaterStat = createElement('span', {
      className: 'stat-item somewhat',
      innerHTML: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg> ${categoryCounts[TAB_CATEGORIES.SAVE_LATER]}`
    });
    stats.appendChild(saveForLaterStat);
  }
  
  if (categoryCounts[TAB_CATEGORIES.CAN_CLOSE] > 0) {
    const canCloseStat = createElement('span', {
      className: 'stat-item not-important',
      innerHTML: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> ${categoryCounts[TAB_CATEGORIES.CAN_CLOSE]}`
    });
    stats.appendChild(canCloseStat);
  }
  
  // Total count
  const totalStat = createElement('span', {
    className: 'stat-item total',
    textContent: `Total: ${tabs.length}`
  });
  stats.appendChild(totalStat);
  
  headerRight.appendChild(stats);
  
  // Group actions
  const groupActions = createElement('div', { className: 'group-actions' });
  
  // Open all button
  const openAllBtn = createElement('button', {
    className: CSS_CLASSES.ICON_BTN_SMALL,
    title: 'Open all tabs in this group',
    innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
    onclick: (e) => {
      e.stopPropagation();
      openAllTabsInGroup(groupName);
    }
  });
  groupActions.appendChild(openAllBtn);
  
  // Delete group button (for saved tabs view)
  if (state.isViewingSaved) {
    const deleteBtn = createElement('button', {
      className: CSS_CLASSES.ICON_BTN_SMALL + ' delete-btn',
      title: 'Delete all tabs in this group',
      innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
      onclick: (e) => {
        e.stopPropagation();
        deleteTabsInGroup(groupName);
      }
    });
    groupActions.appendChild(deleteBtn);
  }
  
  headerRight.appendChild(groupActions);
  header.appendChild(headerRight);
  section.appendChild(header);
  
  // Create tabs list
  const tabsList = createElement('div', { className: CSS_CLASSES.TABS_LIST });
  
  // Add tabs
  sortedTabs.forEach(tab => {
    const shouldShow = !state.searchQuery || 
      tab.title.toLowerCase().includes(state.searchQuery) || 
      tab.url.toLowerCase().includes(state.searchQuery);
    
    if (shouldShow) {
      const tabElement = createTabElement(tab, tab.category);
      tabsList.appendChild(tabElement);
    }
  });
  
  section.appendChild(tabsList);
  
  return section;
}

/**
 * Create a tab element
 */
export function createTabElement(tab, category) {
  const tabElement = createElement('div', {
    className: CSS_CLASSES.TAB_ITEM,
    dataset: { 
      tabId: tab.id,
      category: category
    }
  });
  
  // Add class if already saved
  if (tab.alreadySaved) {
    classes.add(tabElement, CSS_CLASSES.TAB_ALREADY_SAVED);
  }
  
  // Favicon
  const favicon = createElement('img', {
    className: 'favicon',
    src: tab.favIconUrl || URLS.FAVICON_API.replace('{domain}', tab.domain),
    onerror: function() { this.src = URLS.FAVICON_API.replace('{domain}', 'default'); }
  });
  tabElement.appendChild(favicon);
  
  // Tab info
  const tabInfo = createElement('div', {
    className: 'tab-info',
    onclick: () => {
      chrome.tabs.update(tab.id, { active: true });
      window.close();
    }
  });
  
  // Title with duplicate count if applicable
  let titleText = tab.title || 'Untitled';
  if (tab.duplicateCount && tab.duplicateCount > 1) {
    titleText += ` (${tab.duplicateCount})`;
  }
  
  const tabTitle = createElement('div', {
    className: 'tab-title',
    textContent: titleText,
    title: titleText
  });
  tabInfo.appendChild(tabTitle);
  
  const tabUrl = createElement('div', {
    className: 'tab-url',
    textContent: tab.url,
    title: tab.url
  });
  tabInfo.appendChild(tabUrl);
  
  tabElement.appendChild(tabInfo);
  
  // Action buttons
  if (!state.isViewingSaved) {
    // Move buttons for categorized tabs
    const moveButtons = createElement('div', { className: 'move-buttons' });
    
    const moveUpBtn = createElement('button', {
      className: 'move-btn',
      title: 'Move to more important',
      innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>',
      disabled: category === TAB_CATEGORIES.IMPORTANT,
      onclick: (e) => {
        e.stopPropagation();
        moveTab(tab, category, 'up');
      }
    });
    moveButtons.appendChild(moveUpBtn);
    
    const moveDownBtn = createElement('button', {
      className: 'move-btn',
      title: 'Move to less important',
      innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>',
      disabled: category === TAB_CATEGORIES.CAN_CLOSE,
      onclick: (e) => {
        e.stopPropagation();
        moveTab(tab, category, 'down');
      }
    });
    moveButtons.appendChild(moveDownBtn);
    
    tabElement.appendChild(moveButtons);
    
    // Close button
    const closeBtn = createElement('button', {
      className: 'close-btn',
      title: 'Close tab',
      innerHTML: '×',
      onclick: (e) => {
        e.stopPropagation();
        closeTab(tab, category);
      }
    });
    tabElement.appendChild(closeBtn);
  } else {
    // Delete button for saved tabs
    const deleteBtn = createElement('button', {
      className: 'delete-btn',
      title: 'Delete saved tab',
      innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
      onclick: (e) => {
        e.stopPropagation();
        deleteSavedTab(tab.id);
      }
    });
    tabElement.appendChild(deleteBtn);
  }
  
  return tabElement;
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

// Note: extractDateFromGroupName is already imported from helpers.js at the top of the file

// Import tab operations
import { saveAndCloseCategory, openAllInCategory, closeAllInCategory, openAllTabsInGroup, deleteTabsInGroup, moveTab, closeTab, deleteSavedTab } from './tab-operations.js';

// Export functions
export default {
  displayTabs,
  displayCategoryView,
  displayGroupedView,
  createGroupSection,
  createTabElement
};