/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Background Renderer - Orchestrates background rendering with morphdom transitions
 */

import virtualContentManager from './virtual-content-manager.js';
import uiStateManager from './ui-state-manager.js';
import { displayTabs } from '../modules/tab-display.js';
import { showSavedTabsContent } from '../modules/saved-tabs-manager.js';

/**
 * Background Rendering Pipeline
 * 
 * Orchestrates the entire flicker-free rendering system:
 * 1. Renders content in shadow DOM (background)
 * 2. Preserves UI state during rendering
 * 3. Uses morphdom to sync visible content smoothly
 * 4. Batches updates for optimal performance
 */
class BackgroundRenderer {
  constructor() {
    this.renderQueue = new Map(); // tabId -> render tasks
    this.isProcessing = false;
    this.renderCallbacks = new Map(); // taskId -> callback
    this.initialized = false;
  }

  /**
   * Initialize background rendering system
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log('🔧 BackgroundRenderer: Initializing background rendering pipeline');
    
    // Initialize virtual content manager
    await virtualContentManager.initialize();
    
    // Initialize UI state manager
    await uiStateManager.initialize();
    
    this.initialized = true;
    console.log('✅ BackgroundRenderer: Background rendering pipeline ready');
  }

  /**
   * Render current tabs content in background
   */
  async renderCurrentTabsBackground(force = false) {
    return this.queueRender('categorize', async (shadowContainer) => {
      console.log('🔄 BackgroundRenderer: Rendering current tabs in background');
      
      // Get current tabs data
      const { getCurrentTabs } = await import('../modules/tab-data-source.js');
      const { categorizedTabs } = await getCurrentTabs();
      
      // Check if content actually changed
      if (!force && !this.hasContentChanged('categorize', categorizedTabs)) {
        console.log('⏭️ BackgroundRenderer: Current tabs unchanged, skipping render');
        return false;
      }
      
      // Render to shadow DOM (this won't be visible yet)
      await this.renderCurrentTabsToContainer(shadowContainer, categorizedTabs);
      
      // Update content hash for change detection
      this.updateContentHash('categorize', categorizedTabs);
      
      console.log('✅ BackgroundRenderer: Current tabs rendered to shadow DOM');
      return true;
    });
  }

  /**
   * Render saved tabs content in background
   */
  async renderSavedTabsBackground(grouping = 'category', showIgnore = false, force = false) {
    return this.queueRender('saved', async (shadowContainer) => {
      console.log('🔄 BackgroundRenderer: Rendering saved tabs in background');
      
      // Get saved tabs data
      const savedData = await this.getSavedTabsData(grouping, showIgnore);
      
      // Check if content actually changed
      const contentKey = `${grouping}_${showIgnore}`;
      if (!force && !this.hasContentChanged('saved', savedData, contentKey)) {
        console.log('⏭️ BackgroundRenderer: Saved tabs unchanged, skipping render');
        return false;
      }
      
      // Render to shadow DOM
      await this.renderSavedTabsToContainer(shadowContainer, savedData, grouping, showIgnore);
      
      // Update content hash for change detection
      this.updateContentHash('saved', savedData, contentKey);
      
      console.log('✅ BackgroundRenderer: Saved tabs rendered to shadow DOM');
      return true;
    });
  }

  /**
   * Queue a render task for background processing
   */
  async queueRender(tabId, renderFunction, priority = 'normal') {
    const taskId = `${tabId}_${Date.now()}_${Math.random()}`;
    
    const task = {
      id: taskId,
      tabId,
      renderFunction,
      priority,
      timestamp: Date.now()
    };
    
    // Add to render queue
    if (!this.renderQueue.has(tabId)) {
      this.renderQueue.set(tabId, []);
    }
    
    const queue = this.renderQueue.get(tabId);
    if (priority === 'high') {
      queue.unshift(task);
    } else {
      queue.push(task);
    }
    
    // Process queue
    this.processRenderQueue();
    
    // Return promise that resolves when this specific task completes
    return new Promise((resolve, reject) => {
      this.renderCallbacks.set(taskId, { resolve, reject });
    });
  }

  /**
   * Process render queue
   */
  async processRenderQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      // Process all tabs with pending renders
      for (const [tabId, queue] of this.renderQueue.entries()) {
        if (queue.length === 0) continue;
        
        // Process one task per tab per cycle
        const task = queue.shift();
        
        try {
          console.log(`🔄 BackgroundRenderer: Processing render task ${task.id}`);
          
          // Queue the render in virtual content manager
          await virtualContentManager.queueUpdate(
            tabId,
            task.renderFunction,
            task.priority
          );
          
          // Resolve the task callback
          const callback = this.renderCallbacks.get(task.id);
          if (callback) {
            callback.resolve(true);
            this.renderCallbacks.delete(task.id);
          }
          
        } catch (error) {
          console.error(`❌ BackgroundRenderer: Render task ${task.id} failed:`, error);
          
          // Reject the task callback
          const callback = this.renderCallbacks.get(task.id);
          if (callback) {
            callback.reject(error);
            this.renderCallbacks.delete(task.id);
          }
        }
      }
      
      // Clean up empty queues
      for (const [tabId, queue] of this.renderQueue.entries()) {
        if (queue.length === 0) {
          this.renderQueue.delete(tabId);
        }
      }
      
    } finally {
      this.isProcessing = false;
      
      // Continue processing if there are more tasks
      if (this.renderQueue.size > 0) {
        setTimeout(() => this.processRenderQueue(), 10);
      }
    }
  }

  /**
   * Sync background content to visible (called when switching to a tab)
   */
  async syncToVisible(tabId) {
    console.log(`🔄 BackgroundRenderer: Syncing ${tabId} to visible`);
    
    // Capture current UI state before sync
    uiStateManager.captureTabState(tabId);
    
    // Sync shadow to visible with morphdom
    await virtualContentManager.forceSyncTab(tabId);
    
    // Restore UI state after sync
    await uiStateManager.restoreTabState(tabId);
    
    console.log(`✅ BackgroundRenderer: ${tabId} synced to visible`);
  }

  /**
   * Handle tab switch with zero flicker
   */
  async handleTabSwitch(fromTabId, toTabId) {
    console.log(`🔄 BackgroundRenderer: Switching from ${fromTabId} to ${toTabId}`);
    
    // Capture state of current tab before switch
    if (fromTabId) {
      uiStateManager.captureTabState(fromTabId);
      uiStateManager.updateGlobalState('activeTab', toTabId);
    }
    
    // Sync background content to visible for target tab
    await this.syncToVisible(toTabId);
    
    console.log(`✅ BackgroundRenderer: Tab switch complete`);
  }

  /**
   * Render current tabs to a specific container
   */
  async renderCurrentTabsToContainer(container, categorizedTabs) {
    console.log(`🔄 BackgroundRenderer: renderCurrentTabsToContainer called for container:`, container.id);
    console.log(`📊 BackgroundRenderer: categorizedTabs:`, categorizedTabs);
    console.log(`📊 BackgroundRenderer: categorizedTabs keys:`, Object.keys(categorizedTabs));
    console.log(`📊 BackgroundRenderer: categorizedTabs lengths:`, Object.keys(categorizedTabs).map(cat => `${cat}: ${categorizedTabs[cat]?.length || 0}`));
    
    // Create a temporary state for rendering
    const originalState = window.state?.categorizedTabs;
    if (window.state) {
      window.state.categorizedTabs = categorizedTabs;
    }
    
    try {
      // Clear container and render fresh content
      container.innerHTML = '';
      console.log(`🔧 BackgroundRenderer: Container cleared`);
      
      // Create a tabs container structure
      const tabsContainer = document.createElement('div');
      tabsContainer.id = 'tabsContainer';
      tabsContainer.className = 'tabs-container';
      container.appendChild(tabsContainer);
      console.log(`🔧 BackgroundRenderer: Created tabsContainer`);
      
      // Import and use displayTabs function with container override
      const { renderTabsToContainer } = await import('../modules/tab-display.js');
      console.log(`📊 BackgroundRenderer: renderTabsToContainer available:`, !!renderTabsToContainer);
      
      if (renderTabsToContainer) {
        console.log(`🔄 BackgroundRenderer: Calling renderTabsToContainer`);
        await renderTabsToContainer(tabsContainer, categorizedTabs);
        console.log(`✅ BackgroundRenderer: renderTabsToContainer completed`);
        console.log(`📊 BackgroundRenderer: Container content after render: ${container.innerHTML.length} chars`);
        console.log(`📊 BackgroundRenderer: Container first 300 chars:`, container.innerHTML.substring(0, 300));
      } else {
        // Fallback: use existing displayTabs logic
        console.log(`🔄 BackgroundRenderer: Using fallback renderTabsDirectly`);
        await this.renderTabsDirectly(tabsContainer, categorizedTabs);
        console.log(`✅ BackgroundRenderer: renderTabsDirectly completed`);
        console.log(`📊 BackgroundRenderer: Container content after fallback: ${container.innerHTML.length} chars`);
        console.log(`📊 BackgroundRenderer: Container first 300 chars:`, container.innerHTML.substring(0, 300));
      }
      
    } finally {
      // Restore original state
      if (window.state && originalState !== undefined) {
        window.state.categorizedTabs = originalState;
      }
    }
  }

  /**
   * Render saved tabs to a specific container
   */
  async renderSavedTabsToContainer(container, savedData, grouping, showIgnore) {
    // Clear container
    container.innerHTML = '';
    
    // Import saved tabs rendering logic
    const { renderSavedTabsToContainer } = await import('../modules/saved-tabs-manager.js');
    
    if (renderSavedTabsToContainer) {
      await renderSavedTabsToContainer(container, savedData, grouping, showIgnore);
    } else {
      // Fallback: create basic structure
      container.innerHTML = '<div>Saved tabs content placeholder</div>';
    }
  }

  /**
   * Get saved tabs data
   */
  async getSavedTabsData(grouping, showIgnore) {
    try {
      // Get categories to include
      const categories = showIgnore ? [1, 2, 3] : [2, 3]; // Include or exclude category 1 (ignore)
      
      // Query database
      const savedUrls = await window.tabDatabase.getSavedUrls(categories);
      
      // Convert to tab format
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
        favIconUrl: urlInfo.favicon
      }));
      
      return {
        tabs: allSavedTabs,
        grouping,
        showIgnore,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error('BackgroundRenderer: Error getting saved tabs data:', error);
      return { tabs: [], grouping, showIgnore, timestamp: Date.now() };
    }
  }

  /**
   * Check if content has changed (for optimization)
   */
  hasContentChanged(tabId, newContent, contentKey = 'default') {
    if (!this.contentHashes) {
      this.contentHashes = new Map();
    }
    
    const key = `${tabId}_${contentKey}`;
    const newHash = this.generateContentHash(newContent);
    const oldHash = this.contentHashes.get(key);
    
    return oldHash !== newHash;
  }

  /**
   * Update content hash for change detection
   */
  updateContentHash(tabId, content, contentKey = 'default') {
    if (!this.contentHashes) {
      this.contentHashes = new Map();
    }
    
    const key = `${tabId}_${contentKey}`;
    const hash = this.generateContentHash(content);
    this.contentHashes.set(key, hash);
  }

  /**
   * Generate simple hash for content
   */
  generateContentHash(content) {
    const str = JSON.stringify(content);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Direct tab rendering fallback
   */
  async renderTabsDirectly(container, categorizedTabs) {
    // This is a simplified version - the real displayTabs function should be used
    container.innerHTML = '<div class="tabs-placeholder">Rendering tabs...</div>';
    
    // In a real implementation, this would call the actual tab rendering logic
    // but render it to the provided container instead of the default one
  }

  /**
   * Mark content as dirty and trigger background render
   */
  markDirtyAndRender(tabId, priority = 'normal') {
    if (tabId === 'categorize') {
      this.renderCurrentTabsBackground(false).catch(console.error);
    } else if (tabId === 'saved') {
      const grouping = uiStateManager.getTabState('saved').groupBy || 'category';
      const showIgnore = uiStateManager.getTabState('saved').showIgnore || false;
      this.renderSavedTabsBackground(grouping, showIgnore, false).catch(console.error);
    }
  }

  /**
   * Get render queue status for debugging
   */
  getQueueStatus() {
    const status = {};
    this.renderQueue.forEach((queue, tabId) => {
      status[tabId] = {
        pending: queue.length,
        tasks: queue.map(task => ({ id: task.id, priority: task.priority }))
      };
    });
    
    return {
      isProcessing: this.isProcessing,
      queues: status,
      pendingCallbacks: this.renderCallbacks.size
    };
  }

  /**
   * Cleanup background renderer
   */
  cleanup() {
    this.renderQueue.clear();
    this.renderCallbacks.clear();
    this.isProcessing = false;
    this.initialized = false;
    
    if (this.contentHashes) {
      this.contentHashes.clear();
    }
  }
}

// Create singleton instance
const backgroundRenderer = new BackgroundRenderer();

export default backgroundRenderer;
export { BackgroundRenderer };