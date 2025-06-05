/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Proprietary License - See LICENSE file
 * support@aitkn.com
 */

let categorizedTabs = { 1: [], 2: [], 3: [] };
let isViewingSaved = false;
let searchQuery = '';
let isInitializing = true; // Flag to prevent saving during initialization
let popupState = {
  isViewingSaved: false,
  searchQuery: '',
  categorizedTabs: null,
  activeTab: 'categorize', // Track active tab
  groupingSelections: {
    categorize: 'category',
    saved: 'category'
  },
  scrollPositions: {}
};
let urlToDuplicateIds = {}; // Maps URLs to all tab IDs with that URL
let settings = {
  provider: CONFIG.DEFAULT_PROVIDER,
  model: CONFIG.DEFAULT_MODEL,
  apiKeys: {},
  selectedModels: {}, // Store selected model per provider
  customPrompt: CONFIG.DEFAULT_PROMPT, // Store custom prompt, default to CONFIG prompt
  promptVersion: CONFIG.PROMPT_VERSION, // Track prompt version
  isPromptCustomized: false, // Track if user has customized the prompt
  maxTabsToOpen: 50 // Default max tabs to open at once
};

// Theme management functions - defined early
function initializeTheme() {
  // Load saved theme or use system default
  chrome.storage.local.get(['theme'], (result) => {
    const savedTheme = result.theme || 'system';
    applyTheme(savedTheme);
    updateThemeButtons(savedTheme);
  });
}

function setTheme(theme) {
  console.log('setTheme called with:', theme);
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

// Save state when window loses focus or visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !isInitializing) {
    console.log('Window hidden, saving state');
    savePopupState();
  }
});

// Also save when window loses focus
window.addEventListener('blur', () => {
  if (!isInitializing) {
    console.log('Window blur, saving state');
    savePopupState();
  }
});

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
    
    // Load settings and popup state from storage
    const stored = await chrome.storage.local.get(['settings', 'popupState']);
    if (stored.settings) {
      settings = { ...settings, ...stored.settings };
      
      // Check if default prompt has been updated
      if (!settings.isPromptCustomized && settings.promptVersion < CONFIG.PROMPT_VERSION) {
        console.log('Updating to new default prompt (version', CONFIG.PROMPT_VERSION, ')');
        settings.customPrompt = CONFIG.DEFAULT_PROMPT;
        settings.promptVersion = CONFIG.PROMPT_VERSION;
        await saveSettings();
      }
    }
    
    // Restore popup state if available
    if (stored.popupState) {
      console.log('Loaded popup state:', stored.popupState);
      popupState = { ...popupState, ...stored.popupState };
      isViewingSaved = popupState.isViewingSaved;
      searchQuery = popupState.searchQuery || '';
      
      // Ensure we have groupingSelections
      if (!popupState.groupingSelections) {
        popupState.groupingSelections = {
          categorize: 'category',
          saved: 'category'
        };
      }
      
      // Restore grouping selections
      const groupingSelect = document.getElementById('groupingSelect');
      if (groupingSelect) {
        groupingSelect.value = popupState.groupingSelections.categorize;
      }
      
      const savedGroupingSelect = document.getElementById('savedGroupingSelect');
      if (savedGroupingSelect) {
        savedGroupingSelect.value = popupState.groupingSelections.saved;
      }
      
      // Restore UI based on saved state
      if (popupState.isViewingSaved) {
        // Show saved tabs
        await showSavedTabs(true); // true = restoring state
      } else if (popupState.categorizedTabs) {
        // Restore categorized tabs
        categorizedTabs = popupState.categorizedTabs;
        // Only show the container if there are actually tabs
        if (categorizedTabs[1].length > 0 || categorizedTabs[2].length > 0 || categorizedTabs[3].length > 0) {
          document.getElementById('tabsContainer').style.display = 'block';
          document.querySelector('.action-buttons').style.display = 'flex';
          displayTabs();
          updateCategorizeBadge();
          // Scroll restoration is handled centrally after initialization
        }
      }
      
      // Restore search
      if (searchQuery) {
        document.getElementById('searchInput').value = searchQuery;
        applySearchFilter();
      }
      
      // Don't restore scroll positions here - they'll be restored after content is loaded
    }
    
    console.log('Loaded settings:', settings);
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize tab navigation
    initializeTabNavigation();
    
    // Initialize both tabs' content to ensure containers exist
    if (stored.popupState) {
      // Pre-load saved tabs content
      const savedGrouping = popupState.groupingSelections?.saved || 'category';
      await showSavedTabsContent(savedGrouping).catch(console.error);
    }
    
    // Restore active tab if available
    if (stored.popupState && stored.popupState.activeTab) {
      // Set the active tab in popupState before switching
      popupState.activeTab = stored.popupState.activeTab;
      
      // Directly set scroll positions before making tabs visible
      if (popupState.scrollPositions) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          // Set scroll for categorize tab
          if (popupState.scrollPositions.categorize) {
            const tabsContainer = document.getElementById('tabsContainer');
            if (tabsContainer) {
              tabsContainer.style.scrollBehavior = 'auto'; // Disable smooth scrolling
              tabsContainer.scrollTop = popupState.scrollPositions.categorize;
              console.log('Set categorize scroll to:', popupState.scrollPositions.categorize);
            }
          }
          
          // Set scroll for saved tab
          if (popupState.scrollPositions.saved) {
            const savedContent = document.getElementById('savedContent');
            if (savedContent) {
              savedContent.style.scrollBehavior = 'auto'; // Disable smooth scrolling
              savedContent.scrollTop = popupState.scrollPositions.saved;
              console.log('Set saved scroll to:', popupState.scrollPositions.saved);
            }
          }
          
          // Now switch to the active tab
          switchToTab(stored.popupState.activeTab);
        });
      } else {
        switchToTab(stored.popupState.activeTab);
      }
    }
    
    
    // Initialize settings UI
    initializeSettingsUI();
    
    // Update badges
    updateSavedBadge();
    
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
  } finally {
    // Mark initialization as complete after a delay to ensure scroll restoration is done
    setTimeout(() => {
      isInitializing = false;
      console.log('Initialization complete, saving enabled');
    }, 1500); // Wait for all scroll restoration attempts to complete
  }
});

function setupEventListeners() {
  document.getElementById('categorizeBtn').addEventListener('click', handleCategorize);
  document.getElementById('saveAndCloseAllBtn').addEventListener('click', () => saveAndCloseAll());
  document.getElementById('saveApiKeyBtn').addEventListener('click', saveApiKey);
  document.getElementById('openSettingsBtn').addEventListener('click', () => switchToTab('settings'));
  document.getElementById('providerSelect').addEventListener('change', onProviderChange);
  document.getElementById('modelSelect').addEventListener('change', onModelChange);
  document.getElementById('promptTextarea').addEventListener('input', onPromptChange);
  document.getElementById('resetPromptBtn').addEventListener('click', resetPrompt);
  document.getElementById('searchInput').addEventListener('input', onSearchInput);
  document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
  document.getElementById('maxTabsInput').addEventListener('change', onMaxTabsChange);
  
  // Saved tab controls
  const savedGroupingSelect = document.getElementById('savedGroupingSelect');
  const savedSearchInput = document.getElementById('savedSearchInput');
  const clearSavedSearchBtn = document.getElementById('clearSavedSearchBtn');
  
  if (savedGroupingSelect) {
    savedGroupingSelect.addEventListener('change', onSavedGroupingChange);
  }
  if (savedSearchInput) {
    savedSearchInput.addEventListener('input', onSavedSearchInput);
  }
  if (clearSavedSearchBtn) {
    clearSavedSearchBtn.addEventListener('click', clearSavedSearch);
  }
  
  // Theme switcher buttons
  document.querySelectorAll('.theme-btn').forEach(btn => {
    console.log('Adding theme listener to button:', btn.dataset.theme);
    btn.addEventListener('click', () => {
      console.log('Theme button clicked:', btn.dataset.theme);
      setTheme(btn.dataset.theme);
    });
  });
  
  // CSV Export/Import handlers
  document.getElementById('exportCSVBtn').addEventListener('click', exportToCSV);
  document.getElementById('importCSVBtn').addEventListener('click', () => {
    document.getElementById('csvFileInput').click();
  });
  document.getElementById('csvFileInput').addEventListener('change', handleCSVImport);
  
  // Toggle all groups button
  document.getElementById('toggleAllGroupsBtn').addEventListener('click', toggleAllGroups);
  
  // Categorize tab grouping controls
  const groupingSelect = document.getElementById('groupingSelect');
  if (groupingSelect) {
    groupingSelect.addEventListener('change', onGroupingChange);
  }
  document.getElementById('toggleCategorizeGroupsBtn').addEventListener('click', toggleCategorizeGroups);
  
  // Add scroll event listeners to save scroll position
  const tabsContainer = document.getElementById('tabsContainer');
  if (tabsContainer) {
    let scrollSaveTimeout;
    tabsContainer.addEventListener('scroll', () => {
      if (!isInitializing) {
        clearTimeout(scrollSaveTimeout);
        scrollSaveTimeout = setTimeout(() => {
          if (popupState.activeTab === 'categorize') {
            savePopupState();
          }
        }, 300); // Debounce scroll saving
      }
    });
  }
  
  const savedContent = document.getElementById('savedContent');
  if (savedContent) {
    let scrollSaveTimeout;
    savedContent.addEventListener('scroll', () => {
      if (!isInitializing) {
        clearTimeout(scrollSaveTimeout);
        scrollSaveTimeout = setTimeout(() => {
          if (popupState.activeTab === 'saved') {
            savePopupState();
          }
        }, 300); // Debounce scroll saving
      }
    });
  }
}

function initializeTabNavigation() {
  // Tab button click handlers
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchToTab(tabName);
    });
  });
}

function switchToTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `${tabName}Tab`);
  });
  
  // Clear status message when switching tabs (except saved which sets its own)
  if (tabName !== 'saved') {
    clearStatus();
  }
  
  // Special handling for each tab
  switch(tabName) {
    case 'categorize':
      // Check if we have any categorized tabs
      const hasCategorizedTabs = categorizedTabs[1].length > 0 || 
                                 categorizedTabs[2].length > 0 || 
                                 categorizedTabs[3].length > 0;
      
      if (hasCategorizedTabs) {
        // Show the container and display tabs
        document.getElementById('tabsContainer').style.display = 'block';
        document.querySelector('.action-buttons').style.display = 'flex';
        displayTabs();
      } else {
        // Hide everything if no tabs
        document.getElementById('tabsContainer').style.display = 'none';
        document.querySelector('.action-buttons').style.display = 'none';
        // Also ensure category sections are marked as empty
        [1, 2, 3].forEach(category => {
          const section = document.getElementById(`category${category}`);
          if (section) {
            section.classList.add('empty');
          }
        });
      }
      break;
    case 'saved':
      showSavedTabsContent();
      break;
    case 'settings':
      // Hide API key prompt when showing settings
      document.getElementById('apiKeyPrompt').style.display = 'none';
      break;
  }
  
  // Update popup state
  popupState.activeTab = tabName;
  savePopupState();
}

function showApiKeyPrompt() {
  document.getElementById('apiKeyPrompt').style.display = 'block';
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
  
  // Set max tabs to open
  const maxTabsInput = document.getElementById('maxTabsInput');
  maxTabsInput.value = settings.maxTabsToOpen || 50;
  
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

function onMaxTabsChange(e) {
  const value = parseInt(e.target.value);
  if (!isNaN(value) && value >= 1 && value <= 200) {
    settings.maxTabsToOpen = value;
    saveSettings();
    showStatus(`Max tabs to open set to ${value}`, 'success');
  } else {
    // Reset to previous value if invalid
    e.target.value = settings.maxTabsToOpen || 50;
    showStatus('Please enter a value between 1 and 200', 'error');
  }
}

// Save popup state
async function savePopupState() {
  // Don't save during initialization
  if (isInitializing) {
    console.log('Skipping save during initialization');
    return;
  }
  
  // Get current scroll positions for ALL tabs
  const scrollPositions = { ...popupState.scrollPositions };
  
  // Always try to get both scroll positions
  const tabsContainer = document.getElementById('tabsContainer');
  if (tabsContainer) {
    scrollPositions.categorize = tabsContainer.scrollTop || 0;
    console.log('Saving categorize scroll position:', scrollPositions.categorize);
  }
  
  const savedContent = document.getElementById('savedContent');
  if (savedContent) {
    scrollPositions.saved = savedContent.scrollTop || 0;
    console.log('Saving saved scroll position:', scrollPositions.saved);
  }
  
  console.log('All scroll positions to save:', scrollPositions);
  
  // Get current grouping selections
  const groupingSelections = {
    categorize: document.getElementById('groupingSelect')?.value || 'category',
    saved: document.getElementById('savedGroupingSelect')?.value || 'category'
  };
  
  // Merge new state with existing state
  popupState = {
    ...popupState,
    isViewingSaved,
    searchQuery,
    categorizedTabs: isViewingSaved ? popupState.categorizedTabs : categorizedTabs,
    activeTab: popupState.activeTab || 'categorize',
    scrollPositions: { ...popupState.scrollPositions, ...scrollPositions },
    groupingSelections
  };
  await chrome.storage.local.set({ popupState });
}

// Restore scroll position after content is loaded
function restoreScrollPosition(tabName, delay = 100) {
  if (!popupState.scrollPositions) {
    console.log('No scroll positions to restore');
    return;
  }
  
  console.log('Restoring scroll position for', tabName, 'with positions:', popupState.scrollPositions);
  
  setTimeout(() => {
    if (tabName === 'categorize' && popupState.scrollPositions.categorize) {
      const tabsContainer = document.getElementById('tabsContainer');
      if (tabsContainer) {
        console.log('Setting categorize scroll to:', popupState.scrollPositions.categorize);
        tabsContainer.scrollTop = popupState.scrollPositions.categorize;
        // Verify it was set
        setTimeout(() => {
          console.log('Actual scroll position after setting:', tabsContainer.scrollTop);
        }, 50);
      } else {
        console.log('tabsContainer not found');
      }
    } else if (tabName === 'saved' && popupState.scrollPositions.saved) {
      const savedContent = document.getElementById('savedContent');
      if (savedContent) {
        console.log('Setting saved scroll to:', popupState.scrollPositions.saved);
        savedContent.scrollTop = popupState.scrollPositions.saved;
        // Verify it was set
        setTimeout(() => {
          console.log('Actual scroll position after setting:', savedContent.scrollTop);
        }, 50);
      } else {
        console.log('savedContent not found');
      }
    }
  }, delay);
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
    
    // Track duplicate URLs for later operations
    urlToDuplicateIds = {}; // Reset the mapping
    
    // Track all tabs by URL (for closing duplicates)
    tabs.forEach(tab => {
      if (tab.url) {
        if (!urlToDuplicateIds[tab.url]) {
          urlToDuplicateIds[tab.url] = [];
        }
        urlToDuplicateIds[tab.url].push(tab.id);
      }
    });
    
    // Show loading status
    showStatus(`Processing ${tabs.length} tabs...`, 'loading');
    
    // Prepare all tabs data for Claude (deduplication will happen in background script)
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
    
    // Update badge
    updateCategorizeBadge();
    
    // Save state
    await savePopupState();
    
    // Remove any existing back button
    const existingBackBtn = document.getElementById('backToSaved');
    if (existingBackBtn) {
      existingBackBtn.remove();
    }
    
    // Count actual categorized tabs
    const totalCategorized = categorizedTabs[1].length + categorizedTabs[2].length + categorizedTabs[3].length;
    showStatus(`Categorized ${totalCategorized} tabs`, 'success');
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
    
    // Get saved URLs to exclude from LLM submission
    let savedUrls = [];
    try {
      await tabDatabase.init();
      const savedTabs = await tabDatabase.getAllSavedTabs();
      savedUrls = [...new Set(savedTabs.map(tab => tab.url))]; // Unique URLs only
      console.log(`Found ${savedUrls.length} saved URLs to exclude from LLM`);
    } catch (error) {
      console.warn('Could not fetch saved URLs:', error);
    }
    
    // For very large numbers of tabs, use batch processing
    const BATCH_SIZE = 100;
    
    if (tabs.length > BATCH_SIZE) {
      console.log(`Large number of tabs detected (${tabs.length}), processing in batches of ${BATCH_SIZE}`);
      showStatus(`Categorizing ${tabs.length} tabs in batches...`, 'loading');
      
      const categorizedResults = { 1: [], 2: [], 3: [] };
      
      for (let i = 0; i < tabs.length; i += BATCH_SIZE) {
        const batch = tabs.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(tabs.length / BATCH_SIZE);
        
        showStatus(`Processing batch ${batchNumber} of ${totalBatches}...`, 'loading');
        console.log(`Processing batch ${batchNumber} of ${totalBatches} (${batch.length} tabs)`);
        
        const response = await chrome.runtime.sendMessage({
          action: 'categorizeTabs',
          data: { tabs: batch, apiKey, provider, model, customPrompt, savedUrls }
        });
        
        if (!response || response.error) {
          console.error(`Batch ${batchNumber} failed:`, response?.error || 'No response');
          throw new Error(response?.error || 'Batch processing failed');
        }
        
        if (response.success && response.data) {
          // Merge batch results
          [1, 2, 3].forEach(category => {
            if (response.data[category]) {
              categorizedResults[category].push(...response.data[category]);
            }
          });
        }
        
        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < tabs.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log('Successfully categorized all batches');
      return categorizedResults;
    }
    
    // For smaller numbers of tabs, process all at once
    const response = await chrome.runtime.sendMessage({
      action: 'categorizeTabs',
      data: { tabs, apiKey, provider, model, customPrompt, savedUrls }
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
    
    // Show appropriate grouping controls
    const categorizeGroupingControls = document.getElementById('categorizeGroupingControls');
    if (categorizeGroupingControls && !isFromSaved) {
      categorizeGroupingControls.style.display = 'flex';
    }
    
    // Get the appropriate grouping for the current tab
    const currentGrouping = isFromSaved 
      ? popupState.groupingSelections.saved 
      : popupState.groupingSelections.categorize;
    
    // Display based on current grouping
    if (currentGrouping === 'category') {
      displayCategoryView(isFromSaved);
    } else {
      displayGroupedView(currentGrouping, isFromSaved);
    }
    
    // Don't restore scroll here during initialization - it's handled centrally
    if (!isFromSaved && !isInitializing) {
      restoreScrollPosition('categorize');
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
    
    // Hide empty categories
    if (tabs.length === 0 && !isFromSaved) {
      section.classList.add('empty');
    } else {
      section.classList.remove('empty');
    }
    
    // Show count with already saved info if any
    const alreadySavedCount = tabs.filter(tab => tab.alreadySaved).length;
    
    if (alreadySavedCount > 0) {
      countSpan.textContent = `${tabs.length}, ${alreadySavedCount} already saved`;
    } else {
      countSpan.textContent = tabs.length;
    }
    
    listContainer.innerHTML = '';
    
    // Add action buttons based on category and context
    const actionsContainer = section.querySelector('.category-header-actions');
    if (actionsContainer) {
      actionsContainer.innerHTML = ''; // Clear any existing buttons
      
      if (!isFromSaved && tabs.length > 0) {
        if (category === 1) {
          // Category 1: Can Be Closed - Add Close button
          const closeAllBtn = document.createElement('button');
          closeAllBtn.className = 'inline-action-btn primary-btn';
          closeAllBtn.title = 'Closes all tabs in this category without saving';
          closeAllBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg> Close All';
          closeAllBtn.onclick = () => closeAllInCategory(category);
          actionsContainer.appendChild(closeAllBtn);
        } else {
          // Categories 2 & 3: Add Save and Close button
          const saveCloseBtn = document.createElement('button');
          saveCloseBtn.className = 'inline-action-btn primary-btn';
          saveCloseBtn.title = 'Saves these tabs to database and closes them';
          saveCloseBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg> Save & Close';
          saveCloseBtn.onclick = () => saveAndCloseCategory(category);
          actionsContainer.appendChild(saveCloseBtn);
        }
      }
    }
    
    
    // Sort tabs within category
    const sortedTabs = sortTabsInGroup(tabs, 'category');
    sortedTabs.forEach(tab => {
      const tabElement = createTabElement(tab, category, isFromSaved);
      listContainer.appendChild(tabElement);
    });
    
    // Make category header clickable to collapse/expand
    const header = section.querySelector('.category-header');
    if (header && !header.hasAttribute('data-collapse-enabled')) {
      header.style.cursor = 'pointer';
      header.setAttribute('data-collapse-enabled', 'true');
      
      header.onclick = (e) => {
        // Don't collapse if clicking on action buttons
        if (e.target.closest('.category-header-actions')) return;
        
        section.classList.toggle('collapsed');
        const isCollapsed = section.classList.contains('collapsed');
        listContainer.style.display = isCollapsed ? 'none' : 'block';
      };
    }
  });
}

function displayGroupedView(groupBy, isFromSaved = false) {
  let groupedView;
  
  if (isFromSaved) {
    // For saved tabs, create a new grouped view container
    groupedView = document.createElement('div');
    groupedView.className = 'grouping-view';
    groupedView.id = 'savedGroupedView';
  } else {
    // For regular categorize tab
    document.getElementById('categoryView').style.display = 'none';
    document.getElementById('groupedView').style.display = 'block';
    groupedView = document.getElementById('groupedView');
  }
  
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
    case 'lastAccessedDate':
      groups = groupByLastAccessedDate(allTabs);
      break;
    case 'lastAccessedWeek':
      groups = groupByLastAccessedWeek(allTabs);
      break;
    case 'lastAccessedMonth':
      groups = groupByLastAccessedMonth(allTabs);
      break;
  }
  
  // Sort date/time-based groups chronologically
  let sortedEntries = Object.entries(groups);
  if (['savedDate', 'savedWeek', 'savedMonth', 'lastAccessedDate', 'lastAccessedWeek', 'lastAccessedMonth'].includes(groupBy)) {
    sortedEntries = sortedEntries.sort((a, b) => {
      // Extract dates from group names for proper chronological sorting
      const dateA = extractDateFromGroupName(a[0]);
      const dateB = extractDateFromGroupName(b[0]);
      return dateB - dateA; // Most recent first
    });
  }
  
  // Display groups
  sortedEntries.forEach(([groupName, tabs]) => {
    // Sort tabs within the group based on grouping type
    const sortedTabs = sortTabsInGroup(tabs, groupBy);
    const groupSection = createGroupSection(groupName, sortedTabs, groupBy, isFromSaved);
    groupedView.appendChild(groupSection);
  });
  
  // Return the grouped view for saved tabs to append
  if (isFromSaved) {
    return groupedView;
  }
}

// Helper function to extract root domain
function getRootDomain(domain) {
  if (!domain || domain === 'unknown') return domain;
  
  // Handle special cases
  if (domain.startsWith('chrome://') || domain.startsWith('file://')) {
    return domain;
  }
  
  // Remove www. prefix
  let cleaned = domain.replace(/^www\./, '');
  
  // Extract root domain (last two parts for most domains)
  const parts = cleaned.split('.');
  if (parts.length >= 2) {
    // Handle special TLDs like co.uk, com.au, etc.
    const specialTLDs = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'co.in', 'com.br', 'com.cn'];
    const lastTwo = parts.slice(-2).join('.');
    if (specialTLDs.includes(lastTwo) && parts.length >= 3) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }
  return cleaned;
}

// Helper function to get subdomain
function getSubdomain(fullDomain, rootDomain) {
  if (!fullDomain || fullDomain === rootDomain) return '';
  const subdomain = fullDomain.replace(new RegExp(`\\.?${rootDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
  return subdomain || '';
}

// Extract date from group name for sorting
function extractDateFromGroupName(groupName) {
  // Handle "Today", "Yesterday"
  if (groupName.includes('Today')) return new Date();
  if (groupName.includes('Yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  
  // Handle "This Week", "Last Week"
  if (groupName.includes('This Week')) {
    return new Date(); // Current week
  }
  if (groupName.includes('Last Week')) {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    return lastWeek;
  }
  
  // Handle "X days ago"
  const daysAgoMatch = groupName.match(/(\d+) days ago/);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1]);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }
  
  // Handle "Week of Mon DD" or "Week of Mon DD, YYYY" format
  const weekOfMatch = groupName.match(/Week of (\w+)\s+(\d+)(?:,\s+(\d{4}))?/);
  if (weekOfMatch) {
    const monthName = weekOfMatch[1];
    const day = parseInt(weekOfMatch[2]);
    const year = weekOfMatch[3] ? parseInt(weekOfMatch[3]) : new Date().getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = monthNames.indexOf(monthName);
    if (monthIndex !== -1) {
      const date = new Date(year, monthIndex, day);
      return date;
    }
  }
  
  // Handle "Week X, YYYY" (old format)
  const weekMatch = groupName.match(/Week (\d+), (\d{4})/);
  if (weekMatch) {
    const week = parseInt(weekMatch[1]);
    const year = parseInt(weekMatch[2]);
    // Approximate date for week
    const date = new Date(year, 0, 1);
    date.setDate(date.getDate() + (week - 1) * 7);
    return date;
  }
  
  // Handle month names
  const monthMatch = groupName.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})/);
  if (monthMatch) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = monthNames.indexOf(monthMatch[1]);
    const year = parseInt(monthMatch[2]);
    return new Date(year, monthIndex, 1);
  }
  
  // Try to parse any date format
  const date = new Date(groupName.replace(/^(Saved|Opened) /, ''));
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  // Default to current date if unable to parse
  return new Date();
}

// Sort tabs within a group based on grouping type
function sortTabsInGroup(tabs, groupingType) {
  return tabs.sort((a, b) => {
    const rootDomainA = getRootDomain(a.domain || '');
    const rootDomainB = getRootDomain(b.domain || '');
    const subdomainA = getSubdomain(a.domain || '', rootDomainA);
    const subdomainB = getSubdomain(b.domain || '', rootDomainB);
    
    switch (groupingType) {
      case 'category':
        // Sort by root domain, subdomain, datetime opened desc
        if (rootDomainA !== rootDomainB) {
          return rootDomainA.localeCompare(rootDomainB);
        }
        if (subdomainA !== subdomainB) {
          return subdomainA.localeCompare(subdomainB);
        }
        return (b.lastAccessed || b.savedAt) - (a.lastAccessed || a.savedAt);
        
      case 'domain':
        // Sort by subdomain, datetime opened desc
        if (subdomainA !== subdomainB) {
          return subdomainA.localeCompare(subdomainB);
        }
        return (b.lastAccessed || b.savedAt) - (a.lastAccessed || a.savedAt);
        
      case 'savedDate':
      case 'savedWeek':
      case 'savedMonth':
        // Sort by root domain, subdomain, datetime saved
        if (rootDomainA !== rootDomainB) {
          return rootDomainA.localeCompare(rootDomainB);
        }
        if (subdomainA !== subdomainB) {
          return subdomainA.localeCompare(subdomainB);
        }
        return b.savedAt - a.savedAt;
        
      case 'lastAccessedDate':
      case 'lastAccessedWeek':
      case 'lastAccessedMonth':
        // Sort by root domain, subdomain, datetime opened
        if (rootDomainA !== rootDomainB) {
          return rootDomainA.localeCompare(rootDomainB);
        }
        if (subdomainA !== subdomainB) {
          return subdomainA.localeCompare(subdomainB);
        }
        return (b.lastAccessed || b.savedAt) - (a.lastAccessed || a.savedAt);
        
      default:
        return 0;
    }
  });
}

function groupByDomain(tabs) {
  const groups = {};
  
  // Group by root domain
  tabs.forEach(tab => {
    const fullDomain = tab.domain || 'unknown';
    const rootDomain = getRootDomain(fullDomain);
    
    if (!groups[rootDomain]) {
      groups[rootDomain] = [];
    }
    groups[rootDomain].push(tab);
  });
  
  // Sort groups alphabetically by root domain
  const sortedGroups = {};
  Object.keys(groups).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).forEach(domain => {
    sortedGroups[domain] = groups[domain];
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
      // Get the Monday of that week
      const weekStart = getWeekStartDate(tabDate);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (tabYear === currentYear) {
        groupName = `Week of ${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}`;
      } else {
        groupName = `Week of ${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}, ${tabYear}`;
      }
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

// Get the Monday of the week for a given date
function getWeekStartDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
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
      // Get the Monday of that week
      const weekStart = getWeekStartDate(savedDate);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (savedYear === currentYear) {
        groupName = `Saved Week of ${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}`;
      } else {
        groupName = `Saved Week of ${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}, ${savedYear}`;
      }
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
  
  // Add container for stats and button
  const headerRight = document.createElement('div');
  headerRight.className = 'header-right';
  
  headerRight.appendChild(stats);
  
  // Add action buttons for saved collections in header
  if (isFromSaved && tabs.length > 0) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'group-actions';
    
    // Open All button with icon
    const openAllBtn = document.createElement('button');
    openAllBtn.className = 'icon-btn';
    openAllBtn.title = `Open all ${tabs.length} tabs in this group`;
    openAllBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    `;
    openAllBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent header click
      openAllTabsInGroup(tabs);
    };
    
    // Delete group button with icon
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn delete-btn';
    deleteBtn.title = `Delete all ${tabs.length} tabs in this group`;
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;
    deleteBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent header click
      deleteTabsInGroup(tabs, groupName);
    };
    
    actionsDiv.appendChild(openAllBtn);
    actionsDiv.appendChild(deleteBtn);
    headerRight.appendChild(actionsDiv);
  }
  
  header.appendChild(headerRight);
  
  const listContainer = document.createElement('div');
  listContainer.className = 'tabs-list';
  
  // Tabs are already sorted by the calling function
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
  savePopupState();
}

// Group by last accessed date
function groupByLastAccessedDate(tabs) {
  const groups = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  tabs.forEach(tab => {
    const accessedDate = tab.lastAccessed ? new Date(tab.lastAccessed) : new Date(tab.savedAt);
    accessedDate.setHours(0, 0, 0, 0);
    
    let groupName;
    const daysDiff = Math.floor((today - accessedDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      groupName = 'Opened Today';
    } else if (daysDiff === 1) {
      groupName = 'Opened Yesterday';
    } else if (daysDiff < 7) {
      groupName = `Opened ${daysDiff} days ago`;
    } else {
      groupName = `Opened ${accessedDate.toLocaleDateString()}`;
    }
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
  });
  
  return groups;
}

// Group by last accessed week
function groupByLastAccessedWeek(tabs) {
  const groups = {};
  const today = new Date();
  const currentWeek = getWeekNumber(today);
  const currentYear = today.getFullYear();
  
  tabs.forEach(tab => {
    const tabDate = tab.lastAccessed ? new Date(tab.lastAccessed) : new Date(tab.savedAt);
    const tabWeek = getWeekNumber(tabDate);
    const tabYear = tabDate.getFullYear();
    
    let groupName;
    if (tabYear === currentYear && tabWeek === currentWeek) {
      groupName = 'Opened This Week';
    } else if (tabYear === currentYear && tabWeek === currentWeek - 1) {
      groupName = 'Opened Last Week';
    } else {
      // Get the Monday of that week
      const weekStart = getWeekStartDate(tabDate);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (tabYear === currentYear) {
        groupName = `Opened Week of ${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}`;
      } else {
        groupName = `Opened Week of ${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}, ${tabYear}`;
      }
    }
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
  });
  
  return groups;
}

// Group by last accessed month
function groupByLastAccessedMonth(tabs) {
  const groups = {};
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  tabs.forEach(tab => {
    const tabDate = tab.lastAccessed ? new Date(tab.lastAccessed) : new Date(tab.savedAt);
    const tabMonth = tabDate.getMonth();
    const tabYear = tabDate.getFullYear();
    
    let groupName;
    if (tabYear === currentYear && tabMonth === currentMonth) {
      groupName = 'Opened This Month';
    } else if (tabYear === currentYear && tabMonth === currentMonth - 1) {
      groupName = 'Opened Last Month';
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      groupName = `Opened ${monthNames[tabMonth]} ${tabYear}`;
    }
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
  });
  
  return groups;
}

// Toggle all groups collapsed/expanded
function toggleAllGroups() {
  const savedContent = document.getElementById('savedContent');
  if (!savedContent) return;
  
  const groupSections = savedContent.querySelectorAll('.group-section, .category-section');
  if (groupSections.length === 0) return;
  
  // Check if any group is expanded
  const anyExpanded = Array.from(groupSections).some(section => !section.classList.contains('collapsed'));
  
  // Toggle all groups
  groupSections.forEach(section => {
    const tabsList = section.querySelector('.tabs-list');
    if (tabsList) {
      if (anyExpanded) {
        section.classList.add('collapsed');
        tabsList.style.display = 'none';
      } else {
        section.classList.remove('collapsed');
        tabsList.style.display = 'block';
      }
    }
  });
  
  // Update button icon
  const btn = document.getElementById('toggleAllGroupsBtn');
  if (btn) {
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.innerHTML = anyExpanded 
        ? '<path d="M6 9l6 6 6-6"/>' // Chevron down
        : '<path d="M18 15l-6-6-6 6"/>'; // Chevron up
    }
  }
}

async function openAllTabsInGroup(tabs) {
  console.log('openAllTabsInGroup called:', { tabCount: tabs.length });
  
  if (tabs.length === 0) return;
  
  // Skip if too many tabs (safety limit)
  const maxTabs = settings.maxTabsToOpen || 50;
  if (tabs.length > maxTabs) {
    showStatus(`Too many tabs to open at once (limit: ${maxTabs})`, 'warning');
    return;
  }
  
  try {
    // Use background script to open tabs (won't be interrupted when popup closes)
    const urls = tabs.map(tab => tab.url).filter(url => url && url.length > 0);
    console.log('URLs to open:', urls);
    
    if (urls.length === 0) {
      showStatus('No valid URLs to open', 'warning');
      return;
    }
    
    // Try to use background script first
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'openMultipleTabs',
        data: { urls }
      });
      
      console.log('Background script response:', response);
      
      if (response && response.success) {
        showStatus(`Opening ${urls.length} tabs...`, 'success');
        return;
      }
    } catch (bgError) {
      console.warn('Background script communication failed:', bgError);
    }
    
    // Fallback: Open tabs directly (at least the first one will open)
    console.log('Using fallback method to open tabs');
    urls.forEach((url, index) => {
      chrome.tabs.create({ url }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Error opening tab:', chrome.runtime.lastError);
        }
      });
    });
    showStatus(`Opening ${urls.length} tabs...`, 'success');
  } catch (error) {
    console.error('Error opening tabs:', error);
    showStatus('Error opening tabs: ' + error.message, 'error');
  }
}

async function deleteTabsInGroup(tabs, groupName) {
  console.log('deleteTabsInGroup called:', { tabCount: tabs.length, groupName });
  
  if (tabs.length === 0) return;
  
  // Ask for confirmation
  const message = `Delete all ${tabs.length} tabs in "${groupName}"?\n\nThis action cannot be undone.`;
  if (!confirm(message)) {
    return;
  }
  
  try {
    showStatus('Deleting tabs...', 'loading');
    
    // Extract the tab IDs
    const tabIds = tabs.map(tab => tab.id).filter(id => id !== undefined);
    
    if (tabIds.length > 0) {
      // Delete from database
      await tabDatabase.deleteMultipleTabs(tabIds);
      
      showStatus(`Deleted ${tabIds.length} tabs from "${groupName}"`, 'success');
      
      // Refresh the saved tabs view
      showSavedTabsContent();
    } else {
      showStatus('No tabs to delete', 'warning');
    }
  } catch (error) {
    console.error('Error deleting tabs:', error);
    showStatus('Failed to delete tabs: ' + error.message, 'error');
  }
}

function createTabElement(tab, category, isFromSaved = false) {
  const div = document.createElement('div');
  div.className = 'tab-item';
  if (tab.alreadySaved) {
    div.className += ' already-saved';
  }
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
  // Build title with duplicate count only
  let titleText = tab.title;
  
  if (tab.duplicateCount && tab.duplicateCount > 1) {
    titleText += ` (${tab.duplicateCount} tabs)`;
  }
  
  title.textContent = titleText;
  title.title = tab.title;
  
  const url = document.createElement('div');
  url.className = 'tab-url';
  // Remove https:// from display
  url.textContent = tab.url.replace(/^https?:\/\//, '');
  url.title = tab.url;
  
  info.appendChild(title);
  info.appendChild(url);
  
  div.appendChild(favicon);
  div.appendChild(info);
  
  // Make tab clickable
  info.style.cursor = 'pointer';
  if (isFromSaved) {
    // For saved tabs, open in new tab
    info.onclick = () => openTab(tab.url);
  } else {
    // For current tabs, activate the tab
    info.onclick = () => {
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    };
  }
  
  // Create appropriate action buttons
  if (isFromSaved) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
    deleteBtn.title = 'Delete saved tab';
    deleteBtn.onclick = async () => {
      try {
        await tabDatabase.deleteSavedTab(tab.id);
        // Remove from current display
        div.remove();
        
        // Update categorized tabs
        categorizedTabs[category] = categorizedTabs[category].filter(t => t.id !== tab.id);
        
        // Check if category is now empty and hide it
        const categorySection = div.closest('.category-section');
        if (categorySection) {
          const remainingTabs = categorySection.querySelectorAll('.tab-item').length - 1; // -1 for the one being removed
          if (remainingTabs === 0) {
            categorySection.classList.add('empty');
          }
          // Update count
          const countSpan = categorySection.querySelector('.count');
          if (countSpan) {
            countSpan.textContent = remainingTabs;
          }
        }
        
        showStatus('Tab deleted', 'success');
      } catch (error) {
        showStatus('Error deleting tab: ' + error.message, 'error');
      }
    };
    div.appendChild(deleteBtn);
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
    // Find the tab to get its URL
    const tab = categorizedTabs[category].find(t => t.id === tabId);
    if (!tab) {
      throw new Error('Tab not found');
    }
    
    // Get all duplicate tab IDs for this URL
    const tabIdsToClose = tab.duplicateIds || [tabId];
    
    // Close all tabs with the same URL
    const { closedCount, missingCount } = await safelyCloseTabs(tabIdsToClose);
    
    // Remove from categorized tabs
    categorizedTabs[category] = categorizedTabs[category].filter(tab => tab.id !== tabId);
    
    // Check if all categories are empty
    const allEmpty = categorizedTabs[1].length === 0 && 
                     categorizedTabs[2].length === 0 && 
                     categorizedTabs[3].length === 0;
    
    if (allEmpty) {
      // Clear popup state since all tabs are closed
      await chrome.storage.local.remove('popupState');
      
      // Hide the tabs container and action buttons
      document.getElementById('tabsContainer').style.display = 'none';
      document.querySelector('.action-buttons').style.display = 'none';
    } else {
      // Update popup state with remaining tabs
      await savePopupState();
    }
    
    // Update display
    displayTabs();
    
    let statusMessage = `${closedCount} tab${closedCount > 1 ? 's' : ''} closed`;
    if (missingCount > 0) {
      statusMessage += ` (${missingCount} already closed)`;
    }
    showStatus(statusMessage, 'success');
  } catch (error) {
    showStatus('Error closing tab: ' + error.message, 'error');
  }
}

// Helper function to safely close tabs, ignoring missing tab IDs
async function safelyCloseTabs(tabIds) {
  // Query ALL tabs from ALL windows
  const allTabs = await chrome.tabs.query({});
  const existingTabIds = new Set(allTabs.map(tab => tab.id));
  
  // Get the current window ID (where the extension is running)
  const currentWindow = await chrome.windows.getCurrent();
  const currentWindowId = currentWindow.id;
  
  // Filter out tab IDs that no longer exist
  const validTabIds = tabIds.filter(id => existingTabIds.has(id));
  const missingCount = tabIds.length - validTabIds.length;
  
  if (validTabIds.length > 0) {
    // Group tabs by window
    const tabsByWindow = {};
    allTabs.forEach(tab => {
      if (validTabIds.includes(tab.id)) {
        if (!tabsByWindow[tab.windowId]) {
          tabsByWindow[tab.windowId] = [];
        }
        tabsByWindow[tab.windowId].push(tab.id);
      }
    });
    
    // Check each window to ensure we don't close all tabs in the current window
    for (const [windowId, windowTabIds] of Object.entries(tabsByWindow)) {
      const windowIdInt = parseInt(windowId);
      
      // Only protect the current window from being completely closed
      if (windowIdInt === currentWindowId) {
        const windowTabs = allTabs.filter(tab => tab.windowId === windowIdInt);
        const remainingTabs = windowTabs.filter(tab => !windowTabIds.includes(tab.id));
        
        // If we're about to close all tabs in the current window, create a new tab
        if (remainingTabs.length === 0) {
          await chrome.tabs.create({ windowId: windowIdInt, active: true });
        }
      }
      // Other windows can be closed completely
    }
    
    // Close only the tabs that still exist
    await chrome.tabs.remove(validTabIds);
  }
  
  return { closedCount: validTabIds.length, missingCount };
}

// Close all tabs in a category
async function closeAllInCategory(category) {
  const tabs = categorizedTabs[category];
  if (tabs.length === 0) return;
  
  // Collect all tab IDs including duplicates
  const allTabIds = new Set();
  tabs.forEach(tab => {
    const duplicateIds = tab.duplicateIds || [tab.id];
    duplicateIds.forEach(id => allTabIds.add(id));
  });
  
  const totalCount = allTabIds.size;
  
  try {
    const { closedCount, missingCount } = await safelyCloseTabs(Array.from(allTabIds));
    categorizedTabs[category] = [];
    
    // Check if all categories are empty
    const allEmpty = categorizedTabs[1].length === 0 && 
                     categorizedTabs[2].length === 0 && 
                     categorizedTabs[3].length === 0;
    
    if (allEmpty) {
      // Clear popup state since all tabs are closed
      await chrome.storage.local.remove('popupState');
      
      // Hide the tabs container and action buttons
      document.getElementById('tabsContainer').style.display = 'none';
      document.querySelector('.action-buttons').style.display = 'none';
    } else {
      // Update popup state with remaining tabs
      await savePopupState();
    }
    
    displayTabs();
    
    let statusMessage = `Closed ${closedCount} tab${closedCount > 1 ? 's' : ''}`;
    if (missingCount > 0) {
      statusMessage += ` (${missingCount} already closed)`;
    }
    showStatus(statusMessage, 'success');
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
    
    // Collect all tab IDs including duplicates
    const allTabIds = new Set();
    tabs.forEach(tab => {
      const duplicateIds = tab.duplicateIds || [tab.id];
      duplicateIds.forEach(id => allTabIds.add(id));
    });
    
    const { closedCount, missingCount } = await safelyCloseTabs(Array.from(allTabIds));
    categorizedTabs[category] = [];
    
    // Check if all categories are empty
    const allEmpty = categorizedTabs[1].length === 0 && 
                     categorizedTabs[2].length === 0 && 
                     categorizedTabs[3].length === 0;
    
    if (allEmpty) {
      // Clear popup state since all tabs are closed
      await chrome.storage.local.remove('popupState');
      
      // Hide the tabs container and action buttons
      document.getElementById('tabsContainer').style.display = 'none';
      document.querySelector('.action-buttons').style.display = 'none';
    } else {
      // Update popup state with remaining tabs
      await savePopupState();
    }
    
    displayTabs();
    
    let statusMessage = `Saved and closed ${closedCount} tab${closedCount > 1 ? 's' : ''}`;
    if (missingCount > 0) {
      statusMessage += ` (${missingCount} already closed)`;
    }
    showStatus(statusMessage, 'success');
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
    
    // Collect all tab IDs including duplicates
    const allTabIds = new Set();
    tabsToClose.forEach(tab => {
      const duplicateIds = tab.duplicateIds || [tab.id];
      duplicateIds.forEach(id => allTabIds.add(id));
    });
    
    // Close all tabs including duplicates
    let closedCount = 0;
    let missingCount = 0;
    if (allTabIds.size > 0) {
      const result = await safelyCloseTabs(Array.from(allTabIds));
      closedCount = result.closedCount;
      missingCount = result.missingCount;
    }
    
    let message = `Saved ${tabsToSave.length} tabs, closed ${closedCount} tab${closedCount > 1 ? 's' : ''}`;
    if (missingCount > 0) {
      message += ` (${missingCount} already closed)`;
    }
    showStatus(message, 'success');
    
    // Clear categorized tabs
    categorizedTabs = { 1: [], 2: [], 3: [] };
    
    // Clear popup state since all tabs are closed
    await chrome.storage.local.remove('popupState');
    
    // Hide the tabs container and action buttons
    document.getElementById('tabsContainer').style.display = 'none';
    document.querySelector('.action-buttons').style.display = 'none';
    
    // Switch to saved tab to show the saved tabs
    setTimeout(() => {
      switchToTab('saved');
    }, 500);
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
      // Collect all tab IDs including duplicates
      const allTabIds = new Set();
      const allTabs = [
        ...categorizedTabs[1],
        ...categorizedTabs[2],
        ...categorizedTabs[3]
      ];
      
      allTabs.forEach(tab => {
        const duplicateIds = tab.duplicateIds || [tab.id];
        duplicateIds.forEach(id => allTabIds.add(id));
      });
      
      const { closedCount, missingCount } = await safelyCloseTabs(Array.from(allTabIds));
      
      let statusMessage = `Saved to database and closed ${closedCount} tab${closedCount > 1 ? 's' : ''}`;
      if (missingCount > 0) {
        statusMessage += ` (${missingCount} already closed)`;
      }
      showStatus(statusMessage, 'success');
      
      // Update saved badge
      updateSavedBadge();
      
      // Show option to view saved tabs with info about excluded tabs
      const excludedCount = categorizedTabs[1].length;
      const savedCount = categorizedTabs[2].length + categorizedTabs[3].length;
      
      // Clear popup state and switch to saved tab
      await chrome.storage.local.remove('popupState');
      
      // Clear categorized tabs from UI
      categorizedTabs = { 1: [], 2: [], 3: [] };
      
      // Hide the tabs container and action buttons
      document.getElementById('tabsContainer').style.display = 'none';
      document.querySelector('.action-buttons').style.display = 'none';
      
      setTimeout(() => {
        switchToTab('saved');
      }, 500);
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

function clearStatus() {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.textContent = '';
    statusDiv.className = 'status';
  }
}

function onPromptChange(e) {
  settings.customPrompt = e.target.value;
  // Mark as customized if different from default
  settings.isPromptCustomized = (e.target.value !== CONFIG.DEFAULT_PROMPT && e.target.value !== '');
  saveSettings();
  updatePromptStatus();
}

function resetPrompt() {
  settings.customPrompt = CONFIG.DEFAULT_PROMPT;
  settings.isPromptCustomized = false;
  settings.promptVersion = CONFIG.PROMPT_VERSION;
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
  
  if (isDefault && !settings.isPromptCustomized) {
    promptStatus.textContent = `(Using default prompt v${CONFIG.PROMPT_VERSION})`;
    promptStatus.style.color = 'var(--text-muted)';
  } else if (settings.isPromptCustomized) {
    promptStatus.textContent = '(Using custom prompt)';
    promptStatus.style.color = 'var(--warning-color)';
  } else {
    // Edge case: prompt matches default but was previously customized
    promptStatus.textContent = '(Using default prompt)';
    promptStatus.style.color = 'var(--text-muted)';
  }
}

// Open a single tab
function openTab(url) {
  chrome.tabs.create({ url: url }, (tab) => {
    showStatus('Tab opened', 'success');
  });
}

// Open all tabs in a category
async function openAllTabsInCategory(category) {
  const tabs = categorizedTabs[category];
  console.log('openAllTabsInCategory called:', { category, tabCount: tabs.length });
  
  if (tabs.length === 0) return;
  
  // Skip if too many tabs (safety limit)
  const maxTabs = settings.maxTabsToOpen || 50;
  if (tabs.length > maxTabs) {
    showStatus(`Too many tabs to open at once (limit: ${maxTabs})`, 'warning');
    return;
  }
  
  try {
    // Use background script to open tabs (won't be interrupted when popup closes)
    const urls = tabs.map(tab => tab.url).filter(url => url && url.length > 0);
    console.log('URLs to open:', urls);
    
    if (urls.length === 0) {
      showStatus('No valid URLs to open', 'warning');
      return;
    }
    
    // Try to use background script first
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'openMultipleTabs',
        data: { urls }
      });
      
      console.log('Background script response:', response);
      
      if (response && response.success) {
        showStatus(`Opening ${urls.length} tabs...`, 'success');
        return;
      }
    } catch (bgError) {
      console.warn('Background script communication failed:', bgError);
    }
    
    // Fallback: Open tabs directly (at least the first one will open)
    console.log('Using fallback method to open tabs');
    urls.forEach((url, index) => {
      chrome.tabs.create({ url }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Error opening tab:', chrome.runtime.lastError);
        }
      });
    });
    showStatus(`Opening ${urls.length} tabs...`, 'success');
  } catch (error) {
    console.error('Error opening tabs:', error);
    showStatus('Error opening tabs: ' + error.message, 'error');
  }
}

// Show saved tabs content in the saved tab
async function showSavedTabsContent(groupingType) {
  try {
    // Make sure the saved tab pane exists and is ready
    const savedTab = document.getElementById('savedTab');
    if (!savedTab) {
      console.error('Saved tab pane not found');
      return;
    }
    
    const allSavedTabs = await tabDatabase.getAllSavedTabs();
    
    // Get current grouping from dropdown if not passed
    if (!groupingType) {
      const savedGroupingSelect = document.getElementById('savedGroupingSelect');
      groupingType = savedGroupingSelect ? savedGroupingSelect.value : 'category';
    }
    
    // Store the saved tabs in a temporary object for display (don't overwrite categorizedTabs)
    const savedTabsByCategory = { 1: [], 2: [], 3: [] };
    allSavedTabs.forEach(tab => {
      if (savedTabsByCategory[tab.category]) {
        savedTabsByCategory[tab.category].push(tab);
      }
    });
    
    // Get the saved content container
    const savedContent = document.getElementById('savedContent');
    savedContent.innerHTML = '';
    
    if (groupingType === 'category') {
      // Create a category view in saved content
      const categoryView = document.createElement('div');
      categoryView.className = 'grouping-view';
      categoryView.id = 'savedCategoryView';
    
      // Display each category
      [3, 2, 1].forEach(category => {
        const tabs = savedTabsByCategory[category] || [];
      if (tabs.length === 0) return; // Skip empty categories
      
      const section = document.createElement('div');
      section.className = 'category-section';
      section.id = `savedCategory${category}`;
      
      const header = document.createElement('h2');
      header.className = `category-header ${category === 3 ? 'important' : category === 2 ? 'somewhat-important' : 'not-important'}`;
      
      const iconSvg = category === 3 
        ? '<svg class="category-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
        : category === 2
        ? '<svg class="category-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>'
        : '<svg class="category-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      
      const categoryName = category === 3 ? 'Important Links' : category === 2 ? 'Save for Later' : 'Can Be Closed';
      header.innerHTML = `
        <div class="category-header-title">
          ${iconSvg} ${categoryName} (<span class="count">${tabs.length}</span>)
        </div>
        <div class="category-header-actions"></div>
      `;
      
      // Add action buttons to header
      if (tabs.length > 0) {
        const headerActions = header.querySelector('.category-header-actions');
        
        // Open All button with icon
        const openAllBtn = document.createElement('button');
        openAllBtn.className = 'icon-btn';
        openAllBtn.title = `Open all ${tabs.length} tabs`;
        openAllBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        `;
        openAllBtn.onclick = () => openAllTabsInGroup(tabs);
        
        // Delete all button with icon
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn delete-btn';
        deleteBtn.title = `Delete all ${tabs.length} tabs`;
        deleteBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        `;
        deleteBtn.onclick = () => deleteTabsInGroup(tabs, categoryName);
        
        headerActions.appendChild(openAllBtn);
        headerActions.appendChild(deleteBtn);
      }
      
      const listContainer = document.createElement('div');
      listContainer.className = 'tabs-list';
      
      // Add tabs
      tabs.forEach(tab => {
        const tabElement = createTabElement(tab, category, true);
        listContainer.appendChild(tabElement);
      });
      
      section.appendChild(header);
      section.appendChild(listContainer);
      
      // Make category header clickable to collapse/expand
      header.style.cursor = 'pointer';
      header.onclick = (e) => {
        // Don't collapse if clicking on action buttons
        if (e.target.closest('.category-header-actions')) return;
        
        section.classList.toggle('collapsed');
        const isCollapsed = section.classList.contains('collapsed');
        listContainer.style.display = isCollapsed ? 'none' : 'block';
      };
      
      categoryView.appendChild(section);
    });
    
    if (allSavedTabs.length === 0) {
      // Show empty state message
      const emptyMessage = document.createElement('div');
      emptyMessage.style.textAlign = 'center';
      emptyMessage.style.padding = '40px 20px';
      emptyMessage.style.color = 'var(--text-secondary)';
      emptyMessage.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 16px; display: block; opacity: 0.5;">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
        <h3 style="margin: 0 0 8px 0; font-weight: 500;">No saved tabs yet</h3>
        <p style="margin: 0; font-size: 14px;">Categorize your tabs and save them to view here</p>
      `;
      savedContent.appendChild(emptyMessage);
    } else {
      savedContent.appendChild(categoryView);
      // Count non-empty categories
      const nonEmptyCategories = [1, 2, 3].filter(cat => savedTabsByCategory[cat].length > 0).length;
      showStatus(`Viewing ${allSavedTabs.length} saved tabs in ${nonEmptyCategories} ${nonEmptyCategories === 1 ? 'category' : 'categories'}`, 'success');
    }
    } else {
      // For grouped view, we need to temporarily set categorizedTabs and restore it after
      const originalCategorizedTabs = {
        1: [...categorizedTabs[1]],
        2: [...categorizedTabs[2]],
        3: [...categorizedTabs[3]]
      };
      categorizedTabs = savedTabsByCategory;
      
      // Use the existing displayGroupedView function for other groupings
      isViewingSaved = true;
      const groupedView = displayGroupedView(groupingType, true);
      if (groupedView) {
        savedContent.appendChild(groupedView);
        
        // Count groups and update status
        const groupElements = groupedView.querySelectorAll('.group-section');
        const groupCount = groupElements.length;
        let groupTypeLabel = 'groups';
        
        switch (groupingType) {
          case 'domain':
            groupTypeLabel = groupCount === 1 ? 'domain' : 'domains';
            break;
          case 'savedDate':
            groupTypeLabel = groupCount === 1 ? 'save date' : 'save dates';
            break;
          case 'savedWeek':
            groupTypeLabel = groupCount === 1 ? 'save week' : 'save weeks';
            break;
          case 'savedMonth':
            groupTypeLabel = groupCount === 1 ? 'save month' : 'save months';
            break;
          case 'lastAccessedDate':
            groupTypeLabel = groupCount === 1 ? 'open date' : 'open dates';
            break;
          case 'lastAccessedWeek':
            groupTypeLabel = groupCount === 1 ? 'open week' : 'open weeks';
            break;
          case 'lastAccessedMonth':
            groupTypeLabel = groupCount === 1 ? 'open month' : 'open months';
            break;
        }
        
        showStatus(`Viewing ${allSavedTabs.length} saved tabs in ${groupCount} ${groupTypeLabel}`, 'success');
      }
      
      // Restore original categorized tabs
      categorizedTabs = originalCategorizedTabs;
    }
    
    // Don't restore scroll during initialization - it's handled centrally
    if (!isInitializing) {
      restoreScrollPosition('saved', 100);
      restoreScrollPosition('saved', 500);
      restoreScrollPosition('saved', 1000);
    }
    
  } catch (error) {
    showStatus('Error loading saved tabs: ' + error.message, 'error');
  }
}

// Legacy function for compatibility
async function showSavedTabs() {
  switchToTab('saved');
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
  
  // Save the updated state
  savePopupState();
  
  // Refresh display
  displayTabs(isViewingSaved);
  
  showStatus(`Moved to ${toCategory === 3 ? 'Important' : toCategory === 2 ? 'Save for Later' : 'Can Be Closed'}`, 'success');
}

// Search functionality
function onSearchInput(e) {
  searchQuery = e.target.value.toLowerCase().trim();
  applySearchFilter();
  savePopupState();
}

function clearSearch() {
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  applySearchFilter();
  savePopupState();
  
  // Reset category counts
  [1, 2, 3].forEach(category => {
    const countElement = document.querySelector(`#category${category} .count`);
    if (countElement && categorizedTabs[category]) {
      countElement.textContent = categorizedTabs[category].length;
    }
  });
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
  const visibleByCategory = { 1: 0, 2: 0, 3: 0 };
  
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
      visibleByCategory[category]++;
    } else {
      tabElement.classList.add('hidden');
      tabElement.classList.remove('search-match');
    }
  });
  
  // Update category counts
  [1, 2, 3].forEach(category => {
    const countElement = document.querySelector(`#category${category} .count`);
    if (countElement) {
      if (searchQuery) {
        countElement.textContent = `${visibleByCategory[category]} of ${categorizedTabs[category].length}`;
      } else {
        countElement.textContent = categorizedTabs[category].length;
      }
    }
  });
  
  // Update categorize tab badge with important + save for later counts
  updateCategorizeBadge();
  
  // Update status
  if (searchQuery) {
    showStatus(`Found ${visibleCount} tabs matching "${searchQuery}"`, 'success');
  }
}

// Update the categorize tab badge
function updateCategorizeBadge() {
  const badge = document.getElementById('categorizeBadge');
  if (!badge) return;
  
  const importantCount = categorizedTabs[3] ? categorizedTabs[3].length : 0;
  const saveForLaterCount = categorizedTabs[2] ? categorizedTabs[2].length : 0;
  const total = importantCount + saveForLaterCount;
  
  if (total > 0) {
    badge.textContent = total;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// Update the saved tab badge
async function updateSavedBadge() {
  const badge = document.getElementById('savedBadge');
  if (!badge) return;
  
  try {
    await tabDatabase.init();
    const savedTabs = await tabDatabase.getAllSavedTabs();
    const importantCount = savedTabs.filter(tab => tab.category === 3).length;
    const saveForLaterCount = savedTabs.filter(tab => tab.category === 2).length;
    const total = importantCount + saveForLaterCount;
    
    if (total > 0) {
      badge.textContent = total;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  } catch (error) {
    console.error('Error updating saved badge:', error);
  }
}

// Clear popup state on window unload
window.addEventListener('beforeunload', () => {
  // Only save state if we have tabs displayed
  if (document.getElementById('tabsContainer').style.display !== 'none') {
    savePopupState();
  }
});

// Grouping change handler for categorize tab
function onGroupingChange(e) {
  const newGrouping = e.target.value;
  popupState.groupingSelections.categorize = newGrouping;
  savePopupState();
  displayTabs();
}

// Toggle all groups in categorize tab
function toggleCategorizeGroups() {
  const container = isViewingSaved ? document.getElementById('savedContent') : document.getElementById('tabsContainer');
  if (!container) return;
  
  const groupSections = container.querySelectorAll('.group-section, .category-section');
  if (groupSections.length === 0) return;
  
  // Check if any group is expanded
  const anyExpanded = Array.from(groupSections).some(section => !section.classList.contains('collapsed'));
  
  // Toggle all groups
  groupSections.forEach(section => {
    const tabsList = section.querySelector('.tabs-list');
    if (tabsList) {
      if (anyExpanded) {
        section.classList.add('collapsed');
        tabsList.style.display = 'none';
      } else {
        section.classList.remove('collapsed');
        tabsList.style.display = 'block';
      }
    }
  });
  
  // Update button icon
  const btn = document.getElementById('toggleCategorizeGroupsBtn');
  if (btn) {
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.innerHTML = anyExpanded 
        ? '<path d="M6 9l6 6 6-6"/>' // Chevron down
        : '<path d="M18 15l-6-6-6 6"/>'; // Chevron up
    }
  }
}

// Saved tab event handlers
function onSavedGroupingChange(e) {
  const newGrouping = e.target.value;
  // Update the grouping and refresh the saved tabs display
  showSavedTabsContent(newGrouping);
}

function onSavedSearchInput(e) {
  const searchQuery = e.target.value.toLowerCase().trim();
  applySavedSearchFilter(searchQuery);
}

function clearSavedSearch() {
  document.getElementById('savedSearchInput').value = '';
  onSavedSearchInput({ target: { value: '' } });
}

function applySavedSearchFilter(searchQuery) {
  const savedContent = document.getElementById('savedContent');
  if (!savedContent) return;
  
  // Get all tab elements in saved content
  const allTabs = savedContent.querySelectorAll('.tab-item');
  let visibleCount = 0;
  let totalCount = 0;
  
  allTabs.forEach(tab => {
    totalCount++;
    const title = tab.querySelector('.tab-title')?.textContent.toLowerCase() || '';
    const url = tab.querySelector('.tab-url')?.textContent.toLowerCase() || '';
    const domain = tab.querySelector('.tab-domain')?.textContent.toLowerCase() || '';
    
    // Check if search query matches title, URL, or domain
    const matches = !searchQuery || 
                   title.includes(searchQuery) || 
                   url.includes(searchQuery) || 
                   domain.includes(searchQuery);
    
    if (matches) {
      tab.style.display = '';
      visibleCount++;
    } else {
      tab.style.display = 'none';
    }
  });
  
  // Also handle group sections - hide empty groups
  const groupSections = savedContent.querySelectorAll('.group-section, .category-section');
  groupSections.forEach(section => {
    const visibleTabs = section.querySelectorAll('.tab-item:not([style*="display: none"])');
    if (visibleTabs.length === 0 && searchQuery) {
      section.style.display = 'none';
    } else {
      section.style.display = '';
      
      // Update count in header if it exists
      const countElement = section.querySelector('.count, .group-stats .total');
      if (countElement && searchQuery) {
        countElement.textContent = `${visibleTabs.length} of ${section.querySelectorAll('.tab-item').length}`;
      }
    }
  });
  
  // Update status
  if (searchQuery) {
    showStatus(`Found ${visibleCount} of ${totalCount} saved tabs matching "${searchQuery}"`, 'success');
  } else {
    // Restore original status
    const savedGroupingSelect = document.getElementById('savedGroupingSelect');
    if (savedGroupingSelect) {
      showSavedTabsContent(savedGroupingSelect.value);
    }
  }
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

// Export tabs to CSV
async function exportToCSV() {
  try {
    showStatus('Exporting tabs to CSV...', 'loading');
    
    const csvContent = await tabDatabase.exportAsCSV();
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = `saved_tabs_${new Date().toISOString().split('T')[0]}.csv`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    
    URL.revokeObjectURL(url);
    
    showStatus('Tabs exported successfully', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showStatus('Failed to export tabs: ' + error.message, 'error');
  }
}

// Handle CSV import
async function handleCSVImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    showStatus('Reading CSV file...', 'loading');
    
    const csvContent = await readFileAsText(file);
    
    // Show import dialog to confirm
    const confirmed = await showImportDialog(csvContent);
    
    if (confirmed) {
      showStatus('Importing tabs...', 'loading');
      
      // Get current settings for categorization
      const importSettings = {
        apiKey: settings.apiKeys[settings.provider],
        provider: settings.provider,
        model: settings.model,
        customPrompt: settings.customPrompt
      };
      
      const result = await tabDatabase.importFromCSV(csvContent, importSettings);
      
      // Build status message
      let statusMessage;
      const details = [];
      
      if (result.imported === 0 && result.duplicates > 0) {
        // All tabs were duplicates
        statusMessage = `No new tabs imported (all ${result.duplicates} were already saved)`;
      } else if (result.imported === 0) {
        // No valid tabs found
        statusMessage = 'No valid tabs found in CSV file';
      } else {
        // Normal import
        statusMessage = `Imported ${result.imported} tabs`;
        
        if (result.duplicates > 0) {
          details.push(`${result.duplicates} duplicates skipped`);
        }
        
        if (result.categorized > 0) {
          details.push(`${result.categorized} categorized by AI`);
        }
        
        if (details.length > 0) {
          statusMessage += ` (${details.join(', ')})`;
        }
      }
      
      showStatus(statusMessage, result.imported > 0 ? 'success' : 'warning');
      
      // Store the import message to preserve it
      const importMessage = statusMessage;
      const importStatus = result.imported > 0 ? 'success' : 'warning';
      
      // Refresh saved tabs view if currently showing
      if (popupState.activeTab === 'saved') {
        await showSavedTabsContent();
        // Restore the import status message after refresh
        showStatus(importMessage, importStatus);
      }
    }
  } catch (error) {
    console.error('Import error:', error);
    showStatus('Failed to import tabs: ' + error.message, 'error');
  }
  
  // Reset file input
  event.target.value = '';
}

// Read file as text
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Show import confirmation dialog
async function showImportDialog(csvContent) {
  // Simple preview of the CSV
  const lines = csvContent.split('\n').filter(line => line.trim());
  const rowCount = lines.length - 1; // Minus header
  
  
  const message = `Import ${rowCount} rows from CSV?\n\n` +
    `Note: Tabs without categories will be categorized using ${settings.provider} if API key is available.`;
  
  return confirm(message);
}