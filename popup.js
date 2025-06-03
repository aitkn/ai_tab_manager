/*
 * AI Tab Manager - Copyright (c) 2024 AI Tech Knowledge LLC
 * Proprietary License - See LICENSE file
 * support@aitkn.com
 */

let categorizedTabs = { 1: [], 2: [], 3: [] };
let currentGrouping = 'category';
let isViewingSaved = false;
let searchQuery = '';
let settings = {
  provider: CONFIG.DEFAULT_PROVIDER,
  model: CONFIG.DEFAULT_MODEL,
  apiKeys: {},
  selectedModels: {}, // Store selected model per provider
  customPrompt: CONFIG.DEFAULT_PROMPT // Store custom prompt, default to CONFIG prompt
};

document.addEventListener('DOMContentLoaded', async function() {
  console.log('Popup loaded, initializing...');
  
  try {
    // Check for unauthorized copies
    checkExtensionIntegrity();
    
    // Initialize theme
    initializeTheme();
    
    // Initialize database
    await tabDatabase.init();
    console.log('Database initialized');
    
    // Load settings from storage
    const stored = await chrome.storage.local.get(['settings']);
    if (stored.settings) {
      settings = { ...settings, ...stored.settings };
    }
    console.log('Loaded settings:', settings);
    
    // Set up event listeners
    document.getElementById('categorizeBtn').addEventListener('click', handleCategorize);
    document.getElementById('saveAndCloseAllBtn').addEventListener('click', () => saveAndCloseAll());
    document.getElementById('saveApiKeyBtn').addEventListener('click', saveApiKey);
    document.getElementById('settingsBtn').addEventListener('click', showSettings);
    document.getElementById('closeSettingsBtn').addEventListener('click', hideSettings);
    document.getElementById('openSettingsBtn').addEventListener('click', showSettings);
    document.getElementById('providerSelect').addEventListener('change', onProviderChange);
    document.getElementById('modelSelect').addEventListener('change', onModelChange);
    document.getElementById('promptTextarea').addEventListener('input', onPromptChange);
    document.getElementById('resetPromptBtn').addEventListener('click', resetPrompt);
    document.getElementById('viewSavedBtn').addEventListener('click', showSavedTabs);
    document.getElementById('groupingSelect').addEventListener('change', onGroupingChange);
    document.getElementById('searchInput').addEventListener('input', onSearchInput);
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    
    // Theme switcher buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => setTheme(btn.dataset.theme));
    });
    
    // Initialize settings UI
    initializeSettingsUI();
    
    // Check if API key exists for current provider
    if (!settings.apiKeys[settings.provider]) {
      console.log('No API key found for', settings.provider);
      showApiKeyPrompt();
    }
    
    // Test background script connection
    try {
      const testResponse = await chrome.runtime.sendMessage({ action: 'test' });
      console.log('Background script test response:', testResponse);
    } catch (e) {
      console.error('Failed to connect to background script:', e);
    }
    
  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

function showApiKeyPrompt() {
  document.getElementById('apiKeyPrompt').style.display = 'block';
}

function showSettings() {
  document.getElementById('settingsPanel').style.display = 'block';
  document.getElementById('apiKeyPrompt').style.display = 'none';
  document.getElementById('tabsContainer').style.display = 'none';
}

function hideSettings() {
  document.getElementById('settingsPanel').style.display = 'none';
}

function initializeSettingsUI() {
  // Set current provider
  document.getElementById('providerSelect').value = settings.provider;
  
  // Populate models for current provider
  updateModelDropdown();
  
  // Set current model
  document.getElementById('modelSelect').value = settings.model;
  
  // Set API key if exists
  const apiKeyInput = document.getElementById('apiKeyInput');
  apiKeyInput.value = settings.apiKeys[settings.provider] || '';
  apiKeyInput.placeholder = CONFIG.PROVIDERS[settings.provider].apiKeyPlaceholder;
  
  // Set custom prompt
  const promptTextarea = document.getElementById('promptTextarea');
  promptTextarea.value = settings.customPrompt || CONFIG.DEFAULT_PROMPT;
  
  // Update prompt status
  updatePromptStatus();
}

async function updateModelDropdown() {
  const modelSelect = document.getElementById('modelSelect');
  const provider = CONFIG.PROVIDERS[settings.provider];
  
  // Show loading state
  modelSelect.innerHTML = '<option>Loading models...</option>';
  modelSelect.disabled = true;
  
  try {
    // Try to fetch models dynamically
    const apiKey = settings.apiKeys[settings.provider];
    let models = [];
    let needsApiKey = false;
    
    const response = await chrome.runtime.sendMessage({
      action: 'fetchModels',
      data: { provider: settings.provider, apiKey }
    });
    
    if (response && response.success) {
      models = response.models || [];
      needsApiKey = response.needsApiKey || false;
      console.log('Fetched models for', settings.provider, ':', models);
    }
    
    // Clear and populate models
    modelSelect.innerHTML = '';
    
    if (needsApiKey) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Please enter API key first';
      modelSelect.appendChild(option);
      modelSelect.disabled = true;
      return;
    }
    
    if (models.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No models available';
      modelSelect.appendChild(option);
      modelSelect.disabled = true;
      return;
    }
    
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
    
    // Check if we have a previously selected model for this provider
    const previouslySelected = settings.selectedModels[settings.provider];
    
    if (previouslySelected && models.some(m => m.id === previouslySelected)) {
      // Use previously selected model
      modelSelect.value = previouslySelected;
      settings.model = previouslySelected;
    } else if (models.some(m => m.id === settings.model)) {
      // Use current model if available
      modelSelect.value = settings.model;
    } else {
      // Default to first available model
      settings.model = models[0].id;
      modelSelect.value = settings.model;
    }
    
    // Save the selected model for this provider
    settings.selectedModels[settings.provider] = settings.model;
    await saveSettings();
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

async function onProviderChange(e) {
  settings.provider = e.target.value;
  updateModelDropdown();
  
  // Update API key placeholder
  const apiKeyInput = document.getElementById('apiKeyInput');
  apiKeyInput.value = settings.apiKeys[settings.provider] || '';
  apiKeyInput.placeholder = CONFIG.PROVIDERS[settings.provider].apiKeyPlaceholder;
  
  await saveSettings();
}

async function onModelChange(e) {
  settings.model = e.target.value;
  // Save the selected model for the current provider
  settings.selectedModels[settings.provider] = settings.model;
  await saveSettings();
}

async function saveApiKey() {
  const input = document.getElementById('apiKeyInput');
  const key = input.value.trim();
  
  if (key) {
    settings.apiKeys[settings.provider] = key;
    await saveSettings();
    showStatus(`API key saved for ${settings.provider}!`, 'success');
    
    // Hide API prompt if it was showing
    document.getElementById('apiKeyPrompt').style.display = 'none';
    
    // Refresh models with the new API key
    await updateModelDropdown();
  }
}

async function saveSettings() {
  await chrome.storage.local.set({ settings });
  console.log('Settings saved:', settings);
}

async function handleCategorize() {
  console.log('handleCategorize called');
  const statusDiv = document.getElementById('status');
  const tabsContainer = document.getElementById('tabsContainer');
  
  // Check for API key
  const apiKey = settings.apiKeys[settings.provider];
  
  if (!apiKey) {
    console.log('No API key available for', settings.provider);
    showApiKeyPrompt();
    return;
  }
  
  console.log('Using provider:', settings.provider, 'Model:', settings.model);
  console.log('API key:', apiKey.substring(0, 10) + '...');
  
  // Check if using custom prompt
  const isCustomPrompt = settings.customPrompt && settings.customPrompt !== CONFIG.DEFAULT_PROMPT;
  const statusMessage = isCustomPrompt 
    ? 'Gathering and categorizing tabs (custom prompt)...' 
    : 'Gathering and categorizing tabs...';
  showStatus(statusMessage, 'loading');
  
  try {
    // Get all tabs
    console.log('Querying tabs...');
    const tabs = await chrome.tabs.query({});
    console.log('Found', tabs.length, 'tabs');
    
    // Prepare tabs data for Claude
    const tabsData = tabs.map(tab => {
      let domain = 'unknown';
      try {
        if (tab.url && tab.url.startsWith('http')) {
          domain = new URL(tab.url).hostname;
        } else if (tab.url) {
          // Handle chrome:// and other protocols
          domain = tab.url.split('/')[2] || 'chrome';
        }
      } catch (e) {
        console.warn('Failed to parse URL:', tab.url, e);
      }
      
      return {
        id: tab.id,
        title: tab.title || 'Untitled',
        url: tab.url || '',
        domain: domain,
        windowId: tab.windowId,
        lastAccessed: tab.lastAccessed
      };
    });
    
    // Categorize tabs using selected LLM
    const categorized = await categorizeTabs(tabsData, apiKey, settings.provider, settings.model, settings.customPrompt);
    
    // Ensure categorized has all required categories
    categorizedTabs = {
      1: categorized[1] || [],
      2: categorized[2] || [],
      3: categorized[3] || []
    };
    
    console.log('Categorized tabs:', {
      category1: categorizedTabs[1].length,
      category2: categorizedTabs[2].length,
      category3: categorizedTabs[3].length
    });
    
    // Display categorized tabs
    displayTabs();
    
    // Show action buttons
    document.querySelector('.action-buttons').style.display = 'flex';
    document.getElementById('tabsContainer').style.display = 'block';
    
    // Remove any existing back button
    const existingBackBtn = document.getElementById('backToSaved');
    if (existingBackBtn) {
      existingBackBtn.remove();
    }
    
    // Reset grouping to category
    currentGrouping = 'category';
    const groupingSelect = document.getElementById('groupingSelect');
    if (groupingSelect) {
      groupingSelect.value = 'category';
    }
    
    showStatus(`Categorized ${tabs.length} tabs`, 'success');
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    console.error('Categorization error:', error);
  }
}

async function categorizeTabs(tabs, apiKey, provider, model, customPrompt) {
  console.log('Attempting to categorize', tabs.length, 'tabs using', provider, model);
  
  try {
    console.log('Sending message to background script...');
    
    // Check if background script is available
    if (!chrome.runtime?.sendMessage) {
      throw new Error('Chrome runtime not available');
    }
    
    // Send message to background script
    const response = await chrome.runtime.sendMessage({
      action: 'categorizeTabs',
      data: { tabs, apiKey, provider, model, customPrompt }
    });
    
    console.log('Received response from background:', response);
    
    if (!response) {
      throw new Error('No response from background script');
    }
    
    if (response.error) {
      console.error('Background script returned error:', response.error);
      if (response.stack) {
        console.error('Stack trace:', response.stack);
      }
      throw new Error(response.error);
    }
    
    if (response.success && response.data) {
      console.log('Successfully categorized tabs using Claude API');
      return response.data;
    }
    
    throw new Error('Invalid response from background script');
  } catch (error) {
    console.warn('Claude API not available, using rule-based categorization instead');
    console.error('Full error object:', error);
    console.log('Error name:', error.name);
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    // Fallback categorization based on rules
    return fallbackCategorization(tabs);
  }
}

function fallbackCategorization(tabs) {
  const organized = { 1: [], 2: [], 3: [] };
  
  // Common error page patterns
  const errorPatterns = [
    /^(404|403|500|502|503|error|not found|access denied|forbidden|bad gateway|service unavailable)/i,
    /this site can.?t be reached/i,
    /err_.*$/i,
    /page not found/i,
    /the page you were looking for doesn.?t exist/i,
    /gateway time.?out/i,
    /internal server error/i
  ];
  
  tabs.forEach(tab => {
    const domain = tab.domain;
    const title = tab.title.toLowerCase();
    const url = tab.url.toLowerCase();
    
    // Check if it's an error page
    const isErrorPage = errorPatterns.some(pattern => pattern.test(title));
    
    // Category 1: Error pages, frequent domains, or empty tabs - CHECK FIRST
    if (isErrorPage ||
        CONFIG.FREQUENT_DOMAINS.some(freq => domain.includes(freq)) || 
        title === 'new tab' || 
        url.includes('chrome://') ||
        url.includes('/home') ||
        url.includes('inbox')) {
      organized[1].push(tab);
    }
    // Category 3: LLM conversations, documentation, github repos
    else if (url.includes('claude.ai/chat') || 
        url.includes('chatgpt.com/c/') || 
        url.includes('grok.com/chat') ||
        url.includes('gemini.google.com/app') ||
        (url.includes('github.com') && !url.endsWith('github.com/')) ||
        url.includes('/docs/') ||
        url.includes('documentation') ||
        url.includes('supabase.com/dashboard')) {
      organized[3].push(tab);
    }
    // Category 2: Everything else
    else {
      organized[2].push(tab);
    }
  });
  
  // Sort by domain
  Object.keys(organized).forEach(cat => {
    organized[cat].sort((a, b) => a.domain.localeCompare(b.domain));
  });
  
  console.log('Fallback categorization complete:', {
    category1: organized[1].length,
    category2: organized[2].length,
    category3: organized[3].length
  });
  
  return organized;
}

function displayTabs(isFromSaved = false) {
  try {
    isViewingSaved = isFromSaved;
    
    // Show grouping controls for saved tabs
    const groupingControls = document.getElementById('groupingControls');
    if (groupingControls) {
      groupingControls.style.display = isFromSaved ? 'flex' : 'none';
    }
    
    // Display based on current grouping
    if (currentGrouping === 'category') {
      displayCategoryView(isFromSaved);
    } else {
      displayGroupedView(currentGrouping, isFromSaved);
    }
  } catch (error) {
    console.error('Error in displayTabs:', error);
    throw error;
  }
}

function displayCategoryView(isFromSaved = false) {
  // Show category view, hide grouped view
  document.getElementById('categoryView').style.display = 'block';
  document.getElementById('groupedView').style.display = 'none';
  
  // Display each category
  [3, 2, 1].forEach(category => {
    const section = document.getElementById(`category${category}`);
    if (!section) {
      console.error(`Category section not found: category${category}`);
      return;
    }
    
    const listContainer = section.querySelector('.tabs-list');
    const countSpan = section.querySelector('.count');
    
    if (!listContainer || !countSpan) {
      console.error(`Missing elements in category ${category}:`, { listContainer, countSpan });
      return;
    }
    
    const tabs = categorizedTabs[category] || [];
    
    countSpan.textContent = tabs.length;
    listContainer.innerHTML = '';
    
    // Add action buttons based on category and context
    if (!isFromSaved && tabs.length > 0) {
      const actionBar = document.createElement('div');
      actionBar.className = 'category-action-bar';
      
      if (category === 1) {
        // Category 1: Can Be Closed - Add Close button
        const closeAllBtn = document.createElement('button');
        closeAllBtn.className = 'action-btn danger-btn';
        closeAllBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg> Close All';
        closeAllBtn.onclick = () => closeAllInCategory(category);
        actionBar.appendChild(closeAllBtn);
      } else {
        // Categories 2 & 3: Add Save and Close button
        const saveCloseBtn = document.createElement('button');
        saveCloseBtn.className = 'action-btn primary-btn';
        saveCloseBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg> Save & Close';
        saveCloseBtn.onclick = () => saveAndCloseCategory(category);
        actionBar.appendChild(saveCloseBtn);
      }
      
      listContainer.appendChild(actionBar);
    } else if (isFromSaved && tabs.length > 0) {
      const openAllBtn = document.createElement('button');
      openAllBtn.className = 'open-all-btn';
      openAllBtn.textContent = `Open All ${tabs.length} tabs`;
      openAllBtn.onclick = () => openAllTabsInCategory(category);
      listContainer.appendChild(openAllBtn);
    }
    
    tabs.forEach(tab => {
      const tabElement = createTabElement(tab, category, isFromSaved);
      listContainer.appendChild(tabElement);
    });
  });
}

function displayGroupedView(groupBy, isFromSaved = false) {
  // Hide category view, show grouped view
  document.getElementById('categoryView').style.display = 'none';
  document.getElementById('groupedView').style.display = 'block';
  
  const groupedView = document.getElementById('groupedView');
  groupedView.innerHTML = '';
  
  // Combine all tabs
  const allTabs = [];
  [1, 2, 3].forEach(category => {
    categorizedTabs[category].forEach(tab => {
      allTabs.push({ ...tab, category });
    });
  });
  
  // Group tabs based on criteria
  let groups = {};
  
  switch (groupBy) {
    case 'domain':
      groups = groupByDomain(allTabs);
      break;
    case 'savedDate':
      groups = groupBySavedDate(allTabs);
      break;
    case 'savedWeek':
      groups = groupBySavedWeek(allTabs);
      break;
    case 'savedMonth':
      groups = groupBySavedMonth(allTabs);
      break;
  }
  
  // Display groups
  Object.entries(groups).forEach(([groupName, tabs]) => {
    const groupSection = createGroupSection(groupName, tabs, groupBy, isFromSaved);
    groupedView.appendChild(groupSection);
  });
}

function groupByDomain(tabs) {
  const groups = {};
  tabs.forEach(tab => {
    const domain = tab.domain || 'unknown';
    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(tab);
  });
  
  // Sort domains alphabetically
  const sortedGroups = {};
  Object.keys(groups).sort().forEach(key => {
    sortedGroups[key] = groups[key];
  });
  
  return sortedGroups;
}

function groupByDate(tabs) {
  const groups = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  tabs.forEach(tab => {
    // Use lastAccessed if available, otherwise use current date
    const tabDate = tab.lastAccessed ? new Date(tab.lastAccessed) : new Date();
    tabDate.setHours(0, 0, 0, 0);
    
    let groupName;
    const daysDiff = Math.floor((today - tabDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      groupName = 'Today';
    } else if (daysDiff === 1) {
      groupName = 'Yesterday';
    } else if (daysDiff < 7) {
      groupName = `${daysDiff} days ago`;
    } else {
      groupName = tabDate.toLocaleDateString();
    }
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
  });
  
  return groups;
}

function groupByWeek(tabs) {
  const groups = {};
  const today = new Date();
  const currentWeek = getWeekNumber(today);
  const currentYear = today.getFullYear();
  
  tabs.forEach(tab => {
    const tabDate = tab.lastAccessed ? new Date(tab.lastAccessed) : new Date();
    const tabWeek = getWeekNumber(tabDate);
    const tabYear = tabDate.getFullYear();
    
    let groupName;
    if (tabYear === currentYear && tabWeek === currentWeek) {
      groupName = 'This Week';
    } else if (tabYear === currentYear && tabWeek === currentWeek - 1) {
      groupName = 'Last Week';
    } else {
      groupName = `Week ${tabWeek}, ${tabYear}`;
    }
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
  });
  
  return groups;
}

function groupByMonth(tabs) {
  const groups = {};
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  tabs.forEach(tab => {
    const tabDate = tab.lastAccessed ? new Date(tab.lastAccessed) : new Date();
    const tabMonth = tabDate.getMonth();
    const tabYear = tabDate.getFullYear();
    
    let groupName;
    if (tabYear === currentYear && tabMonth === currentMonth) {
      groupName = 'This Month';
    } else if (tabYear === currentYear && tabMonth === currentMonth - 1) {
      groupName = 'Last Month';
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      groupName = `${monthNames[tabMonth]} ${tabYear}`;
    }
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
  });
  
  return groups;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Group by saved date
function groupBySavedDate(tabs) {
  const groups = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  tabs.forEach(tab => {
    const savedDate = new Date(tab.savedAt);
    savedDate.setHours(0, 0, 0, 0);
    
    let groupName;
    const daysDiff = Math.floor((today - savedDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      groupName = 'Saved Today';
    } else if (daysDiff === 1) {
      groupName = 'Saved Yesterday';
    } else if (daysDiff < 7) {
      groupName = `Saved ${daysDiff} days ago`;
    } else {
      groupName = `Saved ${savedDate.toLocaleDateString()}`;
    }
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
  });
  
  return groups;
}

// Group by saved week
function groupBySavedWeek(tabs) {
  const groups = {};
  const today = new Date();
  const currentWeek = getWeekNumber(today);
  const currentYear = today.getFullYear();
  
  tabs.forEach(tab => {
    const savedDate = new Date(tab.savedAt);
    const savedWeek = getWeekNumber(savedDate);
    const savedYear = savedDate.getFullYear();
    
    let groupName;
    if (savedYear === currentYear && savedWeek === currentWeek) {
      groupName = 'Saved This Week';
    } else if (savedYear === currentYear && savedWeek === currentWeek - 1) {
      groupName = 'Saved Last Week';
    } else {
      groupName = `Saved Week ${savedWeek}, ${savedYear}`;
    }
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
  });
  
  return groups;
}

// Group by saved month
function groupBySavedMonth(tabs) {
  const groups = {};
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  tabs.forEach(tab => {
    const savedDate = new Date(tab.savedAt);
    const savedMonth = savedDate.getMonth();
    const savedYear = savedDate.getFullYear();
    
    let groupName;
    if (savedYear === currentYear && savedMonth === currentMonth) {
      groupName = 'Saved This Month';
    } else if (savedYear === currentYear && savedMonth === currentMonth - 1) {
      groupName = 'Saved Last Month';
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      groupName = `Saved ${monthNames[savedMonth]} ${savedYear}`;
    }
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
  });
  
  return groups;
}

function createGroupSection(groupName, tabs, groupType, isFromSaved) {
  const section = document.createElement('div');
  section.className = `group-section ${groupType}-group`;
  
  const header = document.createElement('div');
  header.className = 'group-header';
  
  const titleDiv = document.createElement('div');
  titleDiv.className = 'group-title';
  
  // Icon based on group type
  let iconSvg = '';
  switch (groupType) {
    case 'domain': 
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
      break;
    case 'savedDate':
    case 'savedWeek':
    case 'savedMonth':
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
      break;
  }
  
  titleDiv.innerHTML = `${iconSvg}<span>${groupName}</span>`;
  
  const stats = document.createElement('div');
  stats.className = 'group-stats';
  
  // Count by category
  const categoryCounts = { 1: 0, 2: 0, 3: 0 };
  tabs.forEach(tab => {
    categoryCounts[tab.category]++;
  });
  
  stats.innerHTML = `
    ${categoryCounts[3] > 0 ? `<span class="stat-item important"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ${categoryCounts[3]}</span>` : ''}
    ${categoryCounts[2] > 0 ? `<span class="stat-item somewhat"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg> ${categoryCounts[2]}</span>` : ''}
    ${categoryCounts[1] > 0 ? `<span class="stat-item not-important"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> ${categoryCounts[1]}</span>` : ''}
    <span class="stat-item total">Total: ${tabs.length}</span>
  `;
  
  header.appendChild(titleDiv);
  header.appendChild(stats);
  
  const listContainer = document.createElement('div');
  listContainer.className = 'tabs-list';
  
  // Add 'Open All' button for saved collections
  if (isFromSaved && tabs.length > 0) {
    const openAllBtn = document.createElement('button');
    openAllBtn.className = 'open-all-btn';
    openAllBtn.textContent = `Open All ${tabs.length} tabs`;
    openAllBtn.onclick = () => openAllTabsInGroup(tabs);
    listContainer.appendChild(openAllBtn);
  }
  
  // Sort tabs within group by category (important first)
  tabs.sort((a, b) => b.category - a.category);
  
  tabs.forEach(tab => {
    const tabElement = createTabElement(tab, tab.category, isFromSaved);
    listContainer.appendChild(tabElement);
  });
  
  section.appendChild(header);
  section.appendChild(listContainer);
  
  // Make header clickable to collapse/expand
  header.onclick = () => {
    section.classList.toggle('collapsed');
    listContainer.style.display = listContainer.style.display === 'none' ? 'block' : 'none';
  };
  
  return section;
}

function onGroupingChange(e) {
  currentGrouping = e.target.value;
  displayTabs(isViewingSaved);
}

function openAllTabsInGroup(tabs) {
  if (tabs.length === 0) return;
  
  // Confirm if opening many tabs
  if (tabs.length > 10) {
    if (!confirm(`Open ${tabs.length} tabs? This might slow down your browser.`)) {
      return;
    }
  }
  
  // Open all tabs
  tabs.forEach((tab, index) => {
    // Delay opening to prevent browser overload
    setTimeout(() => {
      chrome.tabs.create({ url: tab.url });
    }, index * 100); // 100ms delay between each tab
  });
  
  showStatus(`Opening ${tabs.length} tabs...`, 'success');
}

function createTabElement(tab, category, isFromSaved = false) {
  const div = document.createElement('div');
  div.className = 'tab-item';
  div.dataset.tabId = tab.id;
  div.dataset.category = category;
  
  const favicon = document.createElement('img');
  favicon.className = 'favicon';
  favicon.src = `https://www.google.com/s2/favicons?domain=${tab.domain}&sz=16`;
  favicon.onerror = () => { favicon.style.display = 'none'; };
  
  const info = document.createElement('div');
  info.className = 'tab-info';
  
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title;
  title.title = tab.title;
  
  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = tab.url;
  url.title = tab.url;
  
  info.appendChild(title);
  info.appendChild(url);
  
  div.appendChild(favicon);
  div.appendChild(info);
  
  // Make tab clickable to activate it
  if (!isFromSaved) {
    info.style.cursor = 'pointer';
    info.onclick = () => {
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    };
  }
  
  // Create appropriate action buttons
  if (isFromSaved) {
    const openBtn = document.createElement('button');
    openBtn.className = 'open-btn';
    openBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>';
    openBtn.title = 'Open tab';
    openBtn.onclick = () => openTab(tab.url);
    div.appendChild(openBtn);
  } else {
    // Add movement buttons for non-saved tabs
    const moveButtons = document.createElement('div');
    moveButtons.className = 'move-buttons';
    
    const moveUpBtn = document.createElement('button');
    moveUpBtn.className = 'move-btn move-up-btn';
    moveUpBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>';
    moveUpBtn.title = 'Move up category';
    moveUpBtn.disabled = category === 3; // Can't move up from Important
    moveUpBtn.onclick = () => moveTab(tab.id, category, 'up');
    
    const moveDownBtn = document.createElement('button');
    moveDownBtn.className = 'move-btn move-down-btn';
    moveDownBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>';
    moveDownBtn.title = 'Move down category';
    moveDownBtn.disabled = category === 1; // Can't move down from Not Important
    moveDownBtn.onclick = () => moveTab(tab.id, category, 'down');
    
    moveButtons.appendChild(moveUpBtn);
    moveButtons.appendChild(moveDownBtn);
    div.appendChild(moveButtons);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close tab';
    closeBtn.onclick = () => closeTab(tab.id, category);
    div.appendChild(closeBtn);
  }
  
  // Apply search filter if active
  if (searchQuery && !matchesSearch(tab, searchQuery)) {
    div.classList.add('hidden');
  }
  
  return div;
}

async function closeTab(tabId, category) {
  try {
    await chrome.tabs.remove(tabId);
    
    // Remove from categorized tabs
    categorizedTabs[category] = categorizedTabs[category].filter(tab => tab.id !== tabId);
    
    // Update display
    displayTabs();
    
    showStatus('Tab closed', 'success');
  } catch (error) {
    showStatus('Error closing tab: ' + error.message, 'error');
  }
}

// Close all tabs in a category
async function closeAllInCategory(category) {
  const tabs = categorizedTabs[category];
  if (tabs.length === 0) return;
  
  if (!confirm(`Close ${tabs.length} tabs?`)) {
    return;
  }
  
  try {
    const tabIds = tabs.map(t => t.id);
    await chrome.tabs.remove(tabIds);
    categorizedTabs[category] = [];
    displayTabs();
    showStatus(`Closed ${tabs.length} tabs`, 'success');
  } catch (error) {
    showStatus('Error closing tabs: ' + error.message, 'error');
  }
}

// Save and close tabs in a specific category
async function saveAndCloseCategory(category) {
  const tabs = categorizedTabs[category];
  if (tabs.length === 0) return;
  
  try {
    // Save only this category
    const tempCategorized = { 1: [], 2: [], 3: [] };
    tempCategorized[category] = tabs;
    
    await tabDatabase.saveTabs(tempCategorized, {
      closedAfterSave: true,
      provider: settings.provider,
      model: settings.model
    });
    
    // Close tabs
    const tabIds = tabs.map(t => t.id);
    await chrome.tabs.remove(tabIds);
    categorizedTabs[category] = [];
    displayTabs();
    
    showStatus(`Saved and closed ${tabs.length} tabs`, 'success');
  } catch (error) {
    showStatus('Error saving tabs: ' + error.message, 'error');
  }
}

// Save and close all tabs (categories 2 & 3)
async function saveAndCloseAll() {
  const tabsToSave = [...categorizedTabs[2], ...categorizedTabs[3]];
  const tabsToClose = [...categorizedTabs[1], ...categorizedTabs[2], ...categorizedTabs[3]];
  
  if (tabsToSave.length === 0 && tabsToClose.length === 0) {
    showStatus('No tabs to save or close', 'warning');
    return;
  }
  
  try {
    if (tabsToSave.length > 0) {
      // Save categories 2 & 3
      await tabDatabase.saveTabs(categorizedTabs, {
        closedAfterSave: true,
        provider: settings.provider,
        model: settings.model
      });
    }
    
    // Close all tabs
    if (tabsToClose.length > 0) {
      const tabIds = tabsToClose.map(t => t.id);
      await chrome.tabs.remove(tabIds);
    }
    
    const message = `Saved ${tabsToSave.length} tabs, closed ${tabsToClose.length} tabs`;
    showStatus(message, 'success');
    
    // Clear categorized tabs
    categorizedTabs = { 1: [], 2: [], 3: [] };
    
    // Show option to view saved tabs
    setTimeout(() => {
      if (confirm(`${message}\n\nView saved collections?`)) {
        showSavedTabs();
      } else {
        window.close();
      }
    }, 1000);
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  }
}

async function saveTabs(closeAfterSave) {
  try {
    // Save to database
    const savedId = await tabDatabase.saveTabs(categorizedTabs, {
      closedAfterSave: closeAfterSave,
      provider: settings.provider,
      model: settings.model
    });
    
    console.log('Saved to database with ID:', savedId);
    
    if (closeAfterSave) {
      // Close tabs from all categories
      const tabIds = [
        ...categorizedTabs[1].map(t => t.id),
        ...categorizedTabs[2].map(t => t.id),
        ...categorizedTabs[3].map(t => t.id)
      ];
      
      await chrome.tabs.remove(tabIds);
      
      showStatus(`Saved to database and closed ${tabIds.length} tabs`, 'success');
      
      // Show option to view saved tabs with info about excluded tabs
      const excludedCount = categorizedTabs[1].length;
      const savedCount = categorizedTabs[2].length + categorizedTabs[3].length;
      setTimeout(() => {
        const message = excludedCount > 0 
          ? `Saved ${savedCount} tabs! (${excludedCount} "can be closed" tabs were not saved)\n\nView saved collections?`
          : `Saved ${savedCount} tabs!\n\nView saved collections?`;
        
        if (confirm(message)) {
          showSavedTabs();
        } else {
          window.close();
        }
      }, 1000);
    } else {
      showStatus('Tabs saved to database successfully', 'success');
      
      // Show quick action to view saved tabs
      setTimeout(() => {
        const status = document.getElementById('status');
        if (status && status.textContent) {
          status.innerHTML = status.textContent + ' <a href="#" onclick="showSavedTabs(); return false;">View saved</a>';
        }
      }, 100);
    }
  } catch (error) {
    showStatus('Error saving tabs: ' + error.message, 'error');
    console.error('Save error:', error);
  }
}

function createMarkdownContent(tabs, title) {
  let content = `# ${title}\n\n`;
  content += `Generated on: ${new Date().toLocaleString()}\n\n`;
  
  // Group by domain
  const grouped = {};
  tabs.forEach(tab => {
    if (!grouped[tab.domain]) {
      grouped[tab.domain] = [];
    }
    grouped[tab.domain].push(tab);
  });
  
  // Create content
  Object.keys(grouped).sort().forEach(domain => {
    content += `## ${domain}\n\n`;
    grouped[domain].forEach(tab => {
      content += `- [${tab.title}](${tab.url})\n`;
    });
    content += '\n';
  });
  
  return content;
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  if (!statusDiv) {
    console.error('Status div not found');
    return;
  }
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
}

function onPromptChange(e) {
  settings.customPrompt = e.target.value;
  saveSettings();
  updatePromptStatus();
}

function resetPrompt() {
  settings.customPrompt = CONFIG.DEFAULT_PROMPT;
  document.getElementById('promptTextarea').value = CONFIG.DEFAULT_PROMPT;
  saveSettings();
  updatePromptStatus();
  showStatus('Prompt reset to default', 'success');
}

// Update prompt status indicator
function updatePromptStatus() {
  const promptStatus = document.getElementById('promptStatus');
  if (!promptStatus) return;
  
  const currentPrompt = settings.customPrompt || '';
  const isDefault = currentPrompt === CONFIG.DEFAULT_PROMPT || currentPrompt === '';
  
  if (isDefault) {
    promptStatus.textContent = '(Using default prompt)';
    promptStatus.style.color = 'var(--text-muted)';
  } else {
    promptStatus.textContent = '(Using custom prompt)';
    promptStatus.style.color = 'var(--warning-color)';
  }
}

// Open a single tab
function openTab(url) {
  chrome.tabs.create({ url: url }, (tab) => {
    showStatus('Tab opened', 'success');
  });
}

// Open all tabs in a category
function openAllTabsInCategory(category) {
  const tabs = categorizedTabs[category];
  if (tabs.length === 0) return;
  
  // Confirm if opening many tabs
  if (tabs.length > 10) {
    if (!confirm(`Open ${tabs.length} tabs? This might slow down your browser.`)) {
      return;
    }
  }
  
  // Open all tabs
  tabs.forEach((tab, index) => {
    // Delay opening to prevent browser overload
    setTimeout(() => {
      chrome.tabs.create({ url: tab.url });
    }, index * 100); // 100ms delay between each tab
  });
  
  showStatus(`Opening ${tabs.length} tabs...`, 'success');
}

// Show saved tabs from database
async function showSavedTabs() {
  try {
    const allSavedTabs = await tabDatabase.getAllSavedTabs();
    
    // Convert to categorized format for display
    categorizedTabs = { 1: [], 2: [], 3: [] };
    allSavedTabs.forEach(tab => {
      if (categorizedTabs[tab.category]) {
        categorizedTabs[tab.category].push(tab);
      }
    });
    
    // Hide other panels
    document.getElementById('settingsPanel').style.display = 'none';
    document.getElementById('apiKeyPrompt').style.display = 'none';
    
    // Show tabs container with grouping controls
    document.getElementById('tabsContainer').style.display = 'block';
    document.getElementById('searchControls').style.display = 'flex';
    document.getElementById('groupingControls').style.display = 'flex';
    
    // Display tabs
    displayTabs(true);
    
    // Hide main action buttons for saved view
    document.querySelector('.action-buttons').style.display = 'none';
    
    showStatus(`Viewing ${allSavedTabs.length} saved tabs`, 'success');
    
  } catch (error) {
    showStatus('Error loading saved tabs: ' + error.message, 'error');
  }
}


// Additional functions to append to popup.js

// Move tab between categories
function moveTab(tabId, fromCategory, direction) {
  const tab = categorizedTabs[fromCategory].find(t => t.id === tabId);
  if (!tab) return;
  
  let toCategory;
  if (direction === 'up') {
    toCategory = fromCategory + 1; // Move to more important
  } else {
    toCategory = fromCategory - 1; // Move to less important
  }
  
  // Validate category
  if (toCategory < 1 || toCategory > 3) return;
  
  // Remove from current category
  categorizedTabs[fromCategory] = categorizedTabs[fromCategory].filter(t => t.id !== tabId);
  
  // Add to new category
  categorizedTabs[toCategory].push(tab);
  
  // Re-sort the new category by domain
  categorizedTabs[toCategory].sort((a, b) => a.domain.localeCompare(b.domain));
  
  // Refresh display
  displayTabs(isViewingSaved);
  
  showStatus(`Moved to ${toCategory === 3 ? 'Important' : toCategory === 2 ? 'Save for Later' : 'Can Be Closed'}`, 'success');
}

// Search functionality
function onSearchInput(e) {
  searchQuery = e.target.value.toLowerCase().trim();
  applySearchFilter();
}

function clearSearch() {
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  applySearchFilter();
}

function matchesSearch(tab, query) {
  if (!query) return true;
  return tab.title.toLowerCase().includes(query) || 
         tab.url.toLowerCase().includes(query) ||
         tab.domain.toLowerCase().includes(query);
}

function applySearchFilter() {
  const allTabs = document.querySelectorAll('.tab-item');
  let visibleCount = 0;
  
  allTabs.forEach(tabElement => {
    const tabId = parseInt(tabElement.dataset.tabId);
    const category = parseInt(tabElement.dataset.category);
    
    // Find the tab data
    let tab = null;
    if (categorizedTabs[category]) {
      tab = categorizedTabs[category].find(t => t.id === tabId);
    }
    
    if (tab && matchesSearch(tab, searchQuery)) {
      tabElement.classList.remove('hidden');
      tabElement.classList.add('search-match');
      visibleCount++;
    } else {
      tabElement.classList.add('hidden');
      tabElement.classList.remove('search-match');
    }
  });
  
  // Update status
  if (searchQuery) {
    showStatus(`Found ${visibleCount} tabs matching "${searchQuery}"`, 'success');
  }
}

// Theme management functions
function initializeTheme() {
  // Load saved theme or use system default
  chrome.storage.local.get(['theme'], (result) => {
    const savedTheme = result.theme || 'system';
    applyTheme(savedTheme);
    updateThemeButtons(savedTheme);
  });
}

function setTheme(theme) {
  applyTheme(theme);
  updateThemeButtons(theme);
  chrome.storage.local.set({ theme });
}

function applyTheme(theme) {
  if (theme === 'system') {
    // Remove manual theme override
    document.body.removeAttribute('data-theme');
  } else {
    // Apply manual theme
    document.body.setAttribute('data-theme', theme);
  }
}

function updateThemeButtons(activeTheme) {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    if (btn.dataset.theme === activeTheme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Check extension integrity
function checkExtensionIntegrity() {
  // This ID will be set when published to Chrome Web Store
  const OFFICIAL_IDS = [
    // Add your official Chrome Web Store ID here when published
    // Example: 'abcdefghijklmnopqrstuvwxyzabcdef'
  ];
  
  const currentId = chrome.runtime.id;
  
  // Check if running in development mode
  chrome.management.getSelf((extensionInfo) => {
    const isDevelopment = extensionInfo.installType === 'development';
    const isOfficial = OFFICIAL_IDS.includes(currentId) || isDevelopment;
    
    if (!isOfficial && OFFICIAL_IDS.length > 0) {
      console.warn('Unofficial version detected');
      // Show warning in UI
      setTimeout(() => {
        const status = document.getElementById('status');
        if (status) {
          status.innerHTML = '⚠️ Unofficial version! Get the official extension from <a href="https://github.com/aitkn/ai_tab_manager" target="_blank">GitHub</a>';
          status.className = 'status error';
        }
      }, 2000);
    }
  });
}