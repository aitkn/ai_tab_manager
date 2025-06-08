/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Settings Manager - handles all settings UI and persistence
 */

import { DOM_IDS, LIMITS, RULE_TYPES, RULE_FIELDS, TAB_CATEGORIES, CATEGORY_NAMES } from '../utils/constants.js';
import { $id, show, hide } from '../utils/dom-helpers.js';
import { showStatus, hideApiKeyPrompt } from './ui-manager.js';
import { state, updateState } from './state-manager.js';
import StorageService from '../services/StorageService.js';
import MessageService from '../services/MessageService.js';

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Initialize settings UI
 */
export async function initializeSettingsUI() {
  console.log('Initializing settings UI with state:', state.settings);
  
  // Set current provider
  const providerSelect = $id(DOM_IDS.PROVIDER_SELECT);
  if (providerSelect) {
    console.log('Setting provider to:', state.settings.provider);
    providerSelect.value = state.settings.provider;
  } else {
    console.error('Provider select not found');
  }
  
  // Populate models for current provider and wait for it to complete
  await updateModelDropdown();
  
  // Now set current model after dropdown is populated
  const modelSelect = $id(DOM_IDS.MODEL_SELECT);
  if (modelSelect && state.settings.model) {
    console.log('Setting model to:', state.settings.model);
    modelSelect.value = state.settings.model;
  }
  
  // Set API key if exists
  const apiKeyInput = $id(DOM_IDS.API_KEY_INPUT);
  if (apiKeyInput) {
    const apiKey = state.settings.apiKeys[state.settings.provider] || '';
    console.log('Setting API key input for provider:', state.settings.provider, 'Has key:', !!apiKey);
    apiKeyInput.value = apiKey;
    if (CONFIG && CONFIG.PROVIDERS && CONFIG.PROVIDERS[state.settings.provider]) {
      apiKeyInput.placeholder = CONFIG.PROVIDERS[state.settings.provider].apiKeyPlaceholder;
    }
  } else {
    console.error('API key input not found');
  }
  
  // Set API key link
  const apiKeyLink = $id('apiKeyLink');
  if (apiKeyLink && CONFIG?.PROVIDERS?.[state.settings.provider]?.apiKeyUrl) {
    apiKeyLink.href = CONFIG.PROVIDERS[state.settings.provider].apiKeyUrl;
    apiKeyLink.title = `Get ${state.settings.provider} API key`;
  }
  
  // Set custom prompt
  const promptTextarea = $id(DOM_IDS.PROMPT_TEXTAREA);
  if (promptTextarea) {
    const promptValue = state.settings.customPrompt || (CONFIG ? CONFIG.DEFAULT_PROMPT : '');
    console.log('Setting prompt textarea, custom:', !!state.settings.customPrompt, 'Using default:', !state.settings.customPrompt);
    promptTextarea.value = promptValue;
  } else {
    console.error('Prompt textarea not found');
  }
  
  // Set max tabs to open
  const maxTabsInput = $id(DOM_IDS.MAX_TABS_INPUT);
  if (maxTabsInput) {
    maxTabsInput.value = state.settings.maxTabsToOpen || LIMITS.MAX_TABS_DEFAULT;
  }
  
  // Set LLM checkbox
  const useLLMCheckbox = $id('useLLMCheckbox');
  if (useLLMCheckbox) {
    useLLMCheckbox.checked = state.settings.useLLM !== false; // Default to true
    
    // Show/hide LLM settings container based on checkbox state
    const llmSettingsContainer = $id('llmSettingsContainer');
    if (llmSettingsContainer) {
      llmSettingsContainer.style.display = useLLMCheckbox.checked ? 'block' : 'none';
    }
  }
  
  // Update prompt status
  updatePromptStatus();
  
  // Initialize ML dashboard
  try {
    const { initializeMLDashboard } = await import('./ml-dashboard.js');
    await initializeMLDashboard();
  } catch (error) {
    console.log('ML dashboard not available:', error);
    // Clear loading message even if ML module fails
    const statusContent = $id('mlStatusContent');
    if (statusContent) {
      statusContent.innerHTML = '<div style="color: var(--md-sys-color-on-surface-variant);">ML features not available</div>';
    }
  }
  
  // Initialize rules UI
  initializeRulesUI();
}

/**
 * Update model dropdown based on provider
 */
export async function updateModelDropdown() {
  const modelSelect = $id(DOM_IDS.MODEL_SELECT);
  console.log('updateModelDropdown called, modelSelect element:', modelSelect);
  if (!modelSelect) {
    console.error('Model select element not found!');
    return;
  }
  
  // Show loading state
  modelSelect.innerHTML = '<option>Loading models...</option>';
  modelSelect.disabled = true;
  
  try {
    // Try to fetch models dynamically
    const apiKey = state.settings.apiKeys[state.settings.provider];
    const response = await MessageService.fetchModels(state.settings.provider, apiKey);
    console.log('Response from fetchModels:', response);
    
    let models = [];
    let needsApiKey = false;
    
    if (response && response.success) {
      models = response.models || [];
      needsApiKey = response.needsApiKey || false;
      console.log('Fetched models for', state.settings.provider, ':', models);
    } else if (response && response.models) {
      // Handle case where success flag might be missing
      models = response.models;
      console.log('Models found without success flag:', models);
    }
    
    // Clear and populate models
    modelSelect.innerHTML = '';
    console.log('Clearing dropdown, about to populate with', models.length, 'models');
    
    if (needsApiKey || (!apiKey && models.length === 0)) {
      console.log('No API key or no models, showing message');
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Please add API key to see available models';
      modelSelect.appendChild(option);
      modelSelect.disabled = true;
      return;
    }
    
    if (models.length === 0) {
      console.log('No models available');
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No models available';
      modelSelect.appendChild(option);
      modelSelect.disabled = true;
      return;
    }
    
    console.log('Populating dropdown with models');
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      
      // Format display text with release date if available
      let displayText = model.name;
      if (model.created_at) {
        const date = new Date(model.created_at);
        const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        displayText += ` (${dateStr})`;
      } else if (model.created) {
        // OpenAI uses unix timestamp
        const date = new Date(model.created * 1000);
        const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        displayText += ` (${dateStr})`;
      }
      
      option.textContent = displayText;
      modelSelect.appendChild(option);
    });
    
    console.log('Dropdown populated, total options:', modelSelect.options.length);
    
    // Check if we have a previously selected model for this provider
    const previouslySelected = state.settings.selectedModels[state.settings.provider];
    console.log('Previously selected model for', state.settings.provider, ':', previouslySelected);
    console.log('Current model in settings:', state.settings.model);
    console.log('Available models:', models.map(m => m.id));
    
    if (previouslySelected && models.some(m => m.id === previouslySelected)) {
      // Use previously selected model
      console.log('Using previously selected model:', previouslySelected);
      modelSelect.value = previouslySelected;
      state.settings.model = previouslySelected;
    } else if (models.some(m => m.id === state.settings.model)) {
      // Use current model if available
      console.log('Using current model:', state.settings.model);
      modelSelect.value = state.settings.model;
    } else if (models.length > 0) {
      // Default to first available model
      console.log('Defaulting to first model:', models[0].id);
      state.settings.model = models[0].id;
      modelSelect.value = state.settings.model;
    }
    
    // Save the selected model for this provider
    if (state.settings.model) {
      state.settings.selectedModels[state.settings.provider] = state.settings.model;
      await StorageService.saveSettings(state.settings);
    }
  } catch (error) {
    console.error('Error updating models:', error);
    modelSelect.innerHTML = '<option value="">Error loading models</option>';
    modelSelect.disabled = true;
  } finally {
    if (modelSelect.options.length > 0 && modelSelect.options[0].value) {
      modelSelect.disabled = false;
    }
  }
}

/**
 * Handle provider change
 */
export async function onProviderChange(e) {
  state.settings.provider = e.target.value;
  updateState('settings', state.settings);
  
  await updateModelDropdown();
  
  // Update API key placeholder
  const apiKeyInput = $id(DOM_IDS.API_KEY_INPUT);
  if (apiKeyInput) {
    apiKeyInput.value = state.settings.apiKeys[state.settings.provider] || '';
    apiKeyInput.placeholder = CONFIG.PROVIDERS[state.settings.provider].apiKeyPlaceholder;
  }
  
  // Update API key link
  const apiKeyLink = $id('apiKeyLink');
  if (apiKeyLink && CONFIG?.PROVIDERS?.[state.settings.provider]?.apiKeyUrl) {
    apiKeyLink.href = CONFIG.PROVIDERS[state.settings.provider].apiKeyUrl;
    apiKeyLink.title = `Get ${state.settings.provider} API key`;
  }
  
  await StorageService.saveSettings(state.settings);
}

/**
 * Handle model change
 */
export async function onModelChange(e) {
  state.settings.model = e.target.value;
  // Save the selected model for the current provider
  state.settings.selectedModels[state.settings.provider] = state.settings.model;
  updateState('settings', state.settings);
  
  await StorageService.saveSettings(state.settings);
}

/**
 * Save API key
 */
export async function saveApiKey() {
  const input = $id(DOM_IDS.API_KEY_INPUT);
  const key = input.value.trim();
  
  if (key) {
    await StorageService.saveApiKey(state.settings.provider, key);
    state.settings.apiKeys[state.settings.provider] = key;
    updateState('settings', state.settings);
    
    showStatus(`API key saved for ${state.settings.provider}!`, 'success');
    
    // Hide API prompt if it was showing
    hideApiKeyPrompt();
    
    // Refresh models with the new API key
    await updateModelDropdown();
  }
}

/**
 * Handle prompt change
 */
export function onPromptChange(e) {
  state.settings.customPrompt = e.target.value;
  // Mark as customized if different from default
  state.settings.isPromptCustomized = (e.target.value !== CONFIG.DEFAULT_PROMPT && e.target.value !== '');
  updateState('settings', state.settings);
  
  StorageService.saveSettings(state.settings);
  updatePromptStatus();
}

/**
 * Reset prompt to default
 */
export function resetPrompt() {
  state.settings.customPrompt = CONFIG.DEFAULT_PROMPT;
  state.settings.isPromptCustomized = false;
  state.settings.promptVersion = CONFIG.PROMPT_VERSION;
  updateState('settings', state.settings);
  
  const promptTextarea = $id(DOM_IDS.PROMPT_TEXTAREA);
  if (promptTextarea) {
    promptTextarea.value = CONFIG.DEFAULT_PROMPT;
  }
  
  StorageService.saveSettings(state.settings);
  updatePromptStatus();
  showStatus('Prompt reset to default', 'success');
}

/**
 * Update prompt status indicator
 */
export function updatePromptStatus() {
  const promptStatus = $id(DOM_IDS.PROMPT_STATUS);
  if (!promptStatus) return;
  
  const currentPrompt = state.settings.customPrompt || '';
  const isDefault = currentPrompt === CONFIG.DEFAULT_PROMPT || currentPrompt === '';
  
  if (isDefault && !state.settings.isPromptCustomized) {
    promptStatus.textContent = `(Using default prompt v${CONFIG.PROMPT_VERSION})`;
    promptStatus.style.color = 'var(--text-muted)';
  } else if (state.settings.isPromptCustomized) {
    promptStatus.textContent = '(Using custom prompt)';
    promptStatus.style.color = 'var(--warning-color)';
  } else {
    // Edge case: prompt matches default but was previously customized
    promptStatus.textContent = '(Using default prompt)';
    promptStatus.style.color = 'var(--text-muted)';
  }
}

/**
 * Handle max tabs change
 */
export function onMaxTabsChange(e) {
  const value = parseInt(e.target.value);
  if (!isNaN(value) && value >= LIMITS.MIN_TABS_LIMIT && value <= LIMITS.MAX_TABS_LIMIT) {
    state.settings.maxTabsToOpen = value;
    updateState('settings', state.settings);
    
    StorageService.saveSettings(state.settings);
    showStatus(`Max tabs to open set to ${value}`, 'success');
  } else {
    // Reset to previous value if invalid
    e.target.value = state.settings.maxTabsToOpen || LIMITS.MAX_TABS_DEFAULT;
    showStatus(`Please enter a value between ${LIMITS.MIN_TABS_LIMIT} and ${LIMITS.MAX_TABS_LIMIT}`, 'error');
  }
}

/**
 * Initialize rules UI
 */
export function initializeRulesUI() {
  const rulesContainer = $id(DOM_IDS.RULES_CONTAINER);
  if (!rulesContainer) return;
  
  // Clear existing rules
  rulesContainer.querySelectorAll('.rules-list').forEach(list => {
    list.innerHTML = '';
    updateEmptyState(list);
  });
  
  // Add existing rules
  if (state.settings.rules && state.settings.rules.length > 0) {
    console.log('Initializing rules UI with', state.settings.rules.length, 'rules');
    state.settings.rules.forEach((rule, index) => {
      if (rule.enabled !== false) {
        addRuleToUI(rule.category, rule);
      }
    });
  } else {
    console.log('No rules found in settings during initialization');
  }
  
  // Add event listeners to add buttons
  rulesContainer.querySelectorAll('.add-rule-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const category = parseInt(e.currentTarget.dataset.category);
      addRuleToUI(category);
    });
  });
}

/**
 * Update empty state visibility
 */
function updateEmptyState(tbody) {
  const wrapper = tbody.closest('.rules-table-wrapper');
  const table = wrapper.querySelector('.rules-table');
  const emptyState = wrapper.querySelector('.rules-empty-state');
  
  if (tbody.children.length === 0) {
    table.style.display = 'none';
    emptyState.style.display = 'block';
  } else {
    table.style.display = 'table';
    emptyState.style.display = 'none';
  }
}


/**
 * Add a rule to the UI
 */
function addRuleToUI(category, rule = null) {
  const tbody = document.querySelector(`.rules-list[data-category="${category}"]`);
  if (!tbody) return;
  
  const ruleId = Date.now() + Math.random();
  const tr = document.createElement('tr');
  tr.dataset.ruleId = ruleId;
  
  const urlValue = rule?.field !== 'title' ? (rule?.value || '') : '';
  const titleValue = rule?.field === 'title' ? (rule?.value || '') : '';
  const urlIsRegex = rule?.field !== 'title' && rule?.type === 'regex';
  const titleIsRegex = rule?.field === 'title' && rule?.type === 'regex';
  
  // Escape HTML to prevent XSS
  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };
  
  tr.innerHTML = `
    <td>
      <input type="text" class="rule-input rule-url-input" 
             value="${escapeHtml(urlValue)}" 
             placeholder="e.g., youtube.com/watch">
    </td>
    <td>
      <input type="checkbox" class="rule-regex-checkbox rule-url-regex" 
             ${urlIsRegex ? 'checked' : ''} 
             title="Check to use regular expression matching">
    </td>
    <td>
      <input type="text" class="rule-input rule-title-input" 
             value="${escapeHtml(titleValue)}" 
             placeholder="e.g., YouTube">
    </td>
    <td>
      <input type="checkbox" class="rule-regex-checkbox rule-title-regex" 
             ${titleIsRegex ? 'checked' : ''} 
             title="Check to use regular expression matching">
    </td>
    <td>
      <button class="delete-rule-btn" title="Delete rule">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </td>
  `;
  
  tbody.appendChild(tr);
  updateEmptyState(tbody);
  
  // Add event listeners
  const urlInput = tr.querySelector('.rule-url-input');
  const titleInput = tr.querySelector('.rule-title-input');
  const urlRegex = tr.querySelector('.rule-url-regex');
  const titleRegex = tr.querySelector('.rule-title-regex');
  const deleteBtn = tr.querySelector('.delete-rule-btn');
  
  urlInput.addEventListener('input', debounce(saveRulesFromUI, 500));
  titleInput.addEventListener('input', debounce(saveRulesFromUI, 500));
  urlRegex.addEventListener('change', saveRulesFromUI);
  titleRegex.addEventListener('change', saveRulesFromUI);
  deleteBtn.addEventListener('click', () => {
    tr.remove();
    updateEmptyState(tbody);
    saveRulesFromUI();
  });
}

/**
 * Save rules from UI
 */
function saveRulesFromUI() {
  const rules = [];
  const rulesContainer = $id(DOM_IDS.RULES_CONTAINER);
  if (!rulesContainer) return;
  
  // Process each rule row
  rulesContainer.querySelectorAll('tbody tr').forEach(tr => {
    const category = parseInt(tr.closest('.rule-category-section').dataset.category);
    const urlInput = tr.querySelector('.rule-url-input');
    const titleInput = tr.querySelector('.rule-title-input');
    const urlIsRegex = tr.querySelector('.rule-url-regex').checked;
    const titleIsRegex = tr.querySelector('.rule-title-regex').checked;
    
    // Add URL rule if present
    if (urlInput.value.trim()) {
      rules.push({
        type: urlIsRegex ? 'regex' : 'url_contains',
        value: urlInput.value.trim(),
        field: 'url',
        category: category,
        enabled: true
      });
    }
    
    // Add title rule if present
    if (titleInput.value.trim()) {
      rules.push({
        type: titleIsRegex ? 'regex' : 'title_contains',
        value: titleInput.value.trim(),
        field: 'title',
        category: category,
        enabled: true
      });
    }
  });
  
  state.settings.rules = rules;
  updateState('settings', state.settings);
  StorageService.saveSettings(state.settings);
}


/**
 * Restore default rules
 */
async function onRestoreDefaultRules() {
  const confirmed = confirm('This will replace all your current rules with the default rules. Are you sure?');
  if (!confirmed) return;
  
  // Import the getDefaultRules function from state-manager
  const { getDefaultRules } = await import('./state-manager.js');
  
  const defaultRules = getDefaultRules();
  
  // Replace current rules with default rules
  state.settings.rules = defaultRules;
  await StorageService.saveSettings(state.settings);
  
  // Refresh the UI
  initializeRulesUI();
  
  showStatus('Default rules restored successfully', 'success', 3000);
}

/**
 * Initialize settings event handlers
 */
export async function initializeSettings() {
  // Provider change
  const providerSelect = $id(DOM_IDS.PROVIDER_SELECT);
  if (providerSelect) {
    providerSelect.addEventListener('change', onProviderChange);
  }
  
  // Model change
  const modelSelect = $id(DOM_IDS.MODEL_SELECT);
  if (modelSelect) {
    modelSelect.addEventListener('change', onModelChange);
  }
  
  // API key save
  const saveApiKeyBtn = $id(DOM_IDS.SAVE_API_KEY_BTN);
  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', saveApiKey);
  }
  
  // Prompt changes
  const promptTextarea = $id(DOM_IDS.PROMPT_TEXTAREA);
  if (promptTextarea) {
    promptTextarea.addEventListener('input', onPromptChange);
  }
  
  const resetPromptBtn = $id(DOM_IDS.RESET_PROMPT_BTN);
  if (resetPromptBtn) {
    resetPromptBtn.addEventListener('click', resetPrompt);
  }
  
  // Max tabs change
  const maxTabsInput = $id(DOM_IDS.MAX_TABS_INPUT);
  if (maxTabsInput) {
    maxTabsInput.addEventListener('change', onMaxTabsChange);
  }
  
  // Rules are now handled by the grouped UI with textareas
  
  // Restore default rules button
  const restoreBtn = $id('restoreDefaultRulesBtn');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', onRestoreDefaultRules);
  }
  
  // Initialize UI with current settings
  await initializeSettingsUI();
  
  // Initialize rules UI
  initializeRulesUI();
}

// Export default object
export default {
  initializeSettingsUI,
  updateModelDropdown,
  onProviderChange,
  onModelChange,
  saveApiKey,
  onPromptChange,
  resetPrompt,
  updatePromptStatus,
  onMaxTabsChange,
  initializeSettings,
  initializeRulesUI
};