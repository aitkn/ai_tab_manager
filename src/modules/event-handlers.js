/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Event Handlers - all UI event handler functions
 */

import { DOM_IDS, EVENTS, TAB_CATEGORIES, LIMITS } from '../utils/constants.js';
import { $id, on } from '../utils/dom-helpers.js';
import { state, updateState, savePopupState, debouncedSaveState } from './state-manager.js';
import { switchToTab, setTheme, showStatus, clearStatus } from './ui-manager.js';
import { handleCategorize } from './categorization-service.js';
import StorageService from '../services/StorageService.js';
import { onGroupingChange as handleGroupingChange, onSavedGroupingChange as handleSavedGroupingChange, toggleAllGroups } from './ui-utilities.js';
import { saveAndCloseAll } from './tab-operations.js';
import { exportToCSV, handleCSVImport } from './import-export.js';
import { updateModelDropdown } from './settings-manager.js';
import { showSavedTabsContent } from './saved-tabs-manager.js';

/**
 * Set up all event listeners
 */
export function setupEventListeners() {
  // Main action buttons
  on($id(DOM_IDS.CATEGORIZE_BTN), EVENTS.CLICK, handleCategorize);
  on($id(DOM_IDS.SAVE_AND_CLOSE_ALL_BTN), EVENTS.CLICK, () => saveAndCloseAll());
  on($id(DOM_IDS.SAVE_API_KEY_BTN), EVENTS.CLICK, saveApiKey);
  on($id(DOM_IDS.OPEN_SETTINGS_BTN), EVENTS.CLICK, () => switchToTab('settings'));
  
  // Settings controls
  on($id(DOM_IDS.PROVIDER_SELECT), EVENTS.CHANGE, onProviderChange);
  on($id(DOM_IDS.MODEL_SELECT), EVENTS.CHANGE, onModelChange);
  on($id(DOM_IDS.PROMPT_TEXTAREA), EVENTS.INPUT, onPromptChange);
  on($id(DOM_IDS.RESET_PROMPT_BTN), EVENTS.CLICK, resetPrompt);
  on($id(DOM_IDS.MAX_TABS_INPUT), EVENTS.CHANGE, onMaxTabsChange);
  
  // Search controls
  on($id(DOM_IDS.SEARCH_INPUT), EVENTS.INPUT, onSearchInput);
  on($id(DOM_IDS.CLEAR_SEARCH_BTN), EVENTS.CLICK, clearSearch);
  
  // Saved tab controls
  const savedGroupingSelect = $id(DOM_IDS.SAVED_GROUPING_SELECT);
  const savedSearchInput = $id(DOM_IDS.SAVED_SEARCH_INPUT);
  const clearSavedSearchBtn = $id(DOM_IDS.CLEAR_SAVED_SEARCH_BTN);
  
  if (savedGroupingSelect) {
    on(savedGroupingSelect, EVENTS.CHANGE, handleSavedGroupingChange);
  }
  
  if (savedSearchInput) {
    on(savedSearchInput, EVENTS.INPUT, onSavedSearchInput);
  }
  
  if (clearSavedSearchBtn) {
    on(clearSavedSearchBtn, EVENTS.CLICK, clearSavedSearch);
  }
  
  // Export/Import buttons
  on($id(DOM_IDS.EXPORT_CSV_BTN), EVENTS.CLICK, exportToCSV);
  on($id(DOM_IDS.IMPORT_CSV_BTN), EVENTS.CLICK, () => {
    $id(DOM_IDS.CSV_FILE_INPUT).click();
  });
  on($id(DOM_IDS.CSV_FILE_INPUT), EVENTS.CHANGE, handleCSVImport);
  
  // Show All Categories checkbox
  const showAllCheckbox = $id('showAllCategoriesCheckbox');
  if (showAllCheckbox) {
    on(showAllCheckbox, EVENTS.CHANGE, handleShowAllCategoriesChange);
  }
  
  // Refresh sessions button
  const refreshSessionsBtn = $id('refreshSessionsBtn');
  if (refreshSessionsBtn) {
    on(refreshSessionsBtn, EVENTS.CLICK, async () => {
      const { displayRecentSessions } = await import('./saved-tabs-manager.js');
      await displayRecentSessions();
      showStatus('Sessions refreshed', 'success', 2000);
    });
  }
  
  // Grouping controls
  on($id(DOM_IDS.GROUPING_SELECT), EVENTS.CHANGE, handleGroupingChange);
  on($id(DOM_IDS.TOGGLE_ALL_GROUPS_BTN), EVENTS.CLICK, toggleAllGroups);
  on($id(DOM_IDS.TOGGLE_CATEGORIZE_GROUPS_BTN), EVENTS.CLICK, toggleAllGroups);
  
  // Theme buttons
  document.querySelectorAll('.theme-btn').forEach(btn => {
    on(btn, EVENTS.CLICK, () => setTheme(btn.dataset.theme));
  });
  
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    on(btn, EVENTS.CLICK, () => switchToTab(btn.dataset.tab));
  });
  
  // Window visibility change
  on(document, 'visibilitychange', () => {
    if (document.hidden) {
      savePopupState();
    }
  });
  
  // Save state before unload
  on(window, 'beforeunload', () => {
    savePopupState();
  });
}

/**
 * Provider change handler
 */
async function onProviderChange() {
  const provider = $id(DOM_IDS.PROVIDER_SELECT).value;
  console.log('Provider changed to:', provider);
  
  updateState('provider', provider);
  state.settings.provider = provider;
  
  // Load API key for this provider if it exists
  const apiKey = state.settings.apiKeys[provider];
  if (apiKey) {
    $id(DOM_IDS.API_KEY_INPUT).value = apiKey;
  } else {
    $id(DOM_IDS.API_KEY_INPUT).value = '';
  }
  
  // Update model dropdown
  await updateModelDropdown();
  
  // Save settings
  await StorageService.saveSettings(state.settings);
}

/**
 * Model change handler
 */
async function onModelChange() {
  const model = $id(DOM_IDS.MODEL_SELECT).value;
  const provider = state.settings.provider;
  
  console.log('Model changed to:', model);
  
  state.settings.selectedModels[provider] = model;
  updateState('model', model);
  
  await StorageService.saveSettings(state.settings);
}

/**
 * Save API key
 */
async function saveApiKey() {
  const apiKey = $id(DOM_IDS.API_KEY_INPUT).value.trim();
  const provider = state.settings.provider;
  
  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }
  
  // Save API key
  await StorageService.saveApiKey(provider, apiKey);
  state.settings.apiKeys[provider] = apiKey;
  
  showStatus('API key saved successfully!', 'success');
  
  // Fetch models for this provider
  await updateModelDropdown();
}

/**
 * Prompt change handler
 */
function onPromptChange() {
  const promptText = $id(DOM_IDS.PROMPT_TEXTAREA).value;
  const isCustomized = promptText && promptText !== CONFIG.DEFAULT_PROMPT;
  
  state.settings.customPrompt = promptText;
  state.settings.isPromptCustomized = isCustomized;
  
  // Update prompt status
  const promptStatus = $id(DOM_IDS.PROMPT_STATUS);
  if (promptStatus) {
    if (isCustomized) {
      promptStatus.textContent = '(Customized)';
      promptStatus.style.color = 'var(--md-sys-color-primary)';
    } else {
      promptStatus.textContent = '(Using default)';
      promptStatus.style.color = '';
    }
  }
  
  debouncedSaveState();
}

/**
 * Reset prompt to default
 */
async function resetPrompt() {
  $id(DOM_IDS.PROMPT_TEXTAREA).value = CONFIG.DEFAULT_PROMPT;
  state.settings.customPrompt = CONFIG.DEFAULT_PROMPT;
  state.settings.isPromptCustomized = false;
  
  const promptStatus = $id(DOM_IDS.PROMPT_STATUS);
  if (promptStatus) {
    promptStatus.textContent = '(Using default)';
    promptStatus.style.color = '';
  }
  
  await StorageService.saveSettings(state.settings);
  showStatus('Prompt reset to default', 'success');
}

/**
 * Max tabs change handler
 */
async function onMaxTabsChange() {
  const maxTabs = parseInt($id(DOM_IDS.MAX_TABS_INPUT).value) || LIMITS.MAX_TABS_DEFAULT;
  
  // Validate range
  if (maxTabs < LIMITS.MIN_TABS_LIMIT) {
    $id(DOM_IDS.MAX_TABS_INPUT).value = LIMITS.MIN_TABS_LIMIT;
    state.settings.maxTabsToOpen = LIMITS.MIN_TABS_LIMIT;
  } else if (maxTabs > LIMITS.MAX_TABS_LIMIT) {
    $id(DOM_IDS.MAX_TABS_INPUT).value = LIMITS.MAX_TABS_LIMIT;
    state.settings.maxTabsToOpen = LIMITS.MAX_TABS_LIMIT;
  } else {
    state.settings.maxTabsToOpen = maxTabs;
  }
  
  await StorageService.saveSettings(state.settings);
}

/**
 * Search input handler
 */
function onSearchInput(e) {
  const query = e.target.value.toLowerCase();
  updateState('searchQuery', query);
  
  // Trigger search update (handled by display module)
  debouncedSaveState();
}

/**
 * Clear search
 */
function clearSearch() {
  $id(DOM_IDS.SEARCH_INPUT).value = '';
  updateState('searchQuery', '');
  
  // Trigger display update
  debouncedSaveState();
}

/**
 * Saved tab search input handler
 */
function onSavedSearchInput(e) {
  const query = e.target.value.toLowerCase();
  // Trigger saved tab search (handled by saved tabs module)
}

/**
 * Clear saved tab search
 */
function clearSavedSearch() {
  $id(DOM_IDS.SAVED_SEARCH_INPUT).value = '';
  // Trigger saved tab display update
}

/**
 * Handle Show All Categories checkbox change
 */
async function handleShowAllCategoriesChange(event) {
  const includeCanClose = event.target.checked;
  const savedGroupingSelect = $id(DOM_IDS.SAVED_GROUPING_SELECT);
  const groupingType = savedGroupingSelect ? savedGroupingSelect.value : 'category';
  
  // Update saved tabs display with new setting
  await showSavedTabsContent(groupingType, includeCanClose);
  
  // Save preference
  updateState('showAllCategories', includeCanClose);
  await savePopupState();
}

// Grouping handlers imported from ui-utilities.js

// Functions are now imported from their respective modules

// Export default object
export default {
  setupEventListeners
};