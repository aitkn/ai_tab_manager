/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Saved Tabs Manager - handles all saved tabs functionality
 */

import { TAB_CATEGORIES, DOM_IDS, CSS_CLASSES, DISPLAY, GROUPING_OPTIONS } from '../utils/constants.js';
import { $id, show, hide, classes, createElement } from '../utils/dom-helpers.js';
import { extractDateFromGroupName } from '../utils/helpers.js';
import { showStatus, updateSavedBadge, switchToTab } from './ui-manager.js';
import { state, restoreScrollPosition } from './state-manager.js';
import { displayGroupedView, createTabElement } from './tab-display.js';
import { openAllTabsInGroup, deleteTabsInGroup } from './tab-operations.js';
// Database is available as window.window.tabDatabase

/**
 * Show saved tabs content
 */
export async function showSavedTabsContent(groupingType, includeCanClose = false) {
  try {
    // Make sure the saved tab pane exists and is ready
    const savedTab = $id('savedTab');
    if (!savedTab) {
      console.error('Saved tab pane not found');
      return;
    }
    
    // Show recent sessions
    await displayRecentSessions();
    
    // Load saved URLs from database (by default only categories 2 and 3)
    const categories = includeCanClose ? [1, 2, 3] : [2, 3];
    const savedUrls = await window.tabDatabase.getSavedUrls(categories);
    
    // Convert URLs to tab format for display
    const allSavedTabs = savedUrls.map(urlInfo => ({
      id: urlInfo.id,
      url: urlInfo.url,
      title: urlInfo.title,
      domain: urlInfo.domain,
      category: urlInfo.category,
      savedDate: urlInfo.firstSeen,
      lastAccessedDate: urlInfo.lastCategorized || urlInfo.firstSeen,
      favicon: urlInfo.favicon
    }));
    
    // Get current grouping from dropdown if not passed
    if (!groupingType) {
      const savedGroupingSelect = $id(DOM_IDS.SAVED_GROUPING_SELECT);
      groupingType = savedGroupingSelect ? savedGroupingSelect.value : 'category';
    }
    
    // Store the saved tabs in a temporary object for display (don't overwrite categorizedTabs)
    const savedTabsByCategory = { 
      [TAB_CATEGORIES.CAN_CLOSE]: [], 
      [TAB_CATEGORIES.SAVE_LATER]: [], 
      [TAB_CATEGORIES.IMPORTANT]: [] 
    };
    
    allSavedTabs.forEach(tab => {
      if (savedTabsByCategory[tab.category]) {
        savedTabsByCategory[tab.category].push(tab);
      }
    });
    
    // Get the saved content container
    const savedContent = $id(DOM_IDS.SAVED_CONTENT);
    savedContent.innerHTML = '';
    
    if (groupingType === 'category') {
      displayCategoryView(savedContent, savedTabsByCategory, allSavedTabs);
    } else {
      // For non-category groupings, we need to pass the tabs in the expected format
      // displayGroupedView expects an object with category keys
      const tabsForDisplay = {
        [TAB_CATEGORIES.CAN_CLOSE]: savedTabsByCategory[TAB_CATEGORIES.CAN_CLOSE] || [],
        [TAB_CATEGORIES.SAVE_LATER]: savedTabsByCategory[TAB_CATEGORIES.SAVE_LATER] || [],
        [TAB_CATEGORIES.IMPORTANT]: savedTabsByCategory[TAB_CATEGORIES.IMPORTANT] || []
      };
      
      const groupedView = displayGroupedView(groupingType, true, tabsForDisplay);
      if (groupedView) {
        savedContent.appendChild(groupedView);
        
        // Count groups and update status
        const groupElements = groupedView.querySelectorAll('.group-section');
        const groupCount = groupElements.length;
        let groupTypeLabel = getGroupTypeLabel(groupingType, groupCount);
        
        showStatus(`Viewing ${allSavedTabs.length} saved tabs in ${groupCount} ${groupTypeLabel}`, 'success');
      }
    }
    
    // Don't restore scroll during initialization - it's handled centrally
    if (!state.isInitializing) {
      restoreScrollPosition('saved', 100);
      restoreScrollPosition('saved', 500);
      restoreScrollPosition('saved', 1000);
    }
    
  } catch (error) {
    showStatus('Error loading saved tabs: ' + error.message, 'error');
  }
}

/**
 * Display saved tabs in category view
 */
function displayCategoryView(savedContent, savedTabsByCategory, allSavedTabs) {
  // Create a category view in saved content
  const categoryView = createElement('div', {
    className: 'grouping-view',
    id: 'savedCategoryView'
  });
  
  // Display each category
  [TAB_CATEGORIES.IMPORTANT, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.CAN_CLOSE].forEach(category => {
    const tabs = savedTabsByCategory[category] || [];
    if (tabs.length === 0) return; // Skip empty categories
    
    const section = createCategorySection(category, tabs);
    categoryView.appendChild(section);
  });
  
  if (allSavedTabs.length === 0) {
    // Show empty state message
    const emptyMessage = createEmptyStateMessage();
    savedContent.appendChild(emptyMessage);
  } else {
    savedContent.appendChild(categoryView);
    // Count non-empty categories
    const nonEmptyCategories = [TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.IMPORTANT]
      .filter(cat => savedTabsByCategory[cat].length > 0).length;
    showStatus(`Viewing ${allSavedTabs.length} saved tabs in ${nonEmptyCategories} ${nonEmptyCategories === 1 ? 'category' : 'categories'}`, 'success');
  }
}

/**
 * Create a category section for saved tabs
 */
function createCategorySection(category, tabs) {
  const section = createElement('div', {
    className: CSS_CLASSES.CATEGORY_SECTION,
    id: `savedCategory${category}`
  });
  
  const header = createElement('h2', {
    className: `category-header ${category === TAB_CATEGORIES.IMPORTANT ? 'important' : category === TAB_CATEGORIES.SAVE_LATER ? 'somewhat-important' : 'not-important'}`
  });
  
  const iconSvg = getCategoryIcon(category);
  const categoryName = getCategoryName(category);
  
  header.innerHTML = `
    <div class="category-header-title">
      ${iconSvg} ${categoryName} (<span class="count">${tabs.length}</span>)
    </div>
    <div class="category-header-actions"></div>
  `;
  
  // Add action buttons to header
  if (tabs.length > 0) {
    const headerActions = header.querySelector('.category-header-actions');
    
    // Open All button with icon
    const openAllBtn = createElement('button', {
      className: 'icon-btn',
      title: `Open all ${tabs.length} tabs`,
      innerHTML: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      `,
      onclick: () => openAllTabsInGroup(tabs)
    });
    
    // Delete all button with icon
    const deleteBtn = createElement('button', {
      className: 'icon-btn delete-btn',
      title: `Delete all ${tabs.length} tabs`,
      innerHTML: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      `,
      onclick: () => deleteTabsInGroup(tabs, categoryName)
    });
    
    headerActions.appendChild(openAllBtn);
    headerActions.appendChild(deleteBtn);
  }
  
  const listContainer = createElement('div', {
    className: CSS_CLASSES.TABS_LIST
  });
  
  // Add tabs
  tabs.forEach(tab => {
    const tabElement = createTabElement(tab, category, true);
    listContainer.appendChild(tabElement);
  });
  
  section.appendChild(header);
  section.appendChild(listContainer);
  
  // Make category header clickable to collapse/expand
  header.style.cursor = 'pointer';
  header.onclick = (e) => {
    // Don't collapse if clicking on action buttons
    if (e.target.closest('.category-header-actions')) return;
    
    section.classList.toggle(CSS_CLASSES.CATEGORY_COLLAPSED);
    const isCollapsed = section.classList.contains('collapsed');
    listContainer.style.display = isCollapsed ? 'none' : 'block';
  };
  
  return section;
}

/**
 * Create empty state message
 */
function createEmptyStateMessage() {
  return createElement('div', {
    style: 'text-align: center; padding: 40px 20px; color: var(--text-secondary);',
    innerHTML: `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 16px; display: block; opacity: 0.5;">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
      <h3 style="margin: 0 0 8px 0; font-weight: 500;">No saved tabs yet</h3>
      <p style="margin: 0; font-size: 14px;">Categorize your tabs and save them to view here</p>
    `
  });
}

/**
 * Get category icon SVG
 */
function getCategoryIcon(category) {
  if (category === TAB_CATEGORIES.IMPORTANT) {
    return '<svg class="category-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  } else if (category === TAB_CATEGORIES.SAVE_LATER) {
    return '<svg class="category-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>';
  } else {
    return '<svg class="category-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  }
}

/**
 * Get category name
 */
function getCategoryName(category) {
  if (category === TAB_CATEGORIES.IMPORTANT) {
    return 'Important Links';
  } else if (category === TAB_CATEGORIES.SAVE_LATER) {
    return 'Save for Later';
  } else {
    return 'Can Be Closed';
  }
}

/**
 * Get group type label
 */
function getGroupTypeLabel(groupingType, groupCount) {
  switch (groupingType) {
    case 'domain':
      return groupCount === 1 ? 'domain' : 'domains';
    case 'savedDate':
      return groupCount === 1 ? 'save date' : 'save dates';
    case 'savedWeek':
      return groupCount === 1 ? 'save week' : 'save weeks';
    case 'savedMonth':
      return groupCount === 1 ? 'save month' : 'save months';
    case 'lastAccessedDate':
      return groupCount === 1 ? 'open date' : 'open dates';
    case 'lastAccessedWeek':
      return groupCount === 1 ? 'open week' : 'open weeks';
    case 'lastAccessedMonth':
      return groupCount === 1 ? 'open month' : 'open months';
    default:
      return 'groups';
  }
}

/**
 * Legacy function for compatibility
 */
export async function showSavedTabs() {
  switchToTab('saved');
}

/**
 * Load saved tabs count
 */
export async function loadSavedTabsCount() {
  try {
    const savedUrls = await window.tabDatabase.getSavedUrls([2, 3]); // Only count important and save for later
    updateSavedBadge(savedUrls.length);
    return savedUrls.length;
  } catch (error) {
    console.error('Error loading saved tabs count:', error);
    return 0;
  }
}

/**
 * Handle saved tab search
 */
export function handleSavedTabSearch(searchQuery) {
  const savedContent = $id(DOM_IDS.SAVED_CONTENT);
  if (!savedContent) return;
  
  const tabElements = savedContent.querySelectorAll('.tab-item');
  let visibleCount = 0;
  
  tabElements.forEach(tabElement => {
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
  
  // Update status to show filter results
  if (searchQuery) {
    showStatus(`Found ${visibleCount} saved tabs matching "${searchQuery}"`, 'success');
  }
}


/**
 * Display recent sessions
 */
export async function displayRecentSessions() {
  try {
    const sessionsContainer = $id('recentSessions');
    const sessionsList = $id('sessionsList');
    
    if (!sessionsContainer || !sessionsList) return;
    
    // Get recent sessions from database
    const sessions = await window.tabDatabase.getRecentSessions(5);
    
    if (sessions.length === 0) {
      hide(sessionsContainer);
      return;
    }
    
    show(sessionsContainer);
    sessionsList.innerHTML = '';
    
    // Display each session
    for (const session of sessions) {
      const sessionTime = new Date(session.closeTime);
      const timeAgo = getTimeAgo(sessionTime);
      
      const sessionItem = createElement('div', {
        className: 'session-item',
        title: `Restore ${session.count} tabs closed at ${sessionTime.toLocaleString()}`
      });
      
      const sessionInfo = createElement('div', { className: 'session-info' });
      sessionInfo.appendChild(createElement('div', {
        className: 'session-time',
        textContent: timeAgo
      }));
      sessionInfo.appendChild(createElement('div', {
        className: 'session-count',
        textContent: `${session.count} tabs`
      }));
      
      sessionItem.appendChild(sessionInfo);
      
      const restoreBtn = createElement('button', {
        className: CSS_CLASSES.ICON_BTN_SMALL,
        title: 'Restore this session',
        innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>'
      });
      
      on(restoreBtn, EVENTS.CLICK, async (e) => {
        e.stopPropagation();
        await restoreSession(session.closeTime);
      });
      
      sessionItem.appendChild(restoreBtn);
      sessionsList.appendChild(sessionItem);
    }
  } catch (error) {
    console.error('Error displaying recent sessions:', error);
  }
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  
  return date.toLocaleDateString();
}

/**
 * Restore a session
 */
async function restoreSession(closeTime) {
  try {
    showStatus('Restoring session...', 'loading');
    
    const tabs = await window.tabDatabase.getTabsClosedAt(closeTime);
    let openedCount = 0;
    
    for (const tab of tabs) {
      try {
        await ChromeAPIService.createTab({ url: tab.url });
        openedCount++;
      } catch (error) {
        console.error('Error opening tab:', error);
      }
    }
    
    showStatus(`Restored ${openedCount} tabs`, 'success');
  } catch (error) {
    console.error('Error restoring session:', error);
    showStatus('Error restoring session', 'error');
  }
}

// Export default object
export default {
  showSavedTabsContent,
  showSavedTabs,
  loadSavedTabsCount,
  handleSavedTabSearch,
  displayRecentSessions
};