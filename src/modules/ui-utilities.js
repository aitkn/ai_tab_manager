/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * UI Utilities - helper functions for UI operations
 */

import { DOM_IDS, CSS_CLASSES, DISPLAY, TAB_CATEGORIES } from '../utils/constants.js';
import { $id, classes } from '../utils/dom-helpers.js';
import { state, savePopupState } from './state-manager.js';
import { displayTabs } from './tab-display.js';
import { showSavedTabsContent } from './saved-tabs-manager.js';
import { getCurrentTabs } from './tab-data-source.js';

/**
 * Find first visible tab in viewport
 */
export function findFirstVisibleTab(tabType) {
  let container, tabSelector;
  
  if (tabType === 'categorize') {
    container = $id(DOM_IDS.CURRENT_CONTENT);
    tabSelector = '.tab-item:not(.hidden)';
  } else if (tabType === 'saved') {
    container = $id(DOM_IDS.SAVED_CONTENT);
    tabSelector = '.tab-item:not(.hidden)';
  }
  
  if (!container) return null;
  
  const tabs = container.querySelectorAll(tabSelector);
  const containerRect = container.getBoundingClientRect();
  
  // Find the scroll container's actual content area (accounting for padding)
  const containerStyles = window.getComputedStyle(container);
  const paddingTop = parseFloat(containerStyles.paddingTop) || 0;
  const contentTop = containerRect.top + paddingTop;
  
  let closestTab = null;
  let closestDistance = Infinity;
  
  for (const tab of tabs) {
    const tabRect = tab.getBoundingClientRect();
    
    // Calculate distance from the top of the content area
    const distance = Math.abs(tabRect.top - contentTop);
    
    // Find the tab closest to the top of the viewport
    if (distance < closestDistance && tabRect.bottom > contentTop) {
      closestDistance = distance;
      const urlElement = tab.querySelector('.tab-url');
      if (urlElement) {
        // Store the exact offset from the container top
        const offsetFromTop = tab.offsetTop - container.scrollTop;
        closestTab = {
          url: urlElement.textContent,
          element: tab,
          offsetFromTop: offsetFromTop
        };
      }
    }
  }
  
  return closestTab;
}

/**
 * Scroll to a specific tab by URL
 */
export function scrollToTab(url, tabType, targetOffset = null) {
  let container, tabSelector;
  
  if (tabType === 'categorize') {
    container = $id(DOM_IDS.CURRENT_CONTENT);
    tabSelector = '.tab-item:not(.hidden)';
  } else if (tabType === 'saved') {
    container = $id(DOM_IDS.SAVED_CONTENT);
    tabSelector = '.tab-item:not(.hidden)';
  }
  
  if (!container) {
    console.log('Container not found for tab type:', tabType);
    return;
  }
  
  const tabs = container.querySelectorAll(tabSelector);
  
  for (const tab of tabs) {
    const urlElement = tab.querySelector('.tab-url');
    if (urlElement && urlElement.textContent === url) {
      console.log('Found tab to scroll to:', url);
      
      if (targetOffset !== null) {
        // Use the saved offset
        container.scrollTop = tab.offsetTop - targetOffset;
      } else {
        // Center the tab in view
        const containerHeight = container.clientHeight;
        const tabHeight = tab.offsetHeight;
        const scrollTop = tab.offsetTop - (containerHeight / 2) + (tabHeight / 2);
        container.scrollTop = Math.max(0, scrollTop);
      }
      
      // Highlight briefly
      tab.style.backgroundColor = 'var(--highlight-color)';
      setTimeout(() => {
        tab.style.backgroundColor = '';
      }, 300);
      
      break;
    }
  }
}

/**
 * Handle grouping change for categorize tab
 */
export function onGroupingChange(e) {
  // Wait a moment for any pending scroll to settle
  setTimeout(() => {
    const currentContent = $id(DOM_IDS.CURRENT_CONTENT);
    const currentScrollTop = currentContent ? currentContent.scrollTop : 0;
    
    // Only find first visible tab if not at top
    let firstVisibleTab = null;
    if (currentScrollTop > 0) {
      firstVisibleTab = findFirstVisibleTab('categorize');
      console.log('First visible tab before grouping change:', firstVisibleTab);
    }
    
    const newGrouping = e.target.value;
    state.popupState.groupingSelections.categorize = newGrouping;
    savePopupState();
    displayTabs();
    
    // Only restore scroll if we weren't at the top
    if (firstVisibleTab && currentScrollTop > 0) {
      setTimeout(() => {
        scrollToTab(firstVisibleTab.url, 'categorize');
      }, 150);
    }
  }, 50);
}

/**
 * Toggle all groups expanded/collapsed
 */
export function toggleAllGroups() {
  const container = state.isViewingSaved ? $id(DOM_IDS.SAVED_CONTENT) : $id(DOM_IDS.CURRENT_CONTENT);
  if (!container) return;
  
  const groupSections = container.querySelectorAll('.group-section, .category-section');
  if (groupSections.length === 0) return;
  
  // Check if any group is expanded
  const anyExpanded = Array.from(groupSections).some(section => !section.classList.contains('collapsed'));
  
  // Toggle all groups
  groupSections.forEach(section => {
    const tabsList = section.querySelector('.tabs-list');
    if (tabsList) {
      if (anyExpanded) {
        section.classList.add(CSS_CLASSES.CATEGORY_COLLAPSED);
        tabsList.style.display = DISPLAY.NONE;
      } else {
        section.classList.remove(CSS_CLASSES.CATEGORY_COLLAPSED);
        tabsList.style.display = DISPLAY.BLOCK;
      }
    }
  });
  
  // Update button icon
  const btn = state.isViewingSaved ? 
    $id(DOM_IDS.TOGGLE_SAVED_GROUPS_BTN) : 
    $id(DOM_IDS.TOGGLE_CATEGORIZE_GROUPS_BTN);
    
  if (btn) {
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.innerHTML = anyExpanded 
        ? '<path d="M6 9l6 6 6-6"/>' // Chevron down
        : '<path d="M18 15l-6-6-6 6"/>'; // Chevron up
    }
  }
}

/**
 * Handle grouping change for saved tabs
 */
export function onSavedGroupingChange(e) {
  // Wait a moment for any pending scroll to settle
  setTimeout(() => {
    const savedContent = $id(DOM_IDS.SAVED_CONTENT);
    const currentScrollTop = savedContent ? savedContent.scrollTop : 0;
    
    // Only find first visible tab if not at top
    let firstVisibleTab = null;
    if (currentScrollTop > 0) {
      firstVisibleTab = findFirstVisibleTab('saved');
      console.log('First visible tab before saved grouping change:', firstVisibleTab);
    }
    
    const newGrouping = e.target.value;
    state.popupState.groupingSelections.saved = newGrouping;
    savePopupState();
    showSavedTabsContent(newGrouping);
    
    // Only restore scroll if we weren't at the top
    if (firstVisibleTab && currentScrollTop > 0) {
      setTimeout(() => {
        scrollToTab(firstVisibleTab.url, 'saved');
      }, 150);
    }
  }, 50);
}

/**
 * Create markdown content from tabs
 */
export function createMarkdownContent(tabs, title) {
  let content = `# ${title}\n\n`;
  content += `Generated on: ${new Date().toLocaleString()}\n\n`;
  
  // Group by domain
  const grouped = {};
  tabs.forEach(tab => {
    if (!grouped[tab.domain]) {
      grouped[tab.domain] = [];
    }
    grouped[tab.domain].push(tab);
  });
  
  // Create content
  Object.keys(grouped).sort().forEach(domain => {
    content += `## ${domain}\n\n`;
    grouped[domain].forEach(tab => {
      content += `- [${tab.title}](${tab.url})\n`;
    });
    content += '\n';
  });
  
  return content;
}

/**
 * Download file utility
 */
export function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Update Close All button color based on uncategorized tabs
 */
export async function updateCloseAllButtonColor() {
  // Check both old and new button IDs
  let closeAllBtn = $id(DOM_IDS.CLOSE_ALL_BTN2) || $id(DOM_IDS.SAVE_AND_CLOSE_ALL_BTN);
  if (!closeAllBtn) return;
  
  // Fetch current tabs from background
  const { categorizedTabs } = await getCurrentTabs();
  const hasUncategorized = categorizedTabs[TAB_CATEGORIES.UNCATEGORIZED] && 
                          categorizedTabs[TAB_CATEGORIES.UNCATEGORIZED].length > 0;
  
  if (hasUncategorized) {
    classes.add(closeAllBtn, 'has-uncategorized');
    closeAllBtn.title = 'Close all tabs (WARNING: Includes uncategorized tabs)';
  } else {
    classes.remove(closeAllBtn, 'has-uncategorized');
    closeAllBtn.title = 'Close all categorized tabs';
  }
}

// Export default object
export default {
  findFirstVisibleTab,
  scrollToTab,
  onGroupingChange,
  toggleAllGroups,
  onSavedGroupingChange,
  createMarkdownContent,
  downloadFile,
  updateCloseAllButtonColor
};