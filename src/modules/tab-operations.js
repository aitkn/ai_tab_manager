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

// ========== Helper Functions ==========

/**
 * Get current window information and tabs
 * @returns {Promise<{window: Object, tabs: Array, tabIds: Set}>}
 */
async function getCurrentWindowInfo() {
  const currentWindow = await ChromeAPIService.getCurrentWindow();
  const currentWindowTabs = await ChromeAPIService.queryTabs({ windowId: currentWindow.id });
  const currentWindowTabIds = new Set(currentWindowTabs.map(t => t.id));
  
  return {
    window: currentWindow,
    tabs: currentWindowTabs,
    tabIds: currentWindowTabIds
  };
}

/**
 * Separate tab IDs by window (current vs other)
 * @param {Array} tabIds - Array of tab IDs to separate
 * @param {Set} currentWindowTabIds - Set of current window tab IDs
 * @returns {{current: Array, other: Array}}
 */
function separateTabsByWindow(tabIds, currentWindowTabIds) {
  const current = [];
  const other = [];
  
  for (const tabId of tabIds) {
    if (currentWindowTabIds.has(tabId)) {
      current.push(tabId);
    } else {
      other.push(tabId);
    }
  }
  
  return { current, other };
}

/**
 * Check if closing tabs would close all tabs in current window
 * @param {Set} currentWindowTabIds - Set of all tab IDs in current window
 * @param {Array} tabsToClose - Array of tab IDs we want to close
 * @returns {boolean}
 */
function willCloseAllCurrentWindowTabs(currentWindowTabIds, tabsToClose) {
  if (currentWindowTabIds.size === 0) return false;
  
  // Check if every tab in current window is in the close list
  return Array.from(currentWindowTabIds).every(id => tabsToClose.includes(id));
}

/**
 * Close tabs with error handling and counting
 * @param {Array} tabIds - Array of tab IDs to close
 * @returns {Promise<number>} Number of successfully closed tabs
 */
async function closeTabsWithTracking(tabIds) {
  let closedCount = 0;
  
  for (const tabId of tabIds) {
    try {
      await ChromeAPIService.removeTabs(tabId);
      closedCount++;
    } catch (error) {
      console.error(`Error closing tab ${tabId}:`, error);
    }
  }
  
  return closedCount;
}

/**
 * Get all duplicate IDs for a tab
 * @param {Object} tab - Tab object
 * @param {Object} urlToDuplicateIds - URL to duplicate IDs mapping
 * @returns {Array} Array of tab IDs including duplicates
 */
function getTabIdsWithDuplicates(tab, urlToDuplicateIds = {}) {
  if (tab.duplicateIds && tab.duplicateIds.length > 0) {
    return tab.duplicateIds;
  }
  return urlToDuplicateIds[tab.url] || [tab.id];
}

/**
 * Collect all tab IDs from tabs array, including duplicates
 * @param {Array} tabs - Array of tab objects
 * @param {Object} urlToDuplicateIds - URL to duplicate IDs mapping
 * @returns {Array} All tab IDs including duplicates
 */
function collectAllTabIds(tabs, urlToDuplicateIds = {}) {
  const allTabIds = [];
  
  for (const tab of tabs) {
    const tabIds = getTabIdsWithDuplicates(tab, urlToDuplicateIds);
    allTabIds.push(...tabIds);
  }
  
  return allTabIds;
}

/**
 * Smart tab opening that keeps popup open
 * Opens in another window or creates new window to prevent popup from closing
 * @param {string} url - URL to open
 * @param {boolean} focusWindow - Whether to focus the window
 * @returns {Promise<Object>} Created tab
 */
async function openTabKeepingPopupOpen(url, focusWindow = true) {
  // Get all windows
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  const currentWindow = await chrome.windows.getCurrent();
  
  // Find a window that's not the current one
  const otherWindow = windows.find(w => w.id !== currentWindow.id);
  
  if (otherWindow) {
    // Open in the other window
    const tab = await ChromeAPIService.createTab({ 
      url: url,
      active: true,
      windowId: otherWindow.id
    });
    
    if (focusWindow) {
      await chrome.windows.update(otherWindow.id, { focused: true });
    }
    
    return tab;
  } else {
    // No other window, create a new one
    const newWindow = await chrome.windows.create({
      url: url,
      focused: focusWindow
    });
    return newWindow.tabs[0];
  }
}

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
    
    // Save unsaved tabs
    const tabsToSave = {
      [category]: tabs.filter(tab => !tab.alreadySaved)
    };
    
    let savedCount = 0;
    if (tabsToSave[category].length > 0) {
      await window.tabDatabase.saveCategorizedTabs(tabsToSave);
      savedCount = tabsToSave[category].length;
    }
    
    // Get current window info
    const windowInfo = await getCurrentWindowInfo();
    
    // Collect all tab IDs including duplicates
    const allTabIds = collectAllTabIds(tabs, urlToDuplicateIds);
    
    // Separate tabs by window
    const { current: currentWindowTabsToClose, other: otherWindowTabsToClose } = 
      separateTabsByWindow(allTabIds, windowInfo.tabIds);
    
    // Check if we're closing all tabs in current window
    if (willCloseAllCurrentWindowTabs(windowInfo.tabIds, currentWindowTabsToClose)) {
      console.log('Creating new tab to keep window open');
      await ChromeAPIService.createTab({ windowId: windowInfo.window.id });
    }
    
    // Close tabs in other windows first, then current window
    const otherClosed = await closeTabsWithTracking(otherWindowTabsToClose);
    const currentClosed = await closeTabsWithTracking(currentWindowTabsToClose);
    const closedCount = otherClosed + currentClosed;
    
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
    
    // Get current tabs from background
    const { getCurrentTabs } = await import('./tab-data-source.js');
    const { categorizedTabs, urlToDuplicateIds } = await getCurrentTabs();
    
    // Get current window info
    const windowInfo = await getCurrentWindowInfo();
    
    // Collect all tab IDs we're about to close (including uncategorized)
    const allTabIds = [];
    for (const category of [TAB_CATEGORIES.UNCATEGORIZED, TAB_CATEGORIES.CAN_CLOSE, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.IMPORTANT]) {
      const tabs = categorizedTabs[category] || [];
      allTabIds.push(...collectAllTabIds(tabs, urlToDuplicateIds));
    }
    
    // Remove duplicates
    const uniqueTabIds = [...new Set(allTabIds)];
    
    // Separate tabs by window
    const { current: currentWindowTabsToClose, other: otherWindowTabsToClose } = 
      separateTabsByWindow(uniqueTabIds, windowInfo.tabIds);
    
    // Check if we're closing all tabs in the current window
    if (willCloseAllCurrentWindowTabs(windowInfo.tabIds, currentWindowTabsToClose)) {
      console.log('Creating new tab to keep window open');
      await ChromeAPIService.createTab({ windowId: windowInfo.window.id });
    }
    
    console.log('Tabs to close:', {
      total: uniqueTabIds.length,
      otherWindows: otherWindowTabsToClose.length,
      currentWindow: currentWindowTabsToClose.length
    });
    
    // Close tabs in other windows first, then current window
    const otherClosed = await closeTabsWithTracking(otherWindowTabsToClose);
    const currentClosed = await closeTabsWithTracking(currentWindowTabsToClose);
    const totalClosed = otherClosed + currentClosed;
    
    // Notify background to clear all categories
    await chrome.runtime.sendMessage({
      action: 'clearAllCategories'
    });
    
    // Add small delay to ensure background has processed the changes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await updateCategorizeBadge();
    
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
    
    // Get current window info
    const windowInfo = await getCurrentWindowInfo();
    
    // Collect all tab IDs including duplicates
    const allTabIds = collectAllTabIds(tabs, urlToDuplicateIds);
    
    // Separate tabs by window
    const { current: currentWindowTabsToClose, other: otherWindowTabsToClose } = 
      separateTabsByWindow(allTabIds, windowInfo.tabIds);
    
    // Check if we're closing all tabs in current window
    if (willCloseAllCurrentWindowTabs(windowInfo.tabIds, currentWindowTabsToClose)) {
      console.log('Creating new tab to keep window open');
      await ChromeAPIService.createTab({ windowId: windowInfo.window.id });
    }
    
    // Close tabs in other windows first, then current window
    const otherClosed = await closeTabsWithTracking(otherWindowTabsToClose);
    const currentClosed = await closeTabsWithTracking(currentWindowTabsToClose);
    const closedCount = otherClosed + currentClosed;
    
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
        await openTabKeepingPopupOpen(tab.url, false); // Don't focus each individual tab
      } catch (error) {
        console.error('Error opening tab:', error);
      }
    }
    
    // Focus the window at the end
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    const currentWindow = await chrome.windows.getCurrent();
    const otherWindow = windows.find(w => w.id !== currentWindow.id);
    if (otherWindow) {
      await chrome.windows.update(otherWindow.id, { focused: true });
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
    
    // Get current window info
    const windowInfo = await getCurrentWindowInfo();
    
    // Collect all tab IDs including duplicates
    const allTabIds = collectAllTabIds(tabs);
    
    // Separate tabs by window
    const { current: currentWindowTabsToClose, other: otherWindowTabsToClose } = 
      separateTabsByWindow(allTabIds, windowInfo.tabIds);
    
    // Check if we're closing all tabs in current window
    if (willCloseAllCurrentWindowTabs(windowInfo.tabIds, currentWindowTabsToClose)) {
      console.log('Creating new tab to keep window open');
      await ChromeAPIService.createTab({ windowId: windowInfo.window.id });
    }
    
    // Close tabs in other windows first, then current window
    const otherClosed = await closeTabsWithTracking(otherWindowTabsToClose);
    const currentClosed = await closeTabsWithTracking(currentWindowTabsToClose);
    const closedCount = otherClosed + currentClosed;
    
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
    
    // Get current window info
    const windowInfo = await getCurrentWindowInfo();
    
    // Group tabs by category for saving
    const tabsByCategory = {};
    let savedCount = 0;
    
    for (const tab of tabs) {
      if (!tab.alreadySaved) {
        const tabCategory = tab.category || TAB_CATEGORIES.SAVE_LATER;
        if (!tabsByCategory[tabCategory]) {
          tabsByCategory[tabCategory] = [];
        }
        tabsByCategory[tabCategory].push(tab);
        savedCount++;
      }
    }
    
    // Save all tabs at once
    if (savedCount > 0) {
      await window.tabDatabase.saveCategorizedTabs(tabsByCategory);
    }
    
    // Collect all tab IDs including duplicates
    const allTabIds = collectAllTabIds(tabs);
    
    // Separate tabs by window
    const { current: currentWindowTabsToClose, other: otherWindowTabsToClose } = 
      separateTabsByWindow(allTabIds, windowInfo.tabIds);
    
    // Check if we're closing all tabs in current window
    if (willCloseAllCurrentWindowTabs(windowInfo.tabIds, currentWindowTabsToClose)) {
      console.log('Creating new tab to keep window open');
      await ChromeAPIService.createTab({ windowId: windowInfo.window.id });
    }
    
    // Close tabs in other windows first, then current window
    const otherClosed = await closeTabsWithTracking(otherWindowTabsToClose);
    const currentClosed = await closeTabsWithTracking(currentWindowTabsToClose);
    const closedCount = otherClosed + currentClosed;
    
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
        await openTabKeepingPopupOpen(tab.url, false); // Don't focus each individual tab
      } catch (error) {
        console.error('Error opening tab:', error);
      }
    }
    
    // Focus the window at the end
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    const currentWindow = await chrome.windows.getCurrent();
    const otherWindow = windows.find(w => w.id !== currentWindow.id);
    if (otherWindow) {
      await chrome.windows.update(otherWindow.id, { focused: true });
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
    const newTab = await openTabKeepingPopupOpen(tab.url);
    
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