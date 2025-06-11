/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Content Manager - Smart tab content management with background updates
 */

import { state } from './state-manager.js';
import { displayTabs } from './tab-display.js';
import { showSavedTabsContent } from './saved-tabs-manager.js';
import { DOM_IDS } from '../utils/constants.js';
import { $id } from '../utils/dom-helpers.js';

// Content state tracking
const contentState = {
  current: {
    loaded: false,
    lastUpdate: 0,
    lastTabCount: 0,
    lastTabHash: '',
    needsUpdate: true
  },
  saved: {
    loaded: false,
    lastUpdate: 0,
    lastSavedCount: 0,
    lastGrouping: 'category',
    lastShowAll: false,
    needsUpdate: true
  },
  settings: {
    loaded: false,
    needsUpdate: false
  }
};

/**
 * Initialize content for all tabs (called once on app start)
 */
export async function initializeAllTabContent() {
  console.log('🚀 CONTENT INIT: Initializing all tab content');
  
  // Initialize current tabs content
  console.log('🔄 CONTENT INIT: Initializing current tab content...');
  await updateCurrentTabContent(true);
  console.log('✅ CONTENT INIT: Current tab content initialized');
  
  // Initialize saved tabs content  
  console.log('🔄 CONTENT INIT: Initializing saved tab content...');
  await updateSavedTabContent(true);
  console.log('✅ CONTENT INIT: Saved tab content initialized');
  
  // Settings tab doesn't need pre-loading (it's static)
  contentState.settings.loaded = true;
  console.log('✅ CONTENT INIT: Settings marked as loaded');
  
  console.log('✅ CONTENT INIT: All tab content initialized');
}

/**
 * Update current tab content (can happen while tab is hidden)
 * @param {boolean} force - Force update even if content seems fresh
 */
export async function updateCurrentTabContent(force = false) {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 CURRENT TAB: updateCurrentTabContent called (force: ${force})`);
    
    // Check if update is needed
    if (!force && !contentState.current.needsUpdate) {
      console.log('⏭️ CURRENT TAB: Content is fresh, skipping update');
      return;
    }
    
    console.log('🔄 CURRENT TAB: Updating current tab content...');
    
    // Get current categorized tabs
    console.log('🔄 CURRENT TAB: Getting current tabs from data source...');
    const { getCurrentTabs } = await import('./tab-data-source.js');
    const { categorizedTabs } = await getCurrentTabs();
    
    console.log('🔄 CURRENT TAB: Retrieved categorized tabs:', {
      categories: Object.keys(categorizedTabs),
      totalTabs: Object.values(categorizedTabs).flat().length,
      uncategorizedCount: categorizedTabs[0]?.length || 0,
      categorizedBreakdown: {
        0: categorizedTabs[0]?.length || 0,
        1: categorizedTabs[1]?.length || 0,
        2: categorizedTabs[2]?.length || 0,
        3: categorizedTabs[3]?.length || 0
      }
    });
    
    // Calculate content hash for change detection
    const tabsArray = Object.values(categorizedTabs).flat();
    const tabCount = tabsArray.length;
    const tabHash = generateTabHash(tabsArray);
    
    console.log('🔄 CURRENT TAB: Content analysis:', { tabCount, tabHash });
    
    // Check if content actually changed
    if (!force && 
        contentState.current.lastTabCount === tabCount && 
        contentState.current.lastTabHash === tabHash) {
      console.log('⏭️ CURRENT TAB: Content unchanged, skipping DOM update');
      contentState.current.needsUpdate = false;
      return;
    }
    
    // Display tabs using legacy system
    console.log('🔄 CURRENT TAB: Calling displayTabs() to render content...');
    await displayTabs();
    
    console.log('✅ CURRENT TAB: displayTabs() completed');
    
    // Update state tracking
    contentState.current.loaded = true;
    contentState.current.lastUpdate = startTime;
    contentState.current.lastTabCount = tabCount;
    contentState.current.lastTabHash = tabHash;
    contentState.current.needsUpdate = false;
    
    console.log(`✅ CURRENT TAB: Content updated in ${Date.now() - startTime}ms`);
    
    // Ensure tabs container is visible when content is loaded
    const tabsContainer = document.getElementById('tabsContainer');
    if (tabsContainer) {
      // Import show function
      const { show } = await import('../utils/dom-helpers.js');
      show(tabsContainer);
      const isVisible = tabsContainer.style.display !== 'none';
      console.log(`🔄 CURRENT TAB: Tabs container visibility fixed: ${isVisible ? 'visible' : 'hidden'}`);
    } else {
      console.error('❌ CURRENT TAB: Tabs container element not found');
    }
    
    // Only update saved content if there were actual changes that affect it
    // (like new categorizations), not just because we viewed the Current tab
    if (contentState.saved.loaded && contentState.saved.needsUpdate) {
      // Check if this update was triggered by a categorization or just tab switching
      const timeSinceLastUpdate = Date.now() - contentState.saved.lastUpdate;
      if (timeSinceLastUpdate < 5000) {
        // If saved content was updated very recently, this is likely just tab switching
        console.log('⏭️ CURRENT TAB: Saved content recently updated, not refreshing to preserve scroll');
        contentState.saved.needsUpdate = false; // Reset the flag
      } else {
        console.log('🔄 CURRENT TAB: Saved content needs update due to changes, updating...');
        await updateSavedTabContent();
      }
    } else if (contentState.saved.loaded) {
      console.log('⏭️ CURRENT TAB: Saved content is fresh, preserving scroll position');
    }
    
  } catch (error) {
    console.error('❌ ContentManager: Error updating current tab content:', error);
  }
}

/**
 * Update saved tab content (can happen while tab is hidden)  
 * @param {boolean} force - Force update even if content seems fresh
 */
export async function updateSavedTabContent(force = false) {
  const startTime = Date.now();
  
  try {
    // Get current saved tab settings
    const savedGroupingSelect = $id(DOM_IDS.SAVED_GROUPING_SELECT);
    const currentGrouping = savedGroupingSelect?.value || 'category';
    const currentShowAll = state.popupState.showAllCategories || false;
    
    // Check if update is needed
    if (!force && 
        !contentState.saved.needsUpdate &&
        contentState.saved.lastGrouping === currentGrouping &&
        contentState.saved.lastShowAll === currentShowAll) {
      console.log('⏭️ ContentManager: Saved tab content is fresh, but checking scroll position...');
      
      // Even if content is fresh, we need to restore scroll position when switching to saved tab
      const savedContent = $id('savedContent');
      if (savedContent && state.popupState.scrollPositions?.saved) {
        const scrollPos = state.popupState.scrollPositions.saved;
        console.log(`📍 ContentManager: Restoring scroll position without content update: ${scrollPos}px`);
        
        // Use requestAnimationFrame to ensure content is rendered
        requestAnimationFrame(() => {
          setTimeout(() => {
            savedContent.scrollTop = scrollPos;
            console.log(`✅ ContentManager: Scroll position restored to ${savedContent.scrollTop}px`);
          }, 10);
        });
      }
      return;
    }
    
    console.log('🔄 ContentManager: Updating saved tab content');
    
    // FORCE legacy system for debugging
    console.log('🔄 ContentManager: FORCING legacy showSavedTabsContent() (flicker-free disabled)');
    await showSavedTabsContent(currentGrouping, currentShowAll);
    
    // Update state tracking
    contentState.saved.loaded = true;
    contentState.saved.lastUpdate = startTime;
    contentState.saved.lastGrouping = currentGrouping;
    contentState.saved.lastShowAll = currentShowAll;
    contentState.saved.needsUpdate = false;
    
    console.log(`✅ ContentManager: Saved tab updated in ${Date.now() - startTime}ms`);
    
  } catch (error) {
    console.error('❌ ContentManager: Error updating saved tab content:', error);
  }
}

/**
 * Mark content as needing update (called when data changes)
 * @param {string} tabType - 'current', 'saved', or 'all'
 */
export function markContentDirty(tabType = 'all') {
  console.log(`🏷️ ContentManager: Marking ${tabType} content as dirty`);
  
  if (tabType === 'all' || tabType === 'current') {
    contentState.current.needsUpdate = true;
    console.log('🏷️ ContentManager: Current tab marked as needing update');
  }
  
  if (tabType === 'all' || tabType === 'saved') {
    contentState.saved.needsUpdate = true;
    console.log('🏷️ ContentManager: Saved tab marked as needing update');
  }
}

/**
 * Update content for currently hidden tabs (background sync)
 * This is called when we know data has changed but want to update hidden tabs
 */
export async function syncHiddenTabContent() {
  const activeTab = state.popupState.activeTab;
  
  console.log(`🔄 ContentManager: Syncing hidden tabs (active: ${activeTab})`);
  
  // Update current tab content if it's not active
  if (activeTab !== 'categorize' && contentState.current.needsUpdate) {
    await updateCurrentTabContent();
  }
  
  // Update saved tab content if it's not active  
  if (activeTab !== 'saved' && contentState.saved.needsUpdate) {
    await updateSavedTabContent();
  }
}

/**
 * Get content freshness info for debugging
 */
export function getContentStatus() {
  return {
    current: {
      loaded: contentState.current.loaded,
      needsUpdate: contentState.current.needsUpdate,
      lastUpdate: new Date(contentState.current.lastUpdate).toLocaleTimeString(),
      tabCount: contentState.current.lastTabCount
    },
    saved: {
      loaded: contentState.saved.loaded,
      needsUpdate: contentState.saved.needsUpdate,
      lastUpdate: new Date(contentState.saved.lastUpdate).toLocaleTimeString(),
      grouping: contentState.saved.lastGrouping
    },
    settings: {
      loaded: contentState.settings.loaded
    }
  };
}

/**
 * Generate a simple hash of tab data for change detection
 * @param {Array} tabs - Array of tab objects
 * @returns {string} Hash string
 */
function generateTabHash(tabs) {
  // Create a simple hash based on tab URLs, titles, and duplicate counts
  const hashString = tabs
    .map(tab => `${tab.url}:${tab.title}:${tab.category || 0}:${tab.duplicateCount || 1}`)
    .sort()
    .join('|');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    const char = hashString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return hash.toString();
}

// Export content state for debugging
export { contentState };