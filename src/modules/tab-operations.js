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
import { tabDatabase } from '../../database_v2.js';

/**
 * Close a single tab
 */
export async function closeTab(tab, category) {
  try {
    // Get all duplicate tabs for this URL
    const duplicateIds = state.urlToDuplicateIds[tab.url] || [tab.id];
    
    // Remove from UI state
    const categoryTabs = state.categorizedTabs[category];
    const index = categoryTabs.findIndex(t => t.id === tab.id);
    
    if (index > -1) {
      categoryTabs.splice(index, 1);
      updateState('categorizedTabs', state.categorizedTabs);
    }
    
    // Close all duplicate tabs
    for (const tabId of duplicateIds) {
      try {
        await ChromeAPIService.removeTab(tabId);
      } catch (error) {
        console.error(`Error closing tab ${tabId}:`, error);
      }
    }
    
    // Clean up duplicate tracking
    if (state.urlToDuplicateIds[tab.url]) {
      delete state.urlToDuplicateIds[tab.url];
    }
    
    updateCategorizeBadge();
    await savePopupState();
    
    // If no more tabs, trigger re-display
    const totalTabs = Object.values(state.categorizedTabs)
      .reduce((sum, tabs) => sum + tabs.length, 0);
    
    if (totalTabs === 0) {
      // Trigger display update
      window.dispatchEvent(new CustomEvent('tabsChanged'));
    }
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
    
    const tabs = state.categorizedTabs[category] || [];
    if (tabs.length === 0) {
      showStatus('No tabs to save', 'warning');
      return;
    }
    
    let savedCount = 0;
    let closedCount = 0;
    
    for (const tab of tabs) {
      try {
        // Skip if already saved
        if (!tab.alreadySaved) {
          await tabDatabase.saveTab({
            ...tab,
            savedAt: Date.now(),
            category: category
          });
          savedCount++;
        }
        
        // Close all duplicate tabs
        const duplicateIds = state.urlToDuplicateIds[tab.url] || [tab.id];
        for (const tabId of duplicateIds) {
          try {
            await ChromeAPIService.removeTab(tabId);
            closedCount++;
          } catch (error) {
            console.error(`Error closing tab ${tabId}:`, error);
          }
        }
      } catch (error) {
        console.error('Error saving tab:', error);
      }
    }
    
    // Clear the category
    state.categorizedTabs[category] = [];
    updateState('categorizedTabs', state.categorizedTabs);
    
    updateCategorizeBadge();
    await savePopupState();
    
    showStatus(`Saved ${savedCount} tabs, closed ${closedCount} tabs`, 'success');
    
    // Trigger display update
    window.dispatchEvent(new CustomEvent('tabsChanged'));
  } catch (error) {
    console.error('Error saving and closing category:', error);
    showStatus('Error saving tabs', 'error');
  }
}

/**
 * Save and close all categorized tabs
 */
export async function saveAndCloseAll() {
  try {
    showStatus('Saving all tabs...', 'loading');
    
    let totalSaved = 0;
    let totalClosed = 0;
    
    // Process each category
    for (const category of [TAB_CATEGORIES.IMPORTANT, TAB_CATEGORIES.SAVE_LATER, TAB_CATEGORIES.CAN_CLOSE]) {
      const tabs = state.categorizedTabs[category] || [];
      
      for (const tab of tabs) {
        try {
          // Skip "Can Be Closed" tabs - just close them
          if (category !== TAB_CATEGORIES.CAN_CLOSE && !tab.alreadySaved) {
            await tabDatabase.saveTab({
              ...tab,
              savedAt: Date.now(),
              category: category
            });
            totalSaved++;
          }
          
          // Close all duplicate tabs
          const duplicateIds = state.urlToDuplicateIds[tab.url] || [tab.id];
          for (const tabId of duplicateIds) {
            try {
              await ChromeAPIService.removeTab(tabId);
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
    
    // Clear all categories
    state.categorizedTabs = {
      [TAB_CATEGORIES.CAN_CLOSE]: [],
      [TAB_CATEGORIES.SAVE_LATER]: [],
      [TAB_CATEGORIES.IMPORTANT]: []
    };
    state.urlToDuplicateIds = {};
    
    updateState('categorizedTabs', state.categorizedTabs);
    updateCategorizeBadge();
    await savePopupState();
    
    showStatus(`Saved ${totalSaved} tabs, closed ${totalClosed} tabs`, 'success');
    
    // Trigger display update
    window.dispatchEvent(new CustomEvent('tabsChanged'));
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
    const tabs = state.categorizedTabs[category] || [];
    if (tabs.length === 0) return;
    
    showStatus('Closing tabs...', 'loading');
    
    let closedCount = 0;
    
    for (const tab of tabs) {
      const duplicateIds = state.urlToDuplicateIds[tab.url] || [tab.id];
      for (const tabId of duplicateIds) {
        try {
          await ChromeAPIService.removeTab(tabId);
          closedCount++;
        } catch (error) {
          console.error(`Error closing tab ${tabId}:`, error);
        }
      }
    }
    
    // Clear the category
    state.categorizedTabs[category] = [];
    updateState('categorizedTabs', state.categorizedTabs);
    
    updateCategorizeBadge();
    await savePopupState();
    
    showStatus(`Closed ${closedCount} tabs`, 'success');
    
    // Trigger display update
    window.dispatchEvent(new CustomEvent('tabsChanged'));
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
    const tabs = state.categorizedTabs[category] || [];
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
 * Open all tabs in a group
 */
export async function openAllTabsInGroup(groupName) {
  try {
    // Get all tabs in this group
    const groupTabs = [];
    const allTabs = Object.values(state.categorizedTabs).flat();
    
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
    if (fromCategory === TAB_CATEGORIES.CAN_CLOSE) {
      toCategory = TAB_CATEGORIES.SAVE_LATER;
    } else if (fromCategory === TAB_CATEGORIES.SAVE_LATER) {
      toCategory = TAB_CATEGORIES.IMPORTANT;
    }
  } else if (direction === 'down') {
    if (fromCategory === TAB_CATEGORIES.IMPORTANT) {
      toCategory = TAB_CATEGORIES.SAVE_LATER;
    } else if (fromCategory === TAB_CATEGORIES.SAVE_LATER) {
      toCategory = TAB_CATEGORIES.CAN_CLOSE;
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
export async function deleteSavedTab(tabId) {
  try {
    await tabDatabase.deleteTab(tabId);
    
    showStatus('Tab deleted', 'success');
    
    // Update saved tab count
    const savedTabs = await tabDatabase.getAllSavedTabs();
    updateSavedBadge(savedTabs.length);
    
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
    
    const savedTabs = await tabDatabase.getAllSavedTabs();
    let deletedCount = 0;
    
    for (const tab of savedTabs) {
      const domain = getRootDomain(tab.domain);
      if (domain === groupName) {
        await tabDatabase.deleteTab(tab.id);
        deletedCount++;
      }
    }
    
    showStatus(`Deleted ${deletedCount} tabs`, 'success');
    
    // Update saved tab count
    const remainingTabs = await tabDatabase.getAllSavedTabs();
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
    await ChromeAPIService.createTab({ url: tab.url });
    
    if (deleteAfterRestore) {
      await tabDatabase.deleteTab(tab.id);
      
      // Update saved tab count
      const savedTabs = await tabDatabase.getAllSavedTabs();
      updateSavedBadge(savedTabs.length);
      
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