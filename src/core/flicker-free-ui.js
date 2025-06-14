/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Flicker-Free UI System - Main orchestrator for zero-flicker user interface
 */

import virtualContentManager from './virtual-content-manager.js';
import uiStateManager from './ui-state-manager.js';
import backgroundRenderer from './background-renderer.js';
import { DOM_IDS } from '../utils/constants.js';
import { $id } from '../utils/dom-helpers.js';

/**
 * Flicker-Free UI System
 * 
 * Main orchestrator that provides:
 * - Zero-flicker tab switching
 * - Complete state preservation
 * - Background rendering with morphdom
 * - Optimal performance through smart caching
 * 
 * Usage:
 *   await flickerFreeUI.initialize();
 *   flickerFreeUI.switchTab('saved'); // Instant, flicker-free
 *   flickerFreeUI.updateContent('categorize'); // Background update
 */
class FlickerFreeUI {
  constructor() {
    this.initialized = false;
    this.currentTab = 'categorize';
    this.preloadComplete = false;
    this.updateListeners = new Map();
    this.queuedUpdates = []; // Updates to process after initialization
  }

  /**
   * Initialize the complete flicker-free UI system
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log('🚀 FlickerFreeUI: Initializing complete flicker-free UI system');
    const startTime = Date.now();
    
    try {
      // Initialize all core systems
      await this.initializeCoreComponents();
      
      // Preload all tab content
      await this.preloadAllContent();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Restore saved UI state
      await this.restoreInitialState();
      
      this.initialized = true;
      const initTime = Date.now() - startTime;
      
      console.log(`✅ FlickerFreeUI: System initialized in ${initTime}ms`);
      
      // Process any queued updates
      await this.processQueuedUpdates();
      
      // Notify completion
      this.notifyInitialization();
      
    } catch (error) {
      console.error('❌ FlickerFreeUI: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize core components
   */
  async initializeCoreComponents() {
    console.log('🔧 FlickerFreeUI: Initializing core components');
    
    // Initialize in correct order
    await uiStateManager.initialize();
    await virtualContentManager.initialize();
    await backgroundRenderer.initialize();
    
    console.log('✅ FlickerFreeUI: Core components ready');
  }

  /**
   * Preload all tab content for instant switching
   */
  async preloadAllContent() {
    console.log('⏳ FlickerFreeUI: Preloading all tab content');
    const startTime = Date.now();
    
    try {
      // Preload current tabs content
      await backgroundRenderer.renderCurrentTabsBackground(true);
      
      // Preload saved tabs content
      const savedState = uiStateManager.getTabState('saved');
      await backgroundRenderer.renderSavedTabsBackground(
        savedState.groupBy || 'category',
        savedState.showIgnore || false,
        true
      );
      
      // Settings tab is static, no preload needed
      
      this.preloadComplete = true;
      const loadTime = Date.now() - startTime;
      
      console.log(`✅ FlickerFreeUI: All content preloaded in ${loadTime}ms`);
      
    } catch (error) {
      console.error('❌ FlickerFreeUI: Preload failed:', error);
    }
  }

  /**
   * Switch tabs with zero flicker
   */
  async switchTab(newTabId) {
    if (!this.initialized) {
      console.warn('FlickerFreeUI: System not initialized, falling back to basic switch');
      return this.fallbackTabSwitch(newTabId);
    }
    
    const startTime = Date.now();
    console.log(`🔄 FlickerFreeUI: Switching from ${this.currentTab} to ${newTabId}`);
    
    // Don't switch if we're already on the target tab
    if (this.currentTab === newTabId) {
      console.log(`⏭️ FlickerFreeUI: Already on tab ${newTabId}, skipping switch`);
      return;
    }
    
    try {
      // Capture state of current tab
      if (this.currentTab) {
        uiStateManager.captureTabState(this.currentTab);
      }
      
      // Handle tab switch with background renderer
      await backgroundRenderer.handleTabSwitch(this.currentTab, newTabId);
      
      // Update UI classes for tab buttons and panes
      this.updateTabClasses(newTabId);
      
      // Update toolbar visibility for new tab
      console.log(`🔧 FlickerFreeUI: Updating toolbar for switch to ${newTabId}`);
      try {
        const { updateToolbarVisibility } = await import('../modules/unified-toolbar.js');
        await updateToolbarVisibility(newTabId);
      } catch (error) {
        console.error(`❌ FlickerFreeUI: Failed to update toolbar on switch:`, error);
      }
      
      // Update current tab
      this.currentTab = newTabId;
      uiStateManager.updateGlobalState('activeTab', newTabId);
      
      const switchTime = Date.now() - startTime;
      console.log(`✅ FlickerFreeUI: Tab switched to ${newTabId} in ${switchTime}ms`);
      
      // Notify listeners
      this.notifyTabSwitch(newTabId);
      
    } catch (error) {
      console.error(`❌ FlickerFreeUI: Tab switch failed:`, error);
      // Fallback to basic switch
      this.fallbackTabSwitch(newTabId);
    }
  }

  /**
   * Update content in background (no flicker)
   */
  async updateContent(tabId, priority = 'normal') {
    if (!this.initialized) {
      console.warn('FlickerFreeUI: System not initialized, queueing update for after initialization');
      // Queue the update to happen after initialization
      this.queueUpdateForAfterInit(tabId, priority);
      return;
    }
    
    return this.updateContentInternal(tabId, priority);
  }

  /**
   * Internal update content method (bypasses initialization check)
   */
  async updateContentInternal(tabId, priority = 'normal') {
    console.log(`🔄 FlickerFreeUI: Updating ${tabId} content in background`);
    
    try {
      if (tabId === 'categorize') {
        await backgroundRenderer.renderCurrentTabsBackground(false);
      } else if (tabId === 'saved') {
        const savedState = uiStateManager.getTabState('saved');
        await backgroundRenderer.renderSavedTabsBackground(
          savedState.groupBy || 'category',
          savedState.showIgnore || false,
          false
        );
      }
      
      // If this tab is currently visible, sync immediately
      if (tabId === this.currentTab) {
        await backgroundRenderer.syncToVisible(tabId);
      }
      
      console.log(`✅ FlickerFreeUI: ${tabId} content updated`);
      
    } catch (error) {
      console.error(`❌ FlickerFreeUI: Content update failed for ${tabId}:`, error);
    }
  }

  /**
   * Force refresh of tab content
   */
  async forceRefresh(tabId) {
    console.log(`🔄 FlickerFreeUI: Force refreshing ${tabId}`);
    
    if (tabId === 'categorize') {
      await backgroundRenderer.renderCurrentTabsBackground(true);
    } else if (tabId === 'saved') {
      const savedState = uiStateManager.getTabState('saved');
      await backgroundRenderer.renderSavedTabsBackground(
        savedState.groupBy || 'category',
        savedState.showIgnore || false,
        true
      );
    }
    
    // Sync if currently visible
    if (tabId === this.currentTab) {
      await backgroundRenderer.syncToVisible(tabId);
    }
  }

  /**
   * Handle data changes that affect content
   */
  async handleDataChange(changeType, data = {}) {
    console.log(`📊 FlickerFreeUI: Handling data change: ${changeType}`);
    
    switch (changeType) {
      case 'tabs_categorized':
        await this.updateContent('categorize', 'high');
        await this.updateContent('saved'); // Categorization affects saved tabs
        break;
        
      case 'tabs_saved':
        await this.updateContent('saved', 'high');
        await this.updateContent('categorize'); // Saving affects current tabs
        break;
        
      case 'tabs_closed':
        await this.updateContent('categorize', 'high');
        break;
        
      case 'tabs_opened':
        await this.updateContent('categorize');
        break;
        
      case 'saved_grouping_changed':
        await this.updateContent('saved', 'high');
        break;
        
      case 'saved_filter_changed':
        await this.updateContent('saved', 'high');
        break;
        
      default:
        console.log(`FlickerFreeUI: Unknown data change type: ${changeType}`);
    }
  }

  /**
   * Update tab button and pane classes
   */
  updateTabClasses(activeTabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const isActive = btn.dataset.tab === activeTabId;
      btn.classList.toggle('active', isActive);
    });
    
    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      const isActive = pane.id === `${activeTabId}Tab`;
      pane.classList.toggle('active', isActive);
    });
  }

  /**
   * Set up event listeners for UI interactions
   */
  setupEventListeners() {
    console.log('🔧 FlickerFreeUI: Setting up event listeners');
    
    // Tab button clicks
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const tabId = btn.dataset.tab;
        if (tabId && tabId !== this.currentTab) {
          await this.switchTab(tabId);
        }
      });
    });
    
    // State capture on interactions
    ['scroll', 'input', 'change'].forEach(eventType => {
      document.addEventListener(eventType, () => {
        if (this.currentTab) {
          // Debounced state capture
          clearTimeout(this.stateTimeout);
          this.stateTimeout = setTimeout(() => {
            uiStateManager.captureTabState(this.currentTab);
          }, 100);
        }
      }, { passive: true });
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.currentTab) {
        uiStateManager.captureTabState(this.currentTab);
      }
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
      if (this.currentTab) {
        uiStateManager.captureTabState(this.currentTab);
      }
    });
  }

  /**
   * Restore initial UI state
   */
  async restoreInitialState() {
    console.log('🔧 FlickerFreeUI: Restoring initial UI state');
    
    // Get saved active tab
    const globalState = uiStateManager.getGlobalState();
    const savedActiveTab = globalState.activeTab || 'categorize';
    console.log(`🔧 FlickerFreeUI: globalState:`, globalState);
    console.log(`🔧 FlickerFreeUI: savedActiveTab determined as: ${savedActiveTab}`);
    
    // Set initial tab without animation
    this.currentTab = savedActiveTab;
    this.updateTabClasses(savedActiveTab);
    
    // Update toolbar visibility for the active tab
    console.log(`🔧 FlickerFreeUI: Updating toolbar visibility for ${savedActiveTab}`);
    try {
      const { updateToolbarVisibility } = await import('../modules/unified-toolbar.js');
      await updateToolbarVisibility(savedActiveTab);
      console.log(`✅ FlickerFreeUI: Toolbar visibility updated for ${savedActiveTab}`);
    } catch (error) {
      console.error(`❌ FlickerFreeUI: Failed to update toolbar visibility:`, error);
    }
    
    // Restore state for the active tab
    await uiStateManager.restoreTabState(savedActiveTab);
    
    // Sync content for the active tab
    console.log(`🔄 FlickerFreeUI: About to sync ${savedActiveTab} to visible`);
    await backgroundRenderer.syncToVisible(savedActiveTab);
    
    // Also force a content update to ensure we have fresh data
    console.log(`🔄 FlickerFreeUI: Forcing content update for ${savedActiveTab}`);
    if (savedActiveTab === 'categorize') {
      await this.updateContentInternal('categorize', 'high');
    } else if (savedActiveTab === 'saved') {
      await this.updateContentInternal('saved', 'high');
    }
    
    console.log(`✅ FlickerFreeUI: Initial state restored (active: ${savedActiveTab})`);
  }

  /**
   * Fallback tab switch for when system isn't initialized
   */
  fallbackTabSwitch(newTabId) {
    console.log(`🔄 FlickerFreeUI: Fallback tab switch to ${newTabId}`);
    
    this.updateTabClasses(newTabId);
    this.currentTab = newTabId;
    
    // Import and call original switchToTab function
    import('../modules/ui-manager.js').then(({ switchToTab }) => {
      switchToTab(newTabId);
    }).catch(console.error);
  }

  /**
   * Add listener for update events
   */
  addUpdateListener(eventType, callback) {
    if (!this.updateListeners.has(eventType)) {
      this.updateListeners.set(eventType, new Set());
    }
    this.updateListeners.get(eventType).add(callback);
  }

  /**
   * Remove update listener
   */
  removeUpdateListener(eventType, callback) {
    this.updateListeners.get(eventType)?.delete(callback);
  }

  /**
   * Notify listeners of events
   */
  notifyListeners(eventType, data) {
    this.updateListeners.get(eventType)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('FlickerFreeUI: Listener error:', error);
      }
    });
  }

  /**
   * Notify initialization complete
   */
  notifyInitialization() {
    this.notifyListeners('initialized', {
      preloadComplete: this.preloadComplete,
      currentTab: this.currentTab
    });
  }

  /**
   * Notify tab switch
   */
  notifyTabSwitch(newTabId) {
    this.notifyListeners('tab_switched', {
      fromTab: this.currentTab,
      toTab: newTabId,
      timestamp: Date.now()
    });
  }

  /**
   * Get system status for debugging
   */
  getStatus() {
    return {
      initialized: this.initialized,
      currentTab: this.currentTab,
      preloadComplete: this.preloadComplete,
      renderQueue: backgroundRenderer.getQueueStatus(),
      uiState: {
        categorize: uiStateManager.getTabState('categorize'),
        saved: uiStateManager.getTabState('saved'),
        settings: uiStateManager.getTabState('settings'),
        global: uiStateManager.getGlobalState()
      }
    };
  }

  /**
   * Emergency cleanup
   */
  cleanup() {
    console.log('🧹 FlickerFreeUI: Cleaning up system');
    
    if (this.stateTimeout) {
      clearTimeout(this.stateTimeout);
    }
    
    this.updateListeners.clear();
    
    backgroundRenderer.cleanup();
    uiStateManager.cleanup();
    virtualContentManager.cleanup();
    
    this.initialized = false;
    this.preloadComplete = false;
    this.queuedUpdates = [];
  }

  /**
   * Queue an update to be processed after initialization
   */
  queueUpdateForAfterInit(tabId, priority = 'normal') {
    console.log(`📋 FlickerFreeUI: Queueing update for ${tabId} (priority: ${priority})`);
    this.queuedUpdates.push({ tabId, priority, timestamp: Date.now() });
  }

  /**
   * Process any queued updates after initialization completes
   */
  async processQueuedUpdates() {
    if (this.queuedUpdates.length === 0) return;
    
    console.log(`📋 FlickerFreeUI: Processing ${this.queuedUpdates.length} queued updates`);
    
    // Sort by priority (high first) and timestamp
    const sortedUpdates = this.queuedUpdates.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      return a.timestamp - b.timestamp;
    });
    
    // Process unique updates (remove duplicates for same tab)
    const uniqueUpdates = new Map();
    sortedUpdates.forEach(update => {
      uniqueUpdates.set(update.tabId, update);
    });
    
    // Execute updates
    for (const update of uniqueUpdates.values()) {
      try {
        console.log(`📋 FlickerFreeUI: Processing queued update for ${update.tabId}`);
        await this.updateContent(update.tabId, update.priority);
      } catch (error) {
        console.error(`❌ FlickerFreeUI: Queued update failed for ${update.tabId}:`, error);
      }
    }
    
    // Clear the queue
    this.queuedUpdates = [];
    console.log(`✅ FlickerFreeUI: Queued updates processed`);
  }
}

// Create singleton instance
const flickerFreeUI = new FlickerFreeUI();

// Export for global access
window.flickerFreeUI = flickerFreeUI;

export default flickerFreeUI;
export { FlickerFreeUI };