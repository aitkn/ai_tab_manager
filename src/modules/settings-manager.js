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
  rulesContainer.innerHTML = '';
  
  // Add existing rules
  if (state.settings.rules && state.settings.rules.length > 0) {
    state.settings.rules.forEach((rule, index) => {
      addRuleUI(rule, index);
    });
  } else {
    // Show empty state
    rulesContainer.innerHTML = '<p class="text-muted" style="font-size: 12px; text-align: center; padding: 20px;">No rules defined yet. Click "Add Rule" to create your first rule.</p>';
  }
}

/**
 * Add a rule to the UI
 */
function addRuleUI(rule = null, index = null) {
  const rulesContainer = $id(DOM_IDS.RULES_CONTAINER);
  if (!rulesContainer) return;
  
  // Remove empty state message if present
  if (rulesContainer.querySelector('.text-muted')) {
    rulesContainer.innerHTML = '';
  }
  
  const ruleId = index !== null ? index : Date.now();
  const ruleData = rule || {
    type: RULE_TYPES.DOMAIN,
    value: '',
    category: TAB_CATEGORIES.CAN_CLOSE,
    enabled: true
  };
  
  const ruleElement = document.createElement('div');
  ruleElement.className = 'rule-item';
  ruleElement.dataset.ruleId = ruleId;
  
  ruleElement.innerHTML = `
    <div class="rule-row">
      <select class="rule-type-select" data-rule-id="${ruleId}">
        <option value="${RULE_TYPES.DOMAIN}" ${ruleData.type === RULE_TYPES.DOMAIN ? 'selected' : ''}>Domain equals</option>
        <option value="${RULE_TYPES.URL_CONTAINS}" ${ruleData.type === RULE_TYPES.URL_CONTAINS ? 'selected' : ''}>URL contains</option>
        <option value="${RULE_TYPES.TITLE_CONTAINS}" ${ruleData.type === RULE_TYPES.TITLE_CONTAINS ? 'selected' : ''}>Title contains</option>
        <option value="${RULE_TYPES.REGEX}" ${ruleData.type === RULE_TYPES.REGEX ? 'selected' : ''}>Regex match</option>
      </select>
      
      <input type="text" class="rule-value-input" data-rule-id="${ruleId}" 
             placeholder="${getRulePlaceholder(ruleData.type)}" 
             value="${ruleData.value || ''}">
      
      <select class="rule-category-select" data-rule-id="${ruleId}">
        <option value="${TAB_CATEGORIES.CAN_CLOSE}" ${ruleData.category === TAB_CATEGORIES.CAN_CLOSE ? 'selected' : ''}>${CATEGORY_NAMES[TAB_CATEGORIES.CAN_CLOSE]}</option>
        <option value="${TAB_CATEGORIES.SAVE_LATER}" ${ruleData.category === TAB_CATEGORIES.SAVE_LATER ? 'selected' : ''}>${CATEGORY_NAMES[TAB_CATEGORIES.SAVE_LATER]}</option>
        <option value="${TAB_CATEGORIES.IMPORTANT}" ${ruleData.category === TAB_CATEGORIES.IMPORTANT ? 'selected' : ''}>${CATEGORY_NAMES[TAB_CATEGORIES.IMPORTANT]}</option>
      </select>
      
      <label class="rule-enabled-label">
        <input type="checkbox" class="rule-enabled-checkbox" data-rule-id="${ruleId}" 
               ${ruleData.enabled !== false ? 'checked' : ''}>
        <span>Enabled</span>
      </label>
      
      <button class="icon-btn icon-btn-small delete-rule-btn" data-rule-id="${ruleId}" title="Delete rule">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
    ${ruleData.type === RULE_TYPES.REGEX ? `
      <div class="rule-regex-field">
        <select class="rule-field-select" data-rule-id="${ruleId}">
          <option value="${RULE_FIELDS.URL}" ${ruleData.field === RULE_FIELDS.URL ? 'selected' : ''}>Match against URL</option>
          <option value="${RULE_FIELDS.TITLE}" ${ruleData.field === RULE_FIELDS.TITLE ? 'selected' : ''}>Match against Title</option>
        </select>
      </div>
    ` : ''}
  `;
  
  rulesContainer.appendChild(ruleElement);
  
  // Add event listeners
  const typeSelect = ruleElement.querySelector('.rule-type-select');
  const valueInput = ruleElement.querySelector('.rule-value-input');
  const categorySelect = ruleElement.querySelector('.rule-category-select');
  const enabledCheckbox = ruleElement.querySelector('.rule-enabled-checkbox');
  const deleteBtn = ruleElement.querySelector('.delete-rule-btn');
  const fieldSelect = ruleElement.querySelector('.rule-field-select');
  
  typeSelect.addEventListener('change', (e) => onRuleTypeChange(e, ruleId));
  valueInput.addEventListener('input', () => saveRules());
  categorySelect.addEventListener('change', () => saveRules());
  enabledCheckbox.addEventListener('change', () => saveRules());
  deleteBtn.addEventListener('click', () => deleteRule(ruleId));
  if (fieldSelect) {
    fieldSelect.addEventListener('change', () => saveRules());
  }
}

/**
 * Get placeholder text for rule value input
 */
function getRulePlaceholder(type) {
  switch (type) {
    case RULE_TYPES.DOMAIN:
      return 'e.g., github.com';
    case RULE_TYPES.URL_CONTAINS:
      return 'e.g., /login';
    case RULE_TYPES.TITLE_CONTAINS:
      return 'e.g., Sign in';
    case RULE_TYPES.REGEX:
      return 'e.g., .*\\.pdf$';
    default:
      return '';
  }
}

/**
 * Handle rule type change
 */
function onRuleTypeChange(e, ruleId) {
  const newType = e.target.value;
  const ruleElement = document.querySelector(`[data-rule-id="${ruleId}"]`);
  const valueInput = ruleElement.querySelector('.rule-value-input');
  
  // Update placeholder
  valueInput.placeholder = getRulePlaceholder(newType);
  
  // Show/hide regex field selector
  const existingFieldSelect = ruleElement.querySelector('.rule-regex-field');
  if (newType === RULE_TYPES.REGEX && !existingFieldSelect) {
    const fieldSelectHtml = `
      <div class="rule-regex-field">
        <select class="rule-field-select" data-rule-id="${ruleId}">
          <option value="${RULE_FIELDS.URL}">Match against URL</option>
          <option value="${RULE_FIELDS.TITLE}">Match against Title</option>
        </select>
      </div>
    `;
    ruleElement.insertAdjacentHTML('beforeend', fieldSelectHtml);
    
    const fieldSelect = ruleElement.querySelector('.rule-field-select');
    fieldSelect.addEventListener('change', () => saveRules());
  } else if (newType !== RULE_TYPES.REGEX && existingFieldSelect) {
    existingFieldSelect.remove();
  }
  
  saveRules();
}

/**
 * Delete a rule
 */
function deleteRule(ruleId) {
  const ruleElement = document.querySelector(`[data-rule-id="${ruleId}"]`);
  if (ruleElement) {
    ruleElement.remove();
    saveRules();
    
    // Show empty state if no rules left
    const rulesContainer = $id(DOM_IDS.RULES_CONTAINER);
    if (rulesContainer && rulesContainer.children.length === 0) {
      rulesContainer.innerHTML = '<p class="text-muted" style="font-size: 12px; text-align: center; padding: 20px;">No rules defined yet. Click "Add Rule" to create your first rule.</p>';
    }
  }
}

/**
 * Save all rules to state and storage
 */
function saveRules() {
  const rules = [];
  const ruleElements = document.querySelectorAll('.rule-item');
  
  ruleElements.forEach(ruleElement => {
    const ruleId = ruleElement.dataset.ruleId;
    const type = ruleElement.querySelector('.rule-type-select').value;
    const value = ruleElement.querySelector('.rule-value-input').value.trim();
    const category = parseInt(ruleElement.querySelector('.rule-category-select').value);
    const enabled = ruleElement.querySelector('.rule-enabled-checkbox').checked;
    const fieldSelect = ruleElement.querySelector('.rule-field-select');
    
    if (value) {  // Only save rules with values
      const rule = {
        type,
        value,
        category,
        enabled
      };
      
      if (type === RULE_TYPES.REGEX && fieldSelect) {
        rule.field = fieldSelect.value;
      }
      
      rules.push(rule);
    }
  });
  
  state.settings.rules = rules;
  updateState('settings', state.settings);
  StorageService.saveSettings(state.settings);
}

/**
 * Handle add rule button click
 */
function onAddRule() {
  addRuleUI();
  saveRules();
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
  
  // Rule management
  const addRuleBtn = $id(DOM_IDS.ADD_RULE_BTN);
  if (addRuleBtn) {
    addRuleBtn.addEventListener('click', onAddRule);
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