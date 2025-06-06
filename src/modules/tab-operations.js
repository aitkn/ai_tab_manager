/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Tab Operations Module - handles all tab CRUD operations
 */

import { TAB_CATEGORIES, STATUS_MESSAGES, LIMITS } from '../utils/constants.js';
import { getRootDomain } from '../utils/helpers.js';
import ChromeAPIService from '../services/ChromeAPIService.js';
import { state, updateState, savePopupState } from './state-manager.js';
import { showStatus, updateCategorizeBadge, updateSavedBadge } from './ui-manager.js';
import { moveTabToCategory } from './categorization-service.js';
// Import database - using window.window.tabDatabase since it's a global

/**
 * Close a single tab
 */
export async function closeTab(tab, category) {
  try {
    // Get the latest tab data from background
    const { getCurrentTabs } = await import('./tab-data-source.js');
    const { categorizedTabs } = await getCurrentTabs();
    const categoryTabs = categorizedTabs[category] || [];
    const currentTab = categoryTabs.find(t => t.id === tab.id);
    
    // Use current tab data if available, otherwise fall back to passed tab
    const tabToClose = currentTab || tab;
    
    // Get all duplicate tabs - check both sources
    const duplicateIds = tabToClose.duplicateIds || [tabToClose.id];
    
    console.log('Closing tab with duplicates:', tabToClose.url, 'duplicateIds:', duplicateIds, 'from currentTab:', !!currentTab);
    
    // Close all duplicate tabs
    for (const tabId of duplicateIds) {
      try {
        await ChromeAPIService.removeTabs(tabId);
      } catch (error) {
        console.error(`Error closing tab ${tabId}:`, error);
      }
    }
    
    // Notify background to update its state
    await chrome.runtime.sendMessage({
      action: 'tabClosed',
      data: {
        tabId: tab.id,
        category: category
      }
    });
    
    updateCategorizeBadge();
    
    // Trigger display update
    const { displayTabs } = await import('./tab-display.js');
    await displayTabs();
    
  } catch (error) {
    console.error('Error closing tab:', error);
    showStatus('Error closing tab', 'error');
  }
}

/**
 * Save and close all tabs in a category
 */
export async function saveAndCloseCategory(category) {
  try {
    showStatus('Saving tabs...', 'loading');
    
    // Get current tabs from background
    const { getCurrentTabs } = await import('./tab-data-source.js');
    const { categorizedTabs, urlToDuplicateIds } = await getCurrentTabs();
    const tabs = categorizedTabs[category] || [];
    
    if (tabs.length === 0) {
      showStatus('No tabs to save', 'warning');
      return;
    }
    
    let savedCount = 0;
    let closedCount = 0;
    
    // Save all tabs in category at once
    const tabsToSave = {
      [category]: tabs.filter(tab => !tab.alreadySaved)
    };
    
    if (tabsToSave[category].length > 0) {
      await window.tabDatabase.saveCategorizedTabs(tabsToSave);
      savedCount = tabsToSave[category].length;
    }
    
    // Close all tabs in category
    for (const tab of tabs) {
      try {
        // Close all duplicate tabs
        const duplicateIds = urlToDuplicateIds[tab.url] || [tab.id];
        for (const tabId of duplicateIds) {
          try {
            await ChromeAPIService.removeTabs(tabId);
            closedCount++;
          } catch (error) {
            console.error(`Error closing tab ${tabId}:`, error);
          }
        }
      } catch (error) {
        console.error('Error processing tab:', error);
      }
    }
    
    // Notify background to clear the category
    await chrome.runtime.sendMessage({
      action: 'clearCategory',
      data: { category }
    });
    
    updateCategorizeBadge();
    
    showStatus(`Saved ${savedCount} tabs, closed ${closedCount} tabs`, 'success');
    
    // Trigger display update
    const { displayTabs } = await import('./tab-display.js');
    await displayTabs();
  } catch (error) {
    console.error('Error saving and closing category:', error);
    showStatus('Error saving tabs', 'error');
  }
}

/**
 * Close all categorized tabs (renamed from saveAndCloseAll)
 */
export async function saveAndCloseAll() {
  try {
    showStatus('Closing all tabs...', 'loading');
    
    let totalClosed = 0;
    
    // Get current tabs from background
    const { getCurrentTabs } = await import('./tab-data-source.js');
    const { categorizedTabs, urlToDuplicateIds } = await getCurrentTabs();
    
    // Check if we're about to close all tabs in the current window
    const currentWindow = await ChromeAPIService.getCurrentWindow();
    const currentWindowTabs = await ChromeAPIService.queryTabs({ windowId: currentWindow.id });
    
    // Collect all tab IDs we're about to close (including uncategorized)
    const tabIdsToClose = new Set();
    for (const category of [TAB_CATEGORIES.UNCATEGORIZED, TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.IMPORTANT]) {
      const tabs = categorizedTabs[category] || [];
      for (const tab of tabs) {
        const duplicateIds = urlToDuplicateIds[tab.url] || [tab.id];
        duplicateIds.forEach(id => tabIdsToClose.add(id));
      }
    }
    
    // Check if we're closing all tabs in the current window
    const currentWindowTabIds = currentWindowTabs.map(t => t.id);
    const closingAllCurrentWindowTabs = currentWindowTabIds.every(id => tabIdsToClose.has(id));
    
    // If we're closing all tabs in current window, create a new empty tab first
    if (closingAllCurrentWindowTabs && currentWindowTabs.length > 0) {
      console.log('Creating new tab to keep window open');
      await ChromeAPIService.createTab({ windowId: currentWindow.id });
    }
    
    // Close all tabs
    for (const category of [TAB_CATEGORIES.IMPORTANT, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.CAN_CLOSE]) {
      const tabs = categorizedTabs[category] || [];
      
      for (const tab of tabs) {
        try {
          // Close all duplicate tabs
          const duplicateIds = urlToDuplicateIds[tab.url] || [tab.id];
          for (const tabId of duplicateIds) {
            try {
              await ChromeAPIService.removeTabs(tabId);
              totalClosed++;
            } catch (error) {
              console.error(`Error closing tab ${tabId}:`, error);
            }
          }
        } catch (error) {
          console.error('Error processing tab:', error);
        }
      }
    }
    
    // Notify background to clear all categories
    await chrome.runtime.sendMessage({
      action: 'clearAllCategories'
    });
    
    updateCategorizeBadge();
    
    showStatus(`Closed ${totalClosed} tabs`, 'success');
    
    // Trigger display update
    const { displayTabs } = await import('./tab-display.js');
    await displayTabs();
  } catch (error) {
    console.error('Error saving and closing all tabs:', error);
    showStatus('Error saving tabs', 'error');
  }
}

/**
 * Close all tabs in a category without saving
 */
export async function closeAllInCategory(category) {
  try {
    // Get current tabs from background
    const { getCurrentTabs } = await import('./tab-data-source.js');
    const { categorizedTabs, urlToDuplicateIds } = await getCurrentTabs();
    const tabs = categorizedTabs[category] || [];
    
    if (tabs.length === 0) return;
    
    showStatus('Closing tabs...', 'loading');
    
    let closedCount = 0;
    
    for (const tab of tabs) {
      const duplicateIds = urlToDuplicateIds[tab.url] || [tab.id];
      for (const tabId of duplicateIds) {
        try {
          await ChromeAPIService.removeTabs(tabId);
          closedCount++;
        } catch (error) {
          console.error(`Error closing tab ${tabId}:`, error);
        }
      }
    }
    
    // Notify background to clear the category
    await chrome.runtime.sendMessage({
      action: 'clearCategory',
      data: { category }
    });
    
    updateCategorizeBadge();
    
    showStatus(`Closed ${closedCount} tabs`, 'success');
    
    // Trigger display update
    const { displayTabs } = await import('./tab-display.js');
    await displayTabs();
  } catch (error) {
    console.error('Error closing category:', error);
    showStatus('Error closing tabs', 'error');
  }
}

/**
 * Open all tabs in a category
 */
export async function openAllInCategory(category) {
  try {
    // Get current tabs from background
    const { getCurrentTabs } = await import('./tab-data-source.js');
    const { categorizedTabs } = await getCurrentTabs();
    const tabs = categorizedTabs[category] || [];
    
    if (tabs.length === 0) return;
    
    const maxTabs = state.settings.maxTabsToOpen || LIMITS.MAX_TABS_DEFAULT;
    
    if (tabs.length > maxTabs) {
      if (!confirm(`This will open ${tabs.length} tabs. Continue?`)) {
        return;
      }
    }
    
    showStatus('Opening tabs...', 'loading');
    
    for (const tab of tabs.slice(0, maxTabs)) {
      try {
        await ChromeAPIService.createTab({ url: tab.url });
      } catch (error) {
        console.error('Error opening tab:', error);
      }
    }
    
    showStatus(`Opened ${Math.min(tabs.length, maxTabs)} tabs`, 'success');
  } catch (error) {
    console.error('Error opening tabs:', error);
    showStatus('Error opening tabs', 'error');
  }
}

/**
 * Close all tabs in a group
 */
export async function closeTabsInGroup(tabs) {
  try {
    if (!tabs || tabs.length === 0) return;
    
    showStatus('Closing tabs...', 'loading');
    
    let closedCount = 0;
    const allTabIds = [];
    
    // Collect all tab IDs including duplicates
    for (const tab of tabs) {
      if (tab.duplicateIds && tab.duplicateIds.length > 0) {
        // If tab has duplicate IDs, use those
        allTabIds.push(...tab.duplicateIds);
      } else {
        // Otherwise just use the tab ID
        allTabIds.push(tab.id);
      }
    }
    
    // Close all tabs
    for (const tabId of allTabIds) {
      try {
        await ChromeAPIService.removeTabs(tabId);
        closedCount++;
      } catch (error) {
        console.error(`Error closing tab ${tabId}:`, error);
      }
    }
    
    // Notify background about closed tabs
    for (const tab of tabs) {
      await chrome.runtime.sendMessage({
        action: 'tabClosed',
        data: {
          tabId: tab.id,
          category: tab.category
        }
      });
    }
    
    updateCategorizeBadge();
    
    showStatus(`Closed ${closedCount} tabs`, 'success');
    
    // Trigger display update
    const { displayTabs } = await import('./tab-display.js');
    await displayTabs();
    
  } catch (error) {
    console.error('Error closing group tabs:', error);
    showStatus('Error closing tabs', 'error');
  }
}

/**
 * Save and close all tabs in a group
 */
export async function saveAndCloseTabsInGroup(tabs) {
  try {
    if (!tabs || tabs.length === 0) return;
    
    showStatus('Saving tabs...', 'loading');
    
    let savedCount = 0;
    let closedCount = 0;
    const allTabIds = [];
    
    // Group tabs by category for saving
    const tabsByCategory = {};
    
    for (const tab of tabs) {
      if (!tab.alreadySaved) {
        const tabCategory = tab.category || TAB_CATEGORIES.SAVE_LATER;
        if (!tabsByCategory[tabCategory]) {
          tabsByCategory[tabCategory] = [];
        }
        tabsByCategory[tabCategory].push(tab);
        savedCount++;
      }
      
      // Collect all tab IDs including duplicates
      if (tab.duplicateIds && tab.duplicateIds.length > 0) {
        allTabIds.push(...tab.duplicateIds);
      } else {
        allTabIds.push(tab.id);
      }
    }
    
    // Save all tabs at once
    if (savedCount > 0) {
      await window.tabDatabase.saveCategorizedTabs(tabsByCategory);
    }
    
    // Close all tabs
    for (const tabId of allTabIds) {
      try {
        await ChromeAPIService.removeTabs(tabId);
        closedCount++;
      } catch (error) {
        console.error(`Error closing tab ${tabId}:`, error);
      }
    }
    
    // Notify background about closed tabs
    for (const tab of tabs) {
      await chrome.runtime.sendMessage({
        action: 'tabClosed',
        data: {
          tabId: tab.id,
          category: tab.category
        }
      });
    }
    
    updateCategorizeBadge();
    
    showStatus(`Saved ${savedCount} tabs, closed ${closedCount} tabs`, 'success');
    
    // Update saved tabs badge
    updateSavedBadge();
    
    // Trigger display update
    const { displayTabs } = await import('./tab-display.js');
    await displayTabs();
    
  } catch (error) {
    console.error('Error saving group tabs:', error);
    showStatus('Error saving tabs', 'error');
  }
}

/**
 * Open all tabs in a group
 */
export async function openAllTabsInGroup(groupName) {
  try {
    // Get current tabs from background
    const { getCurrentTabs } = await import('./tab-data-source.js');
    const { categorizedTabs } = await getCurrentTabs();
    
    // Get all tabs in this group
    const groupTabs = [];
    const allTabs = Object.values(categorizedTabs).flat();
    
    allTabs.forEach(tab => {
      const domain = getRootDomain(tab.domain);
      if (domain === groupName) {
        groupTabs.push(tab);
      }
    });
    
    if (groupTabs.length === 0) return;
    
    const maxTabs = state.settings.maxTabsToOpen || LIMITS.MAX_TABS_DEFAULT;
    
    if (groupTabs.length > maxTabs) {
      if (!confirm(`This will open ${groupTabs.length} tabs. Continue?`)) {
        return;
      }
    }
    
    showStatus('Opening tabs...', 'loading');
    
    for (const tab of groupTabs.slice(0, maxTabs)) {
      try {
        await ChromeAPIService.createTab({ url: tab.url });
      } catch (error) {
        console.error('Error opening tab:', error);
      }
    }
    
    showStatus(`Opened ${Math.min(groupTabs.length, maxTabs)} tabs`, 'success');
  } catch (error) {
    console.error('Error opening group tabs:', error);
    showStatus('Error opening tabs', 'error');
  }
}

/**
 * Move tab between categories
 */
export function moveTab(tab, fromCategory, direction) {
  let toCategory = fromCategory;
  
  if (direction === 'up') {
    if (fromCategory === TAB_CATEGORIES.UNCATEGORIZED) {
      toCategory = TAB_CATEGORIES.CAN_CLOSE;
    } else if (fromCategory === TAB_CATEGORIES.CAN_CLOSE) {
      toCategory = TAB_CATEGORIES.SAVE_LATER;
    } else if (fromCategory === TAB_CATEGORIES.SAVE_LATER) {
      toCategory = TAB_CATEGORIES.IMPORTANT;
    }
  } else if (direction === 'down') {
    if (fromCategory === TAB_CATEGORIES.IMPORTANT) {
      toCategory = TAB_CATEGORIES.SAVE_LATER;
    } else if (fromCategory === TAB_CATEGORIES.SAVE_LATER) {
      toCategory = TAB_CATEGORIES.CAN_CLOSE;
    } else if (fromCategory === TAB_CATEGORIES.CAN_CLOSE) {
      toCategory = TAB_CATEGORIES.UNCATEGORIZED;
    }
  }
  
  if (toCategory !== fromCategory) {
    moveTabToCategory(tab, fromCategory, toCategory);
    
    // Trigger display update
    window.dispatchEvent(new CustomEvent('tabsChanged'));
  }
}

/**
 * Delete a saved tab
 */
export async function deleteSavedTab(urlId) {
  try {
    await window.tabDatabase.deleteUrl(urlId);
    
    showStatus('Tab deleted', 'success');
    
    // Update saved tab count
    const savedUrls = await window.tabDatabase.getSavedUrls([2, 3]);
    updateSavedBadge(savedUrls.length);
    
    // Trigger display update
    window.dispatchEvent(new CustomEvent('savedTabsChanged'));
  } catch (error) {
    console.error('Error deleting saved tab:', error);
    showStatus('Error deleting tab', 'error');
  }
}

/**
 * Delete all tabs in a group (for saved tabs)
 */
export async function deleteTabsInGroup(groupName) {
  try {
    if (!confirm(`Delete all tabs in "${groupName}"?`)) {
      return;
    }
    
    showStatus('Deleting tabs...', 'loading');
    
    const savedTabs = await window.tabDatabase.getAllSavedTabs();
    let deletedCount = 0;
    
    for (const tab of savedTabs) {
      const domain = getRootDomain(tab.domain);
      if (domain === groupName) {
        await window.tabDatabase.deleteTab(tab.id);
        deletedCount++;
      }
    }
    
    showStatus(`Deleted ${deletedCount} tabs`, 'success');
    
    // Update saved tab count
    const remainingTabs = await window.tabDatabase.getAllSavedTabs();
    updateSavedBadge(remainingTabs.length);
    
    // Trigger display update
    window.dispatchEvent(new CustomEvent('savedTabsChanged'));
  } catch (error) {
    console.error('Error deleting group:', error);
    showStatus('Error deleting tabs', 'error');
  }
}

/**
 * Restore a saved tab (open and optionally delete)
 */
export async function restoreSavedTab(tab, deleteAfterRestore = false) {
  try {
    const newTab = await ChromeAPIService.createTab({ url: tab.url });
    
    // Record open event in database
    if (window.tabDatabase) {
      const urlId = await window.tabDatabase.getOrCreateUrl(tab, tab.category);
      await window.tabDatabase.recordOpenEvent(urlId, newTab.id);
    }
    
    if (deleteAfterRestore) {
      await window.tabDatabase.deleteUrl(tab.id);
      
      // Update saved tab count
      const savedUrls = await window.tabDatabase.getSavedUrls([2, 3]);
      updateSavedBadge(savedUrls.length);
      
      showStatus('Tab restored and removed from saved', 'success');
    } else {
      showStatus('Tab restored', 'success');
    }
    
    // Trigger display update if deleted
    if (deleteAfterRestore) {
      window.dispatchEvent(new CustomEvent('savedTabsChanged'));
    }
  } catch (error) {
    console.error('Error restoring tab:', error);
    showStatus('Error restoring tab', 'error');
  }
}

/**
 * Check for duplicate tabs and mark them
 */
export function markDuplicateTabs(tabs) {
  const urlCounts = {};
  
  // Count occurrences of each URL
  tabs.forEach(tab => {
    if (!urlCounts[tab.url]) {
      urlCounts[tab.url] = [];
    }
    urlCounts[tab.url].push(tab);
  });
  
  // Mark duplicates
  Object.entries(urlCounts).forEach(([url, duplicates]) => {
    if (duplicates.length > 1) {
      duplicates.forEach(tab => {
        tab.duplicateCount = duplicates.length;
      });
    }
  });
  
  return tabs;
}

// Export default object
export default {
  closeTab,
  saveAndCloseCategory,
  saveAndCloseAll,
  closeAllInCategory,
  openAllInCategory,
  openAllTabsInGroup,
  moveTab,
  deleteSavedTab,
  deleteTabsInGroup,
  restoreSavedTab,
  markDuplicateTabs
};