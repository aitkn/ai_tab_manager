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
import { createCategorySection as createUnifiedCategorySection, createGroupSection as createUnifiedGroupSection } from './unified-group-renderer.js';
import { openSavedTabs, deleteTabsInGroup, deleteTabsInCategory } from './tab-operations.js';
import { preloadFavicons } from '../utils/favicon-loader.js';
import { unifiedSearchService } from '../services/UnifiedSearchService.js';
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
      // Create category sections directly in saved content using unified renderer
      for (const category of [TAB_CATEGORIES.IMPORTANT, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.CAN_CLOSE]) {
        const tabs = savedTabsByCategory[category] || [];
        if (tabs.length > 0) {
          const section = await createUnifiedCategorySection(category, tabs, true);
          if (section) {
            savedContent.appendChild(section);
          }
        }
      }
      
      // Show empty state if no saved tabs
      if (allSavedTabs.length === 0) {
        const emptyMessage = createEmptyStateMessage();
        savedContent.appendChild(emptyMessage);
      }
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
 * Handle saved tab search using unified search service
 */
export function handleSavedTabSearch(searchQuery) {
  const savedContent = $id(DOM_IDS.SAVED_CONTENT);
  if (!savedContent) return;
  
  // Update unified search service context
  unifiedSearchService.setSearchQuery(searchQuery);
  unifiedSearchService.setContext('saved');
  
  const tabElements = savedContent.querySelectorAll('.tab-item');
  
  // Use unified search service for filtering
  const results = unifiedSearchService.filterTabs(tabElements, savedContent, true, {
    groupingType: getSavedGroupingType(),
    updateCounts: true,
    hideEmptyGroups: true,
    smartShowMore: true
  });
  
  return results;
}

/**
 * Get current saved tabs grouping type
 */
function getSavedGroupingType() {
  const savedGroupingSelect = $id(DOM_IDS.SAVED_GROUPING_SELECT);
  return savedGroupingSelect ? savedGroupingSelect.value : 'category';
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
        const categorySection = await createUnifiedCategorySection(parseInt(category), categoryTabs, true);
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
        const groupSection = await createUnifiedGroupSection(groupName, groupTabs, groupingType, true);
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




// Export default object
export default {
  showSavedTabsContent,
  showSavedTabs,
  loadSavedTabsCount,
  handleSavedTabSearch,
  renderSavedTabsToContainer
};