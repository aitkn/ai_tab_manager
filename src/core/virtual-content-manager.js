/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Virtual Content Manager - Robust flicker-free UI with shadow DOM rendering
 */

import { DOM_IDS } from '../utils/constants.js';
import { $id } from '../utils/dom-helpers.js';

/**
 * Virtual Content Manager - Handles shadow/visible DOM architecture
 * 
 * Architecture:
 * - Each tab has visible content (user sees) + shadow content (background rendering)
 * - All updates happen in shadow first, then morphdom syncs to visible
 * - Eliminates ALL flicker and provides smooth transitions
 */
class VirtualContentManager {
  constructor() {
    this.shadowContainers = new Map(); // tabId -> shadow DOM element
    this.visibleContainers = new Map(); // tabId -> visible DOM element
    this.pendingUpdates = new Map(); // tabId -> update queue
    this.morphdomConfig = this.createMorphdomConfig();
    this.initialized = false;
  }

  /**
   * Initialize virtual content system for all tabs
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log('🔧 VirtualContentManager: Initializing virtual content system');
    
    // Initialize virtual containers for each tab
    await this.initializeTabContainer('categorize', DOM_IDS.TABS_CONTAINER);
    await this.initializeTabContainer('saved', DOM_IDS.SAVED_CONTENT);
    
    // For settings tab, find the settings-content div since it doesn't have an ID
    const settingsTab = document.getElementById('settingsTab');
    const settingsContent = settingsTab?.querySelector('.settings-content');
    if (settingsContent) {
      // Give it an ID so we can reference it
      settingsContent.id = 'settingsContent';
      await this.initializeTabContainer('settings', 'settingsContent');
    } else {
      console.warn('VirtualContentManager: Settings content container not found');
    }
    
    this.initialized = true;
    console.log('✅ VirtualContentManager: Virtual content system ready');
  }

  /**
   * Initialize virtual container for a specific tab
   */
  async initializeTabContainer(tabId, containerId) {
    const visibleContainer = $id(containerId);
    if (!visibleContainer) {
      console.warn(`VirtualContentManager: Container ${containerId} not found for tab ${tabId}`);
      return;
    }

    // Check if shadow container already exists (cleanup if needed)
    const existingShadow = document.getElementById(`${containerId}_shadow`);
    if (existingShadow) {
      existingShadow.remove();
      console.log(`🔧 VirtualContentManager: Removed existing shadow container for ${tabId}`);
    }

    // Create shadow container (hidden, for background rendering)
    const shadowContainer = document.createElement('div');
    shadowContainer.id = `${containerId}_shadow`;
    shadowContainer.className = visibleContainer.className;
    shadowContainer.style.display = 'none';
    shadowContainer.style.position = 'absolute';
    shadowContainer.style.top = '-9999px';
    shadowContainer.style.left = '-9999px';
    shadowContainer.style.width = visibleContainer.offsetWidth + 'px';
    shadowContainer.style.height = visibleContainer.offsetHeight + 'px';
    shadowContainer.style.overflow = 'hidden';
    
    // Insert shadow container in DOM (but hidden)
    document.body.appendChild(shadowContainer);
    
    // Clone current content to shadow
    shadowContainer.innerHTML = visibleContainer.innerHTML;
    
    // Store references - IMPORTANT: shadow is for background rendering, visible is for user display
    this.shadowContainers.set(tabId, shadowContainer);
    this.visibleContainers.set(tabId, visibleContainer);
    this.pendingUpdates.set(tabId, []);
    
    console.log(`🔧 VirtualContentManager: Initialized virtual container for ${tabId}`, {
      shadowId: shadowContainer.id,
      visibleId: visibleContainer.id,
      shadowDisplay: shadowContainer.style.display,
      visibleDisplay: getComputedStyle(visibleContainer).display
    });
  }

  /**
   * Queue update to happen in background (shadow DOM)
   */
  queueUpdate(tabId, updateFunction, priority = 'normal') {
    if (!this.shadowContainers.has(tabId)) {
      console.warn(`VirtualContentManager: No shadow container for tab ${tabId}`);
      return Promise.resolve();
    }

    const update = {
      id: Date.now() + Math.random(),
      tabId,
      updateFunction,
      priority,
      timestamp: Date.now()
    };

    const queue = this.pendingUpdates.get(tabId);
    
    // Insert based on priority
    if (priority === 'high') {
      queue.unshift(update);
    } else {
      queue.push(update);
    }

    // Process updates asynchronously
    this.processUpdates(tabId);
    
    return update.id;
  }

  /**
   * Process pending updates for a tab
   */
  async processUpdates(tabId) {
    const queue = this.pendingUpdates.get(tabId);
    if (!queue || queue.length === 0) return;

    const shadowContainer = this.shadowContainers.get(tabId);
    const visibleContainer = this.visibleContainers.get(tabId);
    
    if (!shadowContainer || !visibleContainer) return;

    // Process all queued updates in shadow DOM
    while (queue.length > 0) {
      const update = queue.shift();
      
      try {
        console.log(`🔄 VirtualContentManager: Processing update ${update.id} for ${tabId}`);
        await update.updateFunction(shadowContainer);
        
      } catch (error) {
        console.error(`❌ VirtualContentManager: Update failed for ${tabId}:`, error);
      }
    }

    // If tab is currently visible, sync shadow → visible with morphdom
    if (this.isTabVisible(tabId)) {
      await this.syncToVisible(tabId);
    }
  }

  /**
   * Sync shadow DOM to visible DOM using morphdom (flicker-free)
   */
  async syncToVisible(tabId) {
    let shadowContainer = this.shadowContainers.get(tabId);
    let visibleContainer = this.visibleContainers.get(tabId);
    
    // CRITICAL FIX: Check if containers got swapped and fix them
    if (shadowContainer && visibleContainer) {
      const shadowDisplay = getComputedStyle(shadowContainer).display;
      const visibleDisplay = getComputedStyle(visibleContainer).display;
      
      // If the "visible" container is hidden and "shadow" container is visible, they're swapped
      if (visibleDisplay === 'none' && shadowDisplay !== 'none') {
        console.warn(`🔧 VirtualContentManager: FIXING swapped containers for ${tabId}`);
        // Swap them back
        const temp = shadowContainer;
        shadowContainer = visibleContainer;
        visibleContainer = temp;
        
        // Update the stored references
        this.shadowContainers.set(tabId, shadowContainer);
        this.visibleContainers.set(tabId, visibleContainer);
        
        console.log(`✅ VirtualContentManager: Fixed container references for ${tabId}`, {
          shadowId: shadowContainer.id,
          visibleId: visibleContainer.id
        });
      }
    }
    
    if (!shadowContainer || !visibleContainer) {
      console.warn(`🔄 VirtualContentManager: Missing containers for ${tabId}:`, {
        hasShadow: !!shadowContainer,
        hasVisible: !!visibleContainer
      });
      return;
    }

    console.log(`🔄 VirtualContentManager: Syncing ${tabId} shadow → visible`);
    console.log(`📊 VirtualContentManager: Shadow content length: ${shadowContainer.innerHTML.length}`);
    console.log(`📊 VirtualContentManager: Visible content length before: ${visibleContainer.innerHTML.length}`);
    console.log(`📊 VirtualContentManager: Shadow first 200 chars:`, shadowContainer.innerHTML.substring(0, 200));
    console.log(`📊 VirtualContentManager: Visible container ID: ${visibleContainer.id}`);
    console.log(`📊 VirtualContentManager: Visible container classes: ${visibleContainer.className}`);
    console.log(`📊 VirtualContentManager: Visible container visibility: ${getComputedStyle(visibleContainer).visibility}`);
    console.log(`📊 VirtualContentManager: Visible container display: ${getComputedStyle(visibleContainer).display}`);
    
    try {
      // Preserve current state before morphdom
      const currentState = this.captureContainerState(visibleContainer);
      
      // Use morphdom to sync content (this is flicker-free)
      if (window.morphdom) {
        console.log(`🔧 VirtualContentManager: Using morphdom for ${tabId}`);
        const shadowClone = shadowContainer.cloneNode(true);
        console.log(`📊 VirtualContentManager: Shadow clone innerHTML length: ${shadowClone.innerHTML.length}`);
        
        const morphResult = window.morphdom(visibleContainer, shadowClone, this.morphdomConfig);
        console.log(`📊 VirtualContentManager: Morphdom result:`, morphResult);
        console.log(`📊 VirtualContentManager: Visible content length after morphdom: ${visibleContainer.innerHTML.length}`);
        console.log(`📊 VirtualContentManager: Visible first 200 chars after:`, visibleContainer.innerHTML.substring(0, 200));
      } else {
        console.log(`🔧 VirtualContentManager: Using innerHTML fallback for ${tabId}`);
        visibleContainer.innerHTML = shadowContainer.innerHTML;
        console.log(`📊 VirtualContentManager: Visible content length after innerHTML: ${visibleContainer.innerHTML.length}`);
      }
      
      // Restore preserved state after morphdom
      this.restoreContainerState(visibleContainer, currentState);
      
      // Check if content is actually visible
      const rect = visibleContainer.getBoundingClientRect();
      console.log(`📊 VirtualContentManager: Visible container rect:`, {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right
      });
      
      // Check parent visibility
      let parent = visibleContainer.parentElement;
      while (parent) {
        const parentStyle = getComputedStyle(parent);
        console.log(`📊 VirtualContentManager: Parent ${parent.tagName}#${parent.id}.${parent.className} - display: ${parentStyle.display}, visibility: ${parentStyle.visibility}`);
        if (parent.tagName === 'BODY') break;
        parent = parent.parentElement;
      }
      
      // Check if shadow container actually has content
      console.log(`📊 VirtualContentManager: Shadow container children count: ${shadowContainer.children.length}`);
      console.log(`📊 VirtualContentManager: Visible container children count: ${visibleContainer.children.length}`);
      
      // Log actual DOM structure of both containers
      if (shadowContainer.children.length > 0) {
        console.log(`📊 VirtualContentManager: Shadow container structure:`, shadowContainer.children[0]?.tagName, shadowContainer.children[0]?.className);
      }
      if (visibleContainer.children.length > 0) {
        console.log(`📊 VirtualContentManager: Visible container structure:`, visibleContainer.children[0]?.tagName, visibleContainer.children[0]?.className);
      }
      
      console.log(`✅ VirtualContentManager: Synced ${tabId} successfully`);
      
    } catch (error) {
      console.error(`❌ VirtualContentManager: Sync failed for ${tabId}:`, error);
    }
  }

  /**
   * Force immediate sync for a tab (when switching to it)
   */
  async forceSyncTab(tabId) {
    if (this.pendingUpdates.get(tabId)?.length > 0) {
      await this.processUpdates(tabId);
    } else {
      await this.syncToVisible(tabId);
    }
  }

  /**
   * Check if a tab is currently visible
   */
  isTabVisible(tabId) {
    const visibleContainer = this.visibleContainers.get(tabId);
    if (!visibleContainer) return false;
    
    // Check if tab pane is active
    const tabPane = visibleContainer.closest('.tab-pane');
    return tabPane && tabPane.classList.contains('active');
  }

  /**
   * Capture current state of container (scroll, focus, etc.)
   */
  captureContainerState(container) {
    const state = {
      scrollTop: container.scrollTop,
      scrollLeft: container.scrollLeft,
      focusedElement: null,
      formValues: new Map()
    };

    // Capture focused element
    if (document.activeElement && container.contains(document.activeElement)) {
      state.focusedElement = {
        selector: this.getElementSelector(document.activeElement),
        selectionStart: document.activeElement.selectionStart,
        selectionEnd: document.activeElement.selectionEnd
      };
    }

    // Capture form values
    const formElements = container.querySelectorAll('input, select, textarea');
    formElements.forEach((element, index) => {
      const selector = this.getElementSelector(element);
      state.formValues.set(selector, {
        value: element.value,
        checked: element.checked,
        selectedIndex: element.selectedIndex
      });
    });

    return state;
  }

  /**
   * Restore container state after morphdom
   */
  restoreContainerState(container, state) {
    // Restore scroll position
    container.scrollTop = state.scrollTop;
    container.scrollLeft = state.scrollLeft;

    // Restore form values
    state.formValues.forEach((formState, selector) => {
      const element = container.querySelector(selector);
      if (element) {
        if (element.type === 'checkbox' || element.type === 'radio') {
          element.checked = formState.checked;
        } else if (element.tagName === 'SELECT') {
          element.selectedIndex = formState.selectedIndex;
        } else {
          element.value = formState.value;
        }
      }
    });

    // Restore focus
    if (state.focusedElement) {
      const element = container.querySelector(state.focusedElement.selector);
      if (element) {
        element.focus();
        if (element.setSelectionRange && state.focusedElement.selectionStart !== undefined) {
          element.setSelectionRange(state.focusedElement.selectionStart, state.focusedElement.selectionEnd);
        }
      }
    }
  }

  /**
   * Get unique selector for an element
   */
  getElementSelector(element) {
    if (element.id) return `#${element.id}`;
    
    let selector = element.tagName.toLowerCase();
    if (element.className) {
      selector += `.${element.className.split(' ').join('.')}`;
    }
    
    // Add position-based selector if needed
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element);
      selector += `:nth-child(${index + 1})`;
    }
    
    return selector;
  }

  /**
   * Create morphdom configuration
   */
  createMorphdomConfig() {
    return {
      // Preserve attributes and properties
      onBeforeElUpdated: function(fromEl, toEl) {
        // Preserve form state
        if (fromEl.tagName === 'INPUT' || fromEl.tagName === 'SELECT' || fromEl.tagName === 'TEXTAREA') {
          if (fromEl.type === 'checkbox' || fromEl.type === 'radio') {
            toEl.checked = fromEl.checked;
          } else if (fromEl.tagName === 'SELECT') {
            toEl.selectedIndex = fromEl.selectedIndex;
          } else {
            toEl.value = fromEl.value;
          }
        }
        
        // Preserve scroll positions
        if (fromEl.scrollTop !== undefined) {
          toEl.scrollTop = fromEl.scrollTop;
        }
        if (fromEl.scrollLeft !== undefined) {
          toEl.scrollLeft = fromEl.scrollLeft;
        }
        
        return true;
      },
      
      // Preserve focus
      onElUpdated: function(el) {
        if (document.activeElement === el) {
          el.focus();
        }
      }
    };
  }

  /**
   * Get shadow container for direct manipulation (use carefully)
   */
  getShadowContainer(tabId) {
    return this.shadowContainers.get(tabId);
  }

  /**
   * Get visible container (for state reading only)
   */
  getVisibleContainer(tabId) {
    return this.visibleContainers.get(tabId);
  }

  /**
   * Clean up virtual content system
   */
  cleanup() {
    this.shadowContainers.forEach(shadow => {
      if (shadow.parentNode) {
        shadow.parentNode.removeChild(shadow);
      }
    });
    
    this.shadowContainers.clear();
    this.visibleContainers.clear();
    this.pendingUpdates.clear();
    this.initialized = false;
  }
}

// Create singleton instance
const virtualContentManager = new VirtualContentManager();

export default virtualContentManager;
export { VirtualContentManager };