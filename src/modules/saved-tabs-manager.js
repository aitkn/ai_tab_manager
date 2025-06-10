/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Saved Tabs Manager - handles all saved tabs functionality
 */

import { TAB_CATEGORIES, CATEGORY_NAMES, DOM_IDS, CSS_CLASSES, DISPLAY, GROUPING_OPTIONS, EVENTS } from '../utils/constants.js';
import { $id, show, hide, classes, createElement, on } from '../utils/dom-helpers.js';
import { extractDateFromGroupName } from '../utils/helpers.js';
import { showStatus, updateSavedBadge, switchToTab } from './ui-manager.js';
import { state } from './state-manager.js';
import { displayGroupedView, createTabElement } from './tab-display.js';
import { openSavedTabs, deleteTabsInGroup, deleteTabsInCategory } from './tab-operations.js';
import { preloadFavicons } from '../utils/favicon-loader.js';
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
    
    
    // Get current grouping from dropdown if not passed
    if (!groupingType) {
      const savedGroupingSelect = $id(DOM_IDS.SAVED_GROUPING_SELECT);
      groupingType = savedGroupingSelect ? savedGroupingSelect.value : 'category';
    }
    
    // Load saved URLs from database (by default only categories 2 and 3)
    const categories = includeCanClose ? [1, 2, 3] : [2, 3];
    // Include events when grouping by close time
    const includeEvents = groupingType === 'closeTime';
    const savedUrls = await window.tabDatabase.getSavedUrls(categories, includeEvents);
    console.log('Loaded saved URLs:', savedUrls.length, 'categories:', categories);
    
    // Convert URLs to tab format for display
    const allSavedTabs = savedUrls.map(urlInfo => ({
      id: urlInfo.id,
      url: urlInfo.url,
      title: urlInfo.title,
      domain: urlInfo.domain,
      category: urlInfo.category,
      savedDate: urlInfo.firstSeen,
      lastAccessedDate: urlInfo.lastCategorized || urlInfo.firstSeen,
      lastCloseTime: urlInfo.lastCloseTime,
      closeEvents: urlInfo.closeEvents,
      favicon: urlInfo.favicon,
      favIconUrl: urlInfo.favicon // Also set favIconUrl for favicon loader compatibility
    }));
    
    // Preload favicons for better performance
    if (allSavedTabs.length > 0) {
      preloadFavicons(allSavedTabs);
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
    
    // Hide content to prevent scroll jump
    savedContent.style.opacity = '0';
    savedContent.style.pointerEvents = 'none';
    
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
      
      const groupedView = await displayGroupedView(groupingType, true, tabsForDisplay);
      if (groupedView) {
        savedContent.appendChild(groupedView);
        
        // Count groups and update status
        const groupElements = groupedView.querySelectorAll('.group-section');
        const groupCount = groupElements.length;
        let groupTypeLabel = getGroupTypeLabel(groupingType, groupCount);
        
        // Don't show status message when switching to saved tab
      }
    }
    
    // Show content with smooth transition
    requestAnimationFrame(() => {
      savedContent.style.transition = 'opacity 150ms ease-in-out';
      savedContent.style.opacity = '1';
      savedContent.style.pointerEvents = 'auto';
      
      // Restore scroll position after content is visible and layout is calculated
      if (state.popupState.scrollPositions?.saved) {
        const scrollPos = state.popupState.scrollPositions.saved;
        console.log(`📍 Saved: Restoring scroll position: ${scrollPos}px`);
        // Use another frame to ensure layout is complete
        requestAnimationFrame(() => {
          // Additional small delay to ensure content height is calculated
          setTimeout(() => {
            savedContent.scrollTop = scrollPos;
            console.log(`✅ Saved: Scroll position restored to ${savedContent.scrollTop}px`);
          }, 10);
        });
      } else {
        console.log('📍 Saved: No scroll position to restore');
      }
      
      // Clean up transition after it completes
      setTimeout(() => {
        savedContent.style.transition = '';
      }, 150);
    });
    
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
    // Don't show status message when switching to saved tab
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
    className: 'category-header'
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
      onclick: () => openSavedTabs(tabs)
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
      onclick: () => deleteTabsInCategory(tabs, categoryName)
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
  // Use CATEGORY_NAMES constant for consistency
  return CATEGORY_NAMES[category] || CATEGORY_NAMES[TAB_CATEGORIES.CAN_CLOSE];
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
 * Render saved tabs to a specific container (for background renderer)
 * @param {HTMLElement} container - Container to render tabs into
 * @param {Object} savedData - Saved tabs data
 * @param {string} groupingType - Grouping type
 * @param {boolean} showIgnore - Whether to show ignored tabs
 */
export async function renderSavedTabsToContainer(container, savedData, groupingType, showIgnore) {
  if (!container || !savedData) return;
  
  console.log('🔄 SavedTabsManager: Rendering saved tabs to custom container');
  
  // Clear container
  container.innerHTML = '';
  
  try {
    // Use the saved data provided
    const { tabs } = savedData;
    
    if (!tabs || tabs.length === 0) {
      container.innerHTML = '<div class="no-tabs">No saved tabs to display</div>';
      return;
    }
    
    // Save current state
    const originalIsViewingSaved = state.isViewingSaved;
    
    try {
      // Set viewing saved for rendering
      state.isViewingSaved = true;
      
      // Group tabs and render
      await renderSavedTabGroupsToContainer(container, tabs, groupingType);
      
    } finally {
      // Restore original state
      state.isViewingSaved = originalIsViewingSaved;
    }
    
  } catch (error) {
    console.error('Error rendering saved tabs to container:', error);
    container.innerHTML = '<div class="error">Error loading saved tabs</div>';
  }
}

/**
 * Render saved tab groups to container
 * @param {HTMLElement} container - Container to render into
 * @param {Array} tabs - Saved tabs
 * @param {string} groupingType - Grouping type
 */
async function renderSavedTabGroupsToContainer(container, tabs, groupingType) {
  if (groupingType === 'category') {
    // Group by category
    const groupedTabs = {};
    tabs.forEach(tab => {
      const category = tab.category;
      if (!groupedTabs[category]) {
        groupedTabs[category] = [];
      }
      groupedTabs[category].push(tab);
    });
    
    // Render each category
    for (const [category, categoryTabs] of Object.entries(groupedTabs)) {
      if (categoryTabs.length > 0) {
        const categorySection = createSavedCategorySection(parseInt(category), categoryTabs);
        if (categorySection) {
          container.appendChild(categorySection);
        }
      }
    }
  } else {
    // Use grouped view for other grouping types
    await renderGroupedSavedTabsToContainer(container, tabs, groupingType);
  }
}

/**
 * Create saved category section
 * @param {number} category - Category number
 * @param {Array} tabs - Tabs in category
 * @returns {HTMLElement} Category section
 */
function createSavedCategorySection(category, tabs) {
  const section = createElement('div', {
    className: CSS_CLASSES.CATEGORY_SECTION,
    id: `saved-category-${category}`,
    dataset: { category: category }
  });
  
  // Create header
  const header = createElement('div', { className: CSS_CLASSES.CATEGORY_HEADER });
  
  const categoryInfo = createElement('div', { className: CSS_CLASSES.CATEGORY_INFO });
  
  const categoryIcon = createElement('div', { 
    className: CSS_CLASSES.CATEGORY_ICON,
    innerHTML: getSavedCategoryIcon(category)
  });
  
  const categoryName = createElement('div', { 
    className: CSS_CLASSES.CATEGORY_NAME,
    textContent: CATEGORY_NAMES[category] || `Category ${category}`
  });
  
  const categoryCount = createElement('div', { 
    className: CSS_CLASSES.CATEGORY_COUNT,
    textContent: `${tabs.length} saved tab${tabs.length === 1 ? '' : 's'}`
  });
  
  categoryInfo.appendChild(categoryIcon);
  categoryInfo.appendChild(categoryName);
  categoryInfo.appendChild(categoryCount);
  
  header.appendChild(categoryInfo);
  section.appendChild(header);
  
  // Create tabs list
  const tabsList = createElement('div', { className: CSS_CLASSES.TABS_LIST });
  
  tabs.forEach(tab => {
    const tabElement = createTabElement(tab, category);
    tabsList.appendChild(tabElement);
  });
  
  section.appendChild(tabsList);
  
  return section;
}

/**
 * Render grouped saved tabs to container
 * @param {HTMLElement} container - Container to render into
 * @param {Array} tabs - Saved tabs
 * @param {string} groupingType - Grouping type
 */
async function renderGroupedSavedTabsToContainer(container, tabs, groupingType) {
  // Save original state
  const originalCategorizedTabs = state.categorizedTabs;
  const originalIsViewingSaved = state.isViewingSaved;
  
  try {
    // Set state for grouped rendering
    state.isViewingSaved = true;
    
    // Use displayGroupedView from tab-display.js
    const { groupTabsBy } = await import('./tab-display.js');
    const groups = groupTabsBy(tabs, groupingType);
    
    // Render each group
    for (const [groupName, groupTabs] of Object.entries(groups)) {
      if (groupTabs.length > 0) {
        const { createGroupSection } = await import('./tab-display.js');
        const groupSection = createGroupSection(groupName, groupTabs, groupingType);
        if (groupSection) {
          container.appendChild(groupSection);
        }
      }
    }
    
  } finally {
    // Restore original state
    state.categorizedTabs = originalCategorizedTabs;
    state.isViewingSaved = originalIsViewingSaved;
  }
}

/**
 * Get saved category icon HTML
 * @param {number} category - Category number
 * @returns {string} Icon HTML
 */
function getSavedCategoryIcon(category) {
  switch (category) {
    case TAB_CATEGORIES.IMPORTANT:
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>';
    case TAB_CATEGORIES.SAVE_LATER:
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>';
    case TAB_CATEGORIES.CAN_CLOSE:
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    default:
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>';
  }
}



// Export default object
export default {
  showSavedTabsContent,
  showSavedTabs,
  loadSavedTabsCount,
  handleSavedTabSearch,
  renderSavedTabsToContainer
};