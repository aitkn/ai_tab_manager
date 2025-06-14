/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * UI State Manager - Comprehensive state preservation for all UI controls
 */

import { DOM_IDS } from '../utils/constants.js';
import { $id } from '../utils/dom-helpers.js';
import StorageService from '../services/StorageService.js';

/**
 * Comprehensive UI State Manager
 * 
 * Tracks and preserves ALL UI control states:
 * - Scroll positions for all containers
 * - Dropdown selections (group by, etc.)
 * - Checkbox states (show ignore, etc.)
 * - Search query values
 * - Expanded/collapsed groups
 * - Focus states
 * - Form inputs
 */
class UIStateManager {
  constructor() {
    this.state = {
      categorize: {
        scrollPosition: 0,
        groupBy: 'category',
        searchQuery: '',
        expandedGroups: new Set(),
        selectedItems: new Set(),
        focusedElement: null,
        lastUpdate: 0
      },
      saved: {
        scrollPosition: 0,
        groupBy: 'category',
        showIgnore: false,
        searchQuery: '',
        expandedGroups: new Set(),
        selectedItems: new Set(),
        focusedElement: null,
        lastUpdate: 0
      },
      settings: {
        scrollPosition: 0,
        activeSection: null,
        formValues: new Map(),
        expandedSections: new Set(),
        focusedElement: null,
        lastUpdate: 0
      },
      global: {
        activeTab: 'categorize',
        theme: 'system',
        popupSize: { width: 800, height: 600 },
        lastSaveTime: 0
      }
    };
    
    this.stateListeners = new Map(); // tabId -> Set of callback functions
    this.autoSaveInterval = null;
    this.pendingSave = false;
  }

  /**
   * Initialize UI state system
   */
  async initialize() {
    console.log('🔧 UIStateManager: Initializing comprehensive UI state tracking');
    
    // Load saved state from storage
    await this.loadState();
    
    // Set up auto-save
    this.startAutoSave();
    
    // Set up state capture listeners
    this.setupStateCapture();
    
    console.log('✅ UIStateManager: UI state system ready');
  }

  /**
   * Load state from Chrome storage
   */
  async loadState() {
    try {
      const saved = await StorageService.loadSettings();
      if (saved && saved.uiState) {
        this.mergeState(saved.uiState);
        console.log('📥 UIStateManager: Loaded saved UI state');
      } else {
        console.log('📥 UIStateManager: No saved UI state found, using defaults');
      }
    } catch (error) {
      console.error('❌ UIStateManager: Failed to load state:', error);
    }
  }

  /**
   * Save state to Chrome storage
   */
  async saveState() {
    if (this.pendingSave) return;
    
    this.pendingSave = true;
    
    try {
      // Convert Sets to Arrays for JSON serialization
      const serializable = this.serializeState();
      
      const current = await StorageService.loadSettings() || {};
      current.uiState = serializable;
      await StorageService.saveSettings(current);
      
      this.state.global.lastSaveTime = Date.now();
      console.log('💾 UIStateManager: State saved to storage');
      
    } catch (error) {
      console.error('❌ UIStateManager: Failed to save state:', error);
    } finally {
      this.pendingSave = false;
    }
  }

  /**
   * Capture current state from DOM for a specific tab
   */
  captureTabState(tabId) {
    const startTime = Date.now();
    
    switch (tabId) {
      case 'categorize':
        this.captureCategorizeState();
        break;
      case 'saved':
        this.captureSavedState();
        break;
      case 'settings':
        this.captureSettingsState();
        break;
    }
    
    this.state[tabId].lastUpdate = Date.now();
    this.notifyStateChange(tabId);
    
    console.log(`📊 UIStateManager: Captured ${tabId} state in ${Date.now() - startTime}ms`);
  }

  /**
   * Restore state to DOM for a specific tab
   */
  async restoreTabState(tabId) {
    const startTime = Date.now();
    
    switch (tabId) {
      case 'categorize':
        await this.restoreCategorizeState();
        break;
      case 'saved':
        await this.restoreSavedState();
        break;
      case 'settings':
        await this.restoreSettingsState();
        break;
    }
    
    console.log(`📥 UIStateManager: Restored ${tabId} state in ${Date.now() - startTime}ms`);
  }

  /**
   * Capture categorize tab state
   */
  captureCategorizeState() {
    const tabsContainer = $id(DOM_IDS.TABS_CONTAINER);
    const searchInput = $id('unifiedSearchInput');
    const groupingSelect = $id('unifiedGroupingSelect');
    
    // Scroll position
    if (tabsContainer) {
      this.state.categorize.scrollPosition = tabsContainer.scrollTop;
    }
    
    // Search query
    if (searchInput) {
      this.state.categorize.searchQuery = searchInput.value;
    }
    
    // Grouping selection
    if (groupingSelect) {
      this.state.categorize.groupBy = groupingSelect.value;
    }
    
    // Expanded groups
    this.state.categorize.expandedGroups.clear();
    document.querySelectorAll('.category-section:not(.collapsed), .group-section:not(.collapsed)').forEach(section => {
      if (section.id) {
        this.state.categorize.expandedGroups.add(section.id);
      }
    });
    
    // Focused element
    this.captureFocusState('categorize');
  }

  /**
   * Capture saved tab state
   */
  captureSavedState() {
    const savedContent = $id(DOM_IDS.SAVED_CONTENT);
    const searchInput = $id('unifiedSearchInput');
    const groupingSelect = $id('unifiedGroupingSelect');
    const showIgnoreCheckbox = $id('showAllCheckbox');
    
    // Scroll position
    if (savedContent) {
      this.state.saved.scrollPosition = savedContent.scrollTop;
    }
    
    // Search query
    if (searchInput) {
      this.state.saved.searchQuery = searchInput.value;
    }
    
    // Grouping selection
    if (groupingSelect) {
      this.state.saved.groupBy = groupingSelect.value;
    }
    
    // Show ignore checkbox
    if (showIgnoreCheckbox) {
      this.state.saved.showIgnore = showIgnoreCheckbox.checked;
    }
    
    // Expanded groups
    this.state.saved.expandedGroups.clear();
    document.querySelectorAll('#savedContent .category-section:not(.collapsed), #savedContent .group-section:not(.collapsed)').forEach(section => {
      if (section.id) {
        this.state.saved.expandedGroups.add(section.id);
      }
    });
    
    // Focused element
    this.captureFocusState('saved');
  }

  /**
   * Capture settings tab state
   */
  captureSettingsState() {
    const settingsContent = document.querySelector('.settings-content');
    
    // Scroll position
    if (settingsContent) {
      this.state.settings.scrollPosition = settingsContent.scrollTop;
    }
    
    // Form values
    this.state.settings.formValues.clear();
    settingsContent?.querySelectorAll('input, select, textarea').forEach(element => {
      if (element.id) {
        const value = {
          value: element.value,
          checked: element.checked,
          selectedIndex: element.selectedIndex
        };
        this.state.settings.formValues.set(element.id, value);
      }
    });
    
    // Expanded sections
    this.state.settings.expandedSections.clear();
    settingsContent?.querySelectorAll('.setting-group.expanded, .rule-category-section.expanded').forEach(section => {
      if (section.id || section.dataset.category) {
        this.state.settings.expandedSections.add(section.id || section.dataset.category);
      }
    });
    
    // Focused element
    this.captureFocusState('settings');
  }

  /**
   * Restore categorize tab state
   */
  async restoreCategorizeState() {
    const tabsContainer = $id(DOM_IDS.TABS_CONTAINER);
    const searchInput = $id('unifiedSearchInput');
    const groupingSelect = $id('unifiedGroupingSelect');
    
    // Restore scroll position
    if (tabsContainer && this.state.categorize.scrollPosition > 0) {
      tabsContainer.scrollTop = this.state.categorize.scrollPosition;
    }
    
    // Restore search query
    if (searchInput && this.state.categorize.searchQuery) {
      searchInput.value = this.state.categorize.searchQuery;
    }
    
    // Restore grouping selection
    if (groupingSelect && this.state.categorize.groupBy) {
      groupingSelect.value = this.state.categorize.groupBy;
    }
    
    // Restore expanded groups
    await this.restoreExpandedGroups('categorize');
    
    // Restore focus
    this.restoreFocusState('categorize');
  }

  /**
   * Restore saved tab state
   */
  async restoreSavedState() {
    const savedContent = $id(DOM_IDS.SAVED_CONTENT);
    const searchInput = $id('unifiedSearchInput');
    const groupingSelect = $id('unifiedGroupingSelect');
    const showIgnoreCheckbox = $id('showAllCheckbox');
    
    // Restore scroll position (with delay to ensure content is rendered)
    if (savedContent && this.state.saved.scrollPosition > 0) {
      setTimeout(() => {
        savedContent.scrollTop = this.state.saved.scrollPosition;
      }, 50);
    }
    
    // Restore search query
    if (searchInput && this.state.saved.searchQuery) {
      searchInput.value = this.state.saved.searchQuery;
    }
    
    // Restore grouping selection
    if (groupingSelect && this.state.saved.groupBy) {
      groupingSelect.value = this.state.saved.groupBy;
    }
    
    // Restore show ignore checkbox
    if (showIgnoreCheckbox) {
      showIgnoreCheckbox.checked = this.state.saved.showIgnore;
    }
    
    // Restore expanded groups
    await this.restoreExpandedGroups('saved');
    
    // Restore focus
    this.restoreFocusState('saved');
  }

  /**
   * Restore settings tab state
   */
  async restoreSettingsState() {
    const settingsContent = document.querySelector('.settings-content');
    
    // Restore scroll position
    if (settingsContent && this.state.settings.scrollPosition > 0) {
      settingsContent.scrollTop = this.state.settings.scrollPosition;
    }
    
    // Restore form values
    this.state.settings.formValues.forEach((formState, elementId) => {
      const element = $id(elementId);
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
    
    // Restore expanded sections
    this.state.settings.expandedSections.forEach(sectionId => {
      const section = $id(sectionId) || document.querySelector(`[data-category="${sectionId}"]`);
      if (section) {
        section.classList.add('expanded');
      }
    });
    
    // Restore focus
    this.restoreFocusState('settings');
  }

  /**
   * Capture focus state for a tab
   */
  captureFocusState(tabId) {
    if (document.activeElement && document.activeElement.id) {
      this.state[tabId].focusedElement = {
        id: document.activeElement.id,
        selectionStart: document.activeElement.selectionStart,
        selectionEnd: document.activeElement.selectionEnd
      };
    } else {
      this.state[tabId].focusedElement = null;
    }
  }

  /**
   * Restore focus state for a tab
   */
  restoreFocusState(tabId) {
    const focusState = this.state[tabId].focusedElement;
    if (focusState) {
      const element = $id(focusState.id);
      if (element) {
        element.focus();
        if (element.setSelectionRange && focusState.selectionStart !== undefined) {
          element.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
        }
      }
    }
  }

  /**
   * Restore expanded groups for a tab
   */
  async restoreExpandedGroups(tabId) {
    const expandedGroups = this.state[tabId].expandedGroups;
    
    // Use a small delay to ensure DOM is ready
    setTimeout(() => {
      expandedGroups.forEach(groupId => {
        const group = $id(groupId);
        if (group) {
          group.classList.remove('collapsed');
        }
      });
    }, 10);
  }

  /**
   * Set up automatic state capture on DOM changes
   */
  setupStateCapture() {
    // Capture state on scroll
    ['scroll', 'input', 'change', 'focus', 'blur'].forEach(eventType => {
      document.addEventListener(eventType, (e) => {
        const activeTab = this.state.global.activeTab;
        if (activeTab) {
          // Debounced capture
          clearTimeout(this.captureTimeout);
          this.captureTimeout = setTimeout(() => {
            this.captureTabState(activeTab);
          }, 100);
        }
      }, { passive: true });
    });
    
    // Capture state before page unload
    window.addEventListener('beforeunload', () => {
      const activeTab = this.state.global.activeTab;
      if (activeTab) {
        this.captureTabState(activeTab);
        this.saveState();
      }
    });
  }

  /**
   * Start auto-save interval
   */
  startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    // Save state every 5 seconds if there are changes
    this.autoSaveInterval = setInterval(() => {
      if (Date.now() - this.state.global.lastSaveTime > 5000) {
        this.saveState();
      }
    }, 5000);
  }

  /**
   * Add state change listener
   */
  addStateListener(tabId, callback) {
    if (!this.stateListeners.has(tabId)) {
      this.stateListeners.set(tabId, new Set());
    }
    this.stateListeners.get(tabId).add(callback);
  }

  /**
   * Remove state change listener
   */
  removeStateListener(tabId, callback) {
    this.stateListeners.get(tabId)?.delete(callback);
  }

  /**
   * Notify listeners of state change
   */
  notifyStateChange(tabId) {
    this.stateListeners.get(tabId)?.forEach(callback => {
      try {
        callback(this.state[tabId]);
      } catch (error) {
        console.error('UIStateManager: Listener error:', error);
      }
    });
  }

  /**
   * Update global state
   */
  updateGlobalState(key, value) {
    this.state.global[key] = value;
    this.saveState();
  }

  /**
   * Get current state for a tab
   */
  getTabState(tabId) {
    return this.state[tabId];
  }

  /**
   * Get global state
   */
  getGlobalState() {
    return this.state.global;
  }

  /**
   * Serialize state for storage (convert Sets to Arrays)
   */
  serializeState() {
    const serialized = JSON.parse(JSON.stringify(this.state));
    
    // Convert Sets to Arrays
    ['categorize', 'saved', 'settings'].forEach(tabId => {
      if (this.state[tabId].expandedGroups) {
        serialized[tabId].expandedGroups = Array.from(this.state[tabId].expandedGroups);
      }
      if (this.state[tabId].selectedItems) {
        serialized[tabId].selectedItems = Array.from(this.state[tabId].selectedItems);
      }
    });
    
    // Convert Maps to Objects
    if (this.state.settings.formValues) {
      serialized.settings.formValues = Object.fromEntries(this.state.settings.formValues);
    }
    if (this.state.settings.expandedSections) {
      serialized.settings.expandedSections = Array.from(this.state.settings.expandedSections);
    }
    
    return serialized;
  }

  /**
   * Merge loaded state (convert Arrays back to Sets)
   */
  mergeState(loadedState) {
    // Merge each tab's state
    ['categorize', 'saved', 'settings'].forEach(tabId => {
      if (loadedState[tabId]) {
        Object.assign(this.state[tabId], loadedState[tabId]);
        
        // Convert Arrays back to Sets
        if (Array.isArray(loadedState[tabId].expandedGroups)) {
          this.state[tabId].expandedGroups = new Set(loadedState[tabId].expandedGroups);
        }
        if (Array.isArray(loadedState[tabId].selectedItems)) {
          this.state[tabId].selectedItems = new Set(loadedState[tabId].selectedItems);
        }
      }
    });
    
    // Merge global state
    if (loadedState.global) {
      Object.assign(this.state.global, loadedState.global);
    }
    
    // Convert Maps back from Objects
    if (loadedState.settings?.formValues) {
      this.state.settings.formValues = new Map(Object.entries(loadedState.settings.formValues));
    }
    if (Array.isArray(loadedState.settings?.expandedSections)) {
      this.state.settings.expandedSections = new Set(loadedState.settings.expandedSections);
    }
  }

  /**
   * Cleanup and stop auto-save
   */
  cleanup() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    if (this.captureTimeout) {
      clearTimeout(this.captureTimeout);
    }
    this.stateListeners.clear();
  }
}

// Create singleton instance
const uiStateManager = new UIStateManager();

export default uiStateManager;
export { UIStateManager };