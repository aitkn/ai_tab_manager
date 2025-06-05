/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Proprietary License - See LICENSE file
 * support@aitkn.com
 */

// Background service worker for handling API calls

// Import scripts at top level for service worker
importScripts('database_v3.js');

console.log('Background service worker starting...');

// Track current state
let currentCategorization = null;
let isPopupOpen = false;
let popupPort = null;

// Store categorized tabs in background
let categorizedTabs = {
  0: [], // Uncategorized
  1: [], // Can close
  2: [], // Save for later
  3: []  // Important
};
let urlToDuplicateIds = {};

// Helper function to extract domain (defined early for startup use)
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

// Initialize with database and track open tabs
async function initializeTabTracking() {
  try {
    // Initialize database
    await globalThis.tabDatabase.init();
    console.log('Background: Database initialized');
    
    // Migrate from old database if needed
    await globalThis.tabDatabase.migrateFromOldDatabase();
    
    // Query all current tabs
    const tabs = await chrome.tabs.query({});
    console.log('Background: Initializing with', tabs.length, 'existing tabs');
    
    // Get all known URLs from database
    const knownUrls = await globalThis.tabDatabase.getAllUrls();
    const urlCategoryMap = new Map();
    knownUrls.forEach(urlInfo => {
      urlCategoryMap.set(urlInfo.url, urlInfo.category);
    });
    
    // Process each tab
    for (const tab of tabs) {
      // Skip empty tabs, chrome:// URLs, and about:blank
      if (tab.url && 
          !tab.url.startsWith('chrome://') &&
          tab.url !== 'about:blank' &&
          tab.url !== '') {
        const category = urlCategoryMap.get(tab.url) || 0; // Default to uncategorized
        
        // Add to appropriate category
        if (!categorizedTabs[category]) {
          categorizedTabs[category] = [];
        }
        
        categorizedTabs[category].push({
          id: tab.id,
          url: tab.url,
          title: tab.title || 'Loading...',
          domain: extractDomain(tab.url),
          windowId: tab.windowId,
          alreadyCategorized: category !== 0,
          knownCategory: category
        });
        
        // Record open event in database
        const urlId = await globalThis.tabDatabase.getOrCreateUrl(tab, category);
        await globalThis.tabDatabase.recordOpenEvent(urlId, tab.id);
      }
    }
    
    // Build urlToDuplicateIds mapping
    urlToDuplicateIds = {};
    const urlToTabs = new Map();
    
    // Group tabs by URL
    for (const category of Object.keys(categorizedTabs)) {
      categorizedTabs[category].forEach(tab => {
        if (!urlToTabs.has(tab.url)) {
          urlToTabs.set(tab.url, []);
        }
        urlToTabs.get(tab.url).push(tab.id);
      });
    }
    
    // Build duplicate mapping for URLs with multiple tabs
    urlToTabs.forEach((tabIds, url) => {
      if (tabIds.length > 1) {
        urlToDuplicateIds[url] = tabIds;
      }
    });
    
    console.log('Background: Categorized tabs on startup:', {
      uncategorized: categorizedTabs[0].length,
      canClose: categorizedTabs[1].length,
      saveLater: categorizedTabs[2].length,
      important: categorizedTabs[3].length,
      duplicateUrls: Object.keys(urlToDuplicateIds).length
    });
    
  } catch (error) {
    console.error('Background: Error initializing tab tracking:', error);
  }
}

// Start initialization
initializeTabTracking();

// Listen for connections from popup
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    console.log('Background: Popup connected');
    popupPort = port;
    isPopupOpen = true;
    
    port.onDisconnect.addListener(() => {
      console.log('Background: Popup disconnected');
      popupPort = null;
      isPopupOpen = false;
    });
  }
});

// Import configuration
try {
  importScripts('config.js');
  console.log('Config loaded successfully');
} catch (error) {
  console.error('Failed to load config:', error);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  // Test message
  if (request.action === 'test') {
    console.log('Test message received');
    sendResponse({ status: 'Background script is running' });
    return false;
  }
  
  // Handle opening multiple tabs
  if (request.action === 'openMultipleTabs') {
    const { urls } = request.data;
    console.log('Background: Opening', urls.length, 'tabs');
    console.log('URLs:', urls);
    
    try {
      // Open tabs with delay to prevent browser overload
      urls.forEach((url, index) => {
        setTimeout(() => {
          console.log('Opening tab', index + 1, 'of', urls.length, ':', url);
          chrome.tabs.create({ url }, (tab) => {
            if (chrome.runtime.lastError) {
              console.error('Error opening tab:', chrome.runtime.lastError);
            } else {
              console.log('Successfully opened tab:', tab.id);
            }
          });
        }, index * 100); // 100ms delay between each tab
      });
      
      sendResponse({ success: true, count: urls.length });
    } catch (error) {
      console.error('Error in openMultipleTabs:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }
  
  if (request.action === 'categorizeTabs') {
    handleCategorizeTabs(request.data)
      .then(result => {
        console.log('Background sending success response');
        sendResponse(result);
      })
      .catch(error => {
        console.error('Background sending error response:', error);
        sendResponse({ error: error.message, stack: error.stack });
      });
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'fetchModels') {
    handleFetchModels(request.data)
      .then(result => {
        console.log('Background sending models response');
        sendResponse(result);
      })
      .catch(error => {
        console.error('Background error fetching models:', error);
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  }
  
  
  if (request.action === 'updateCategorization') {
    currentCategorization = request.data;
    sendResponse({ status: 'categorization stored' });
    return false;
  }
  
  // Store categorized tabs from popup
  if (request.action === 'storeCategorizedTabs') {
    categorizedTabs = request.data.categorizedTabs || categorizedTabs;
    urlToDuplicateIds = request.data.urlToDuplicateIds || urlToDuplicateIds;
    console.log('Background: Stored categorized tabs');
    sendResponse({ status: 'stored' });
    return false;
  }
  
  // Get categorized tabs for popup
  if (request.action === 'getCategorizedTabs') {
    sendResponse({ 
      categorizedTabs: categorizedTabs,
      urlToDuplicateIds: urlToDuplicateIds
    });
    return false;
  }
  
  
  // Default response for unknown actions
  sendResponse({ error: 'Unknown action: ' + request.action });
  return false;
});

// Tab event listeners
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log('Background: Tab created:', tab.id, tab.url, 'Popup open:', isPopupOpen);
  
  // Add new tab to appropriate category based on database
  // Skip empty tabs, chrome:// URLs, and about:blank
  if (tab.url && 
      tab.url !== 'chrome://newtab/' && 
      !tab.url.startsWith('chrome://') &&
      tab.url !== 'about:blank' &&
      tab.url !== '') {
    try {
      // Check if URL is known in database
      const urlInfo = await globalThis.tabDatabase.getUrlInfo(tab.url);
      const category = urlInfo ? urlInfo.category : 0; // Default to uncategorized
      
      // Check if this URL already exists in current tabs
      let isDuplicate = false;
      for (const cat of Object.keys(categorizedTabs)) {
        if (categorizedTabs[cat].some(t => t.url === tab.url)) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        // Add to appropriate category
        if (!categorizedTabs[category]) {
          categorizedTabs[category] = [];
        }
        
        categorizedTabs[category].push({
          id: tab.id,
          url: tab.url,
          title: tab.title || 'Loading...',
          domain: extractDomain(tab.url),
          windowId: tab.windowId,
          alreadyCategorized: category !== 0,
          knownCategory: category
        });
        
        console.log('Background: Added tab to category', category, ':', tab.id);
      } else {
        // Tab is a duplicate - update urlToDuplicateIds
        if (!urlToDuplicateIds[tab.url]) {
          // Find all tabs with this URL
          const tabsWithUrl = [];
          for (const cat of Object.keys(categorizedTabs)) {
            categorizedTabs[cat].forEach(t => {
              if (t.url === tab.url) {
                tabsWithUrl.push(t.id);
              }
            });
          }
          // Add the new tab
          tabsWithUrl.push(tab.id);
          if (tabsWithUrl.length > 1) {
            urlToDuplicateIds[tab.url] = tabsWithUrl;
          }
        } else {
          // Add to existing duplicate list
          urlToDuplicateIds[tab.url].push(tab.id);
        }
        console.log('Background: Tab is duplicate of', tab.url, 'total duplicates:', urlToDuplicateIds[tab.url].length);
      }
      
      // Record open event in database
      const urlId = await globalThis.tabDatabase.getOrCreateUrl(tab, category);
      await globalThis.tabDatabase.recordOpenEvent(urlId, tab.id);
      
    } catch (error) {
      console.error('Background: Error processing new tab:', error);
    }
  }
  
  notifyPopupOfTabChange('created', tab);
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log('Background: Tab removed:', tabId, 'Popup open:', isPopupOpen);
  
  // Record close event in database
  try {
    await globalThis.tabDatabase.recordCloseEvent(tabId);
  } catch (error) {
    console.error('Background: Error recording close event:', error);
  }
  
  // Remove from categorized tabs even if popup is closed
  let removed = false;
  for (const category of Object.keys(categorizedTabs)) {
    const index = categorizedTabs[category].findIndex(tab => tab.id === tabId);
    if (index > -1) {
      const removedTab = categorizedTabs[category].splice(index, 1)[0];
      console.log('Background: Removed tab from category', category);
      removed = true;
      
      // Also check for duplicates
      if (removedTab.url && urlToDuplicateIds[removedTab.url]) {
        const dupIndex = urlToDuplicateIds[removedTab.url].indexOf(tabId);
        if (dupIndex > -1) {
          urlToDuplicateIds[removedTab.url].splice(dupIndex, 1);
          if (urlToDuplicateIds[removedTab.url].length <= 1) {
            // If only 1 or 0 tabs left, no duplicates anymore
            delete urlToDuplicateIds[removedTab.url];
          }
        }
      }
      break;
    }
  }
  
  if (removed) {
    console.log('Background: Updated categorized tabs after removal');
  }
  
  notifyPopupOfTabChange('removed', { id: tabId });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Handle URL changes (e.g., from chrome://newtab/ to a real URL)
  // Skip empty tabs, chrome:// URLs, and about:blank
  if (changeInfo.url && tab.url && 
      !tab.url.startsWith('chrome://') &&
      tab.url !== 'about:blank' &&
      tab.url !== '') {
    try {
      // Check if this tab is already in any category
      let currentCategory = null;
      let currentIndex = -1;
      
      for (const category of Object.keys(categorizedTabs)) {
        const index = categorizedTabs[category].findIndex(t => t.id === tabId);
        if (index > -1) {
          currentCategory = category;
          currentIndex = index;
          break;
        }
      }
      
      // Check if URL is known in database
      const urlInfo = await globalThis.tabDatabase.getUrlInfo(tab.url);
      const targetCategory = urlInfo ? urlInfo.category : 0; // Default to uncategorized
      
      // If tab is not tracked yet, add it
      if (currentCategory === null) {
        // Check if URL is a duplicate in current tabs
        let isDuplicate = false;
        for (const category of Object.keys(categorizedTabs)) {
          if (categorizedTabs[category].some(t => t.url === tab.url)) {
            isDuplicate = true;
            break;
          }
        }
        
        if (!isDuplicate) {
          if (!categorizedTabs[targetCategory]) {
            categorizedTabs[targetCategory] = [];
          }
          
          categorizedTabs[targetCategory].push({
            id: tab.id,
            url: tab.url,
            title: tab.title || 'Loading...',
            domain: extractDomain(tab.url),
            windowId: tab.windowId,
            alreadyCategorized: targetCategory !== 0,
            knownCategory: targetCategory
          });
          console.log('Background: Added navigated tab to category', targetCategory, ':', tab.id, tab.url);
        }
      } else if (currentCategory !== targetCategory.toString()) {
        // Move tab to correct category if it changed
        const tabData = categorizedTabs[currentCategory][currentIndex];
        categorizedTabs[currentCategory].splice(currentIndex, 1);
        
        if (!categorizedTabs[targetCategory]) {
          categorizedTabs[targetCategory] = [];
        }
        
        categorizedTabs[targetCategory].push({
          ...tabData,
          url: tab.url,
          title: tab.title || tabData.title,
          domain: extractDomain(tab.url),
          alreadyCategorized: targetCategory !== 0,
          knownCategory: targetCategory
        });
        
        console.log('Background: Moved tab from category', currentCategory, 'to', targetCategory);
      }
      
      // Record in database
      const urlId = await globalThis.tabDatabase.getOrCreateUrl(tab, targetCategory);
      await globalThis.tabDatabase.recordOpenEvent(urlId, tab.id);
      
    } catch (error) {
      console.error('Background: Error handling URL update:', error);
    }
  }
  
  // Update title when it becomes available
  if (changeInfo.title) {
    // Update in all categories
    for (const category of Object.keys(categorizedTabs)) {
      const categoryTab = categorizedTabs[category].find(t => t.id === tabId);
      if (categoryTab) {
        categoryTab.title = changeInfo.title;
        console.log('Background: Updated tab title in category', category, ':', tabId, changeInfo.title);
        break;
      }
    }
  }
  
  // Only notify on complete navigation to avoid too many updates
  if (changeInfo.status === 'complete') {
    console.log('Background: Tab updated:', tabId, tab.url, 'Popup open:', isPopupOpen);
    notifyPopupOfTabChange('updated', tab);
  }
});

// Function to notify popup of tab changes
function notifyPopupOfTabChange(action, tabInfo) {
  if (!isPopupOpen || !popupPort) {
    console.log('Background: Skipping notification - popup not open or not connected');
    return;
  }
  
  const notification = {
    changeType: action,
    tab: tabInfo,
    timestamp: Date.now()
  };
  
  try {
    // Send message through port
    popupPort.postMessage({
      action: 'tabChanged',
      data: notification
    });
    console.log('Background: Sent tab change notification:', action);
  } catch (error) {
    console.log('Background: Error sending notification:', error);
  }
}

async function handleCategorizeTabs({ tabs, apiKey, provider, model, customPrompt, savedUrls = [] }) {
  console.log('Background: Categorizing tabs with', provider, model, tabs.length, 'tabs');
  console.log('Using custom prompt:', !!customPrompt);
  console.log('Saved URLs to exclude from LLM:', savedUrls.length);
  if (savedUrls.length > 0) {
    console.log('Sample saved URLs:', savedUrls.slice(0, 5));
  }
  
  try {
    // Convert saved URLs array to Set for faster lookup
    const savedUrlsSet = new Set(savedUrls);
    
    // Deduplicate tabs before sending to LLM
    const { deduplicatedTabs, urlToOriginalTabs, savedTabsMap } = deduplicateTabs(tabs, savedUrlsSet);
    console.log(`Deduplication: ${tabs.length} tabs -> ${deduplicatedTabs.length} unique URLs`);
    
    // If no tabs to categorize after filtering, return empty result
    if (deduplicatedTabs.length === 0) {
      console.log('No new tabs to categorize after filtering saved URLs');
      return { success: true, data: { 1: [], 2: [], 3: [] } };
    }
    
    let categorized;
    
    switch (provider) {
      case 'Claude':
        categorized = await callClaudeAPI(deduplicatedTabs, apiKey, model, customPrompt);
        break;
      case 'OpenAI':
        categorized = await callOpenAIAPI(deduplicatedTabs, apiKey, model, customPrompt);
        break;
      case 'Gemini':
        categorized = await callGeminiAPI(deduplicatedTabs, apiKey, model, customPrompt);
        break;
      case 'DeepSeek':
        categorized = await callDeepSeekAPI(deduplicatedTabs, apiKey, model, customPrompt);
        break;
      case 'Grok':
        categorized = await callGrokAPI(deduplicatedTabs, apiKey, model, customPrompt);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
    
    // Map categorized results back to all original tabs
    const expandedCategorized = expandCategorizedResults(categorized, urlToOriginalTabs);
    
    // Add saved tabs to category 1 (can be closed) so they show up in the UI
    savedTabsMap.forEach((tabs, url) => {
      if (tabs.length > 0) {
        // Use the first tab as the representative, but include all duplicate IDs
        const representativeTab = { ...tabs[0] };
        delete representativeTab.originalIndex;
        
        // Add array of all tab IDs that have this URL (for closing duplicates)
        representativeTab.duplicateIds = tabs.map(tab => tab.id);
        
        // Add duplicate count to title if there are duplicates
        if (tabs.length > 1) {
          representativeTab.duplicateCount = tabs.length;
        }
        
        // Mark as already saved
        representativeTab.alreadySaved = true;
        
        expandedCategorized[1].push(representativeTab);
      }
    });
    
    console.log('Background: Deduplicated API response:', Object.keys(categorized));
    console.log('Background: Expanded categorized results:', Object.keys(expandedCategorized));
    console.log('Background: Tab counts by category after expansion:', {
      category1: expandedCategorized[1]?.length || 0,
      category2: expandedCategorized[2]?.length || 0,
      category3: expandedCategorized[3]?.length || 0
    });
    console.log(`Added ${savedTabsMap.size} saved URLs to category 1 for display`);
    
    // Save all categorized tabs to database (including category 1)
    try {
      await globalThis.tabDatabase.saveCategorizedTabs(expandedCategorized);
      console.log('Background: Saved all categorized tabs to database');
    } catch (error) {
      console.error('Background: Error saving to database:', error);
    }
    
    // Store the categorized tabs in background
    categorizedTabs = expandedCategorized;
    
    // Update urlToDuplicateIds
    urlToDuplicateIds = {};
    urlToOriginalTabs.forEach((tabs, url) => {
      if (tabs.length > 1) {
        urlToDuplicateIds[url] = tabs.map(t => t.id);
      }
    });
    
    console.log('Background: Stored categorized tabs');
    
    return { success: true, data: expandedCategorized };
  } catch (error) {
    console.error('Background: API error', error);
    return { success: false, error: error.message };
  }
}

// Deduplicate tabs by URL, keeping track of all tabs with the same URL
function deduplicateTabs(tabs, savedUrls = new Set()) {
  const urlToOriginalTabs = new Map();
  const savedTabsMap = new Map(); // Track tabs that match saved URLs
  const deduplicatedTabs = [];
  let excludedCount = 0;
  
  tabs.forEach((tab, index) => {
    const url = tab.url;
    
    // Check if URL is already saved
    if (savedUrls.has(url)) {
      excludedCount++;
      // Track saved tabs separately so we can still display them
      if (!savedTabsMap.has(url)) {
        savedTabsMap.set(url, []);
      }
      savedTabsMap.get(url).push({ ...tab, originalIndex: index });
      return; // Don't send to LLM
    }
    
    if (!urlToOriginalTabs.has(url)) {
      // First time seeing this URL, add to deduplicated list
      urlToOriginalTabs.set(url, []);
      // Create a deduplicated tab with a unique ID for tracking
      const deduplicatedTab = {
        ...tab,
        deduplicatedId: `dedup_${deduplicatedTabs.length}`
      };
      deduplicatedTabs.push(deduplicatedTab);
    }
    // Track all original tabs with this URL
    urlToOriginalTabs.get(url).push({ ...tab, originalIndex: index });
  });
  
  console.log(`Deduplication: ${excludedCount} already-saved URLs excluded from LLM`);
  console.log(`Deduplication: ${tabs.length} input tabs -> ${deduplicatedTabs.length} unique new tabs (${savedTabsMap.size} saved)`);
  console.log('Deduplication map:', Array.from(urlToOriginalTabs.entries()).slice(0, 10).map(([url, tabs]) => ({
    url: url.substring(0, 50) + '...',
    count: tabs.length,
    indices: tabs.map(t => t.originalIndex)
  })));
  if (savedTabsMap.size > 0) {
    console.log('Sample saved tabs excluded:', Array.from(savedTabsMap.entries()).slice(0, 3).map(([url, tabs]) => ({
      url: url.substring(0, 50) + '...',
      count: tabs.length
    })));
  }
  
  return { deduplicatedTabs, urlToOriginalTabs, savedTabsMap };
}

// Expand categorized results to show deduplicated tabs but track all duplicate IDs
function expandCategorizedResults(categorized, urlToOriginalTabs) {
  const expanded = { 1: [], 2: [], 3: [] };
  
  [1, 2, 3].forEach(category => {
    if (categorized[category]) {
      categorized[category].forEach(deduplicatedTab => {
        const originalTabs = urlToOriginalTabs.get(deduplicatedTab.url) || [];
        if (originalTabs.length > 0) {
          // Use the first tab as the representative, but include all duplicate IDs
          const representativeTab = { ...originalTabs[0] };
          delete representativeTab.deduplicatedId;
          delete representativeTab.originalIndex;
          
          // Add array of all tab IDs that have this URL (for closing duplicates)
          representativeTab.duplicateIds = originalTabs.map(tab => tab.id);
          
          // Add duplicate count to title if there are duplicates
          if (originalTabs.length > 1) {
            representativeTab.duplicateCount = originalTabs.length;
          }
          
          expanded[category].push(representativeTab);
        }
      });
    }
  });
  
  return expanded;
}

// Common prompt for all LLMs
function getCategorizationPrompt(tabs, customPrompt) {
  // Use custom prompt if provided and different from default
  const promptToUse = (customPrompt && customPrompt !== CONFIG.DEFAULT_PROMPT) ? customPrompt : CONFIG.DEFAULT_PROMPT;
  
  // Prepare minimal tab data for LLM - only what's needed for categorization
  const minimalTabs = tabs.map(tab => {
    // Create minimal tab object with only necessary fields
    const minimalTab = {
      id: tab.deduplicatedId || tab.id || tab.tempId || tabs.indexOf(tab),
      title: tab.title,
      url: tab.url.length > 128 ? tab.url.substring(0, 128) + '...' : tab.url
    };
    
    return minimalTab;
  });
  
  console.log('Minimal tabs for LLM:', minimalTabs.length, 'tabs');
  console.log('Sample minimal tab:', minimalTabs[0]);
  
  // Replace placeholders in the prompt
  return promptToUse
    .replace('{FREQUENT_DOMAINS}', CONFIG.FREQUENT_DOMAINS.join(', '))
    .replace('{TABS_DATA}', JSON.stringify(minimalTabs, null, 2));
}

async function callClaudeAPI(tabs, apiKey, model, customPrompt) {
  console.log('callClaudeAPI started with model:', model);
  
  // Safety check - don't call API if no tabs
  if (!tabs || tabs.length === 0) {
    console.log('No tabs to categorize, skipping Claude API call');
    return { 1: [], 2: [], 3: [] };
  }
  
  try {
    const prompt = getCategorizationPrompt(tabs, customPrompt);
    console.log('Calling Claude API with', tabs.length, 'tabs');
    
    // Log the exact prompt being sent
    console.log('=== CLAUDE API REQUEST ===');
    console.log('Model:', model);
    console.log('Number of tabs:', tabs.length);
    console.log('Prompt length:', prompt.length);
    console.log('Full prompt:', prompt);
    console.log('=== END CLAUDE API REQUEST ===');

  const requestHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'
  };

  const requestBody = {
    model: model,
    max_tokens: 4096,
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: prompt
    }]
  };

  console.log('Request URL:', CONFIG.PROVIDERS.Claude.apiUrl);
  console.log('Request headers:', requestHeaders);
  console.log('API Key length:', apiKey.length);
  console.log('API Key starts with:', apiKey.substring(0, 10) + '...');
  
  // Log the complete request body
  console.log('=== CLAUDE API REQUEST BODY ===');
  console.log('Request body:', JSON.stringify(requestBody, null, 2));
  console.log('=== END CLAUDE API REQUEST BODY ===');

  let response;
  try {
    console.log('Sending fetch request...');
    response = await fetch(CONFIG.PROVIDERS.Claude.apiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody)
    });
    console.log('Fetch completed, status:', response.status);
  } catch (fetchError) {
    console.error('Fetch failed:', fetchError);
    throw new Error(`Network error: ${fetchError.message}`);
  }

  if (!response.ok) {
    let errorText;
    try {
      errorText = await response.text();
    } catch (e) {
      errorText = 'Unable to read error response';
    }
    console.error('Claude API error response:', response.status, errorText);
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  console.log('=== CLAUDE API RESPONSE ===');
  console.log('Response status:', response.status);
  console.log('Response headers:', response.headers);
  console.log('Raw response data structure:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
  
  if (!data.content || !data.content[0] || !data.content[0].text) {
    throw new Error('Invalid response format from Claude');
  }
  
  const content = data.content[0].text;
  console.log('Content length:', content.length);
  console.log('Full content:', content);
  console.log('=== END CLAUDE API RESPONSE ===');

  // Extract JSON from response
  let categorization;
  try {
    // Clean the content first - remove any potential whitespace or newlines
    const cleanedContent = content.trim();
    
    // Try to parse the entire response as JSON first
    categorization = JSON.parse(cleanedContent);
  } catch (e) {
    console.log('Direct JSON parse failed, trying extraction methods...');
    
    // Method 1: Try to find JSON object boundaries
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonString = content.substring(firstBrace, lastBrace + 1).trim();
      
      try {
        categorization = JSON.parse(jsonString);
        console.log('Successfully parsed JSON using brace extraction');
      } catch (parseError) {
        console.error('Failed to parse extracted JSON:', parseError.message);
        
        // Method 2: Try line-by-line parsing for potential formatting issues
        try {
          // Remove any markdown code blocks if present
          const cleanJson = jsonString
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          
          categorization = JSON.parse(cleanJson);
          console.log('Successfully parsed JSON after cleaning markdown');
        } catch (cleanError) {
          console.error('All parsing methods failed');
          console.error('First 500 chars of extracted string:', jsonString.substring(0, 500));
          console.error('Last 100 chars of extracted string:', jsonString.substring(jsonString.length - 100));
          throw new Error('Invalid JSON in Claude response');
        }
      }
    } else {
      throw new Error('No JSON object found in Claude response');
    }
  }

  // Validate the categorization object
  if (!categorization || typeof categorization !== 'object') {
    throw new Error('Invalid categorization result');
  }
  
  console.log('Successfully parsed categorization for', Object.keys(categorization).length, 'items');
  
  return organizeTabs(tabs, categorization);
  
  } catch (error) {
    console.error('Error in callClaudeAPI:', error);
    throw error;
  }
}

// OpenAI API implementation
async function callOpenAIAPI(tabs, apiKey, model, customPrompt) {
  console.log('callOpenAIAPI started with model:', model);
  
  // Safety check - don't call API if no tabs
  if (!tabs || tabs.length === 0) {
    console.log('No tabs to categorize, skipping OpenAI API call');
    return { 1: [], 2: [], 3: [] };
  }
  
  try {
    const prompt = getCategorizationPrompt(tabs, customPrompt);
    
    // Log the exact prompt being sent
    console.log('=== OPENAI API REQUEST ===');
    console.log('Model:', model);
    console.log('Number of tabs:', tabs.length);
    console.log('Prompt length:', prompt.length);
    console.log('Full prompt:', prompt);
    console.log('=== END OPENAI API REQUEST ===');
    
    const requestBody = {
      model: model,
      messages: [{
        role: 'system',
        content: 'You are a helpful assistant that categorizes browser tabs.'
      }, {
        role: 'user',
        content: prompt
      }],
      temperature: 0.3,
      max_tokens: 4096
    };
    
    // Log the complete request body
    console.log('=== OPENAI API REQUEST BODY ===');
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    console.log('=== END OPENAI API REQUEST BODY ===');
    
    const response = await fetch(CONFIG.PROVIDERS.OpenAI.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Log the complete response
    console.log('=== OPENAI API RESPONSE ===');
    console.log('Response status:', response.status);
    console.log('Response data structure:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid response format from OpenAI');
    }
    
    const content = data.choices[0].message.content;
    console.log('Content length:', content.length);
    console.log('Full content:', content);
    console.log('=== END OPENAI API RESPONSE ===');
    
    const categorization = JSON.parse(content);
    
    return organizeTabs(tabs, categorization);
  } catch (error) {
    console.error('Error in callOpenAIAPI:', error);
    throw error;
  }
}

// Helper function to organize tabs
function organizeTabs(tabs, categorization) {
  console.log('organizeTabs called with', tabs.length, 'tabs');
  console.log('Sample tab:', tabs[0]);
  console.log('Categorization type:', typeof categorization);
  console.log('Categorization keys:', Object.keys(categorization || {}).slice(0, 10));
  
  const organized = { 1: [], 2: [], 3: [] };
  
  tabs.forEach((tab, index) => {
    // Check for categorization by tab ID (for regular tabs) or by index (for imported tabs)
    let category;
    
    try {
      if (tab && tab.deduplicatedId) {
        // For deduplicated tabs, use the deduplicatedId
        category = categorization[tab.deduplicatedId] || categorization[index.toString()] || 1;
      } else if (tab && tab.id !== undefined && tab.id !== null) {
        const idKey = tab.id.toString();
        category = categorization[idKey] || 1;
      } else if (tab && tab.tempId) {
        // For imported tabs with temporary IDs, check both tempId and index
        category = categorization[tab.tempId] || categorization[index.toString()] || 1;
      } else {
        // For imported tabs without IDs, use the index
        const indexKey = index.toString();
        category = categorization[indexKey] || 1;
      }
      
      // Ensure category is valid
      if (![1, 2, 3].includes(category)) {
        console.warn(`Invalid category ${category} for tab at index ${index}, defaulting to 1`);
        category = 1;
      }
      
      organized[category].push(tab);
    } catch (err) {
      console.error(`Error processing tab at index ${index}:`, err);
      console.error('Tab data:', tab);
      // Default to category 1 on error
      organized[1].push(tab);
    }
  });
  
  // Sort tabs within each category by domain
  Object.keys(organized).forEach(cat => {
    try {
      organized[cat].sort((a, b) => {
        const domainA = (a && a.domain) || '';
        const domainB = (b && b.domain) || '';
        return domainA.localeCompare(domainB);
      });
    } catch (err) {
      console.error(`Error sorting category ${cat}:`, err);
    }
  });
  
  return organized;
}

// Placeholder functions for other providers
async function callGeminiAPI(tabs, apiKey, model, customPrompt) {
  throw new Error('Gemini API not implemented yet');
}

async function callDeepSeekAPI(tabs, apiKey, model, customPrompt) {
  throw new Error('DeepSeek API not implemented yet');
}

async function callGrokAPI(tabs, apiKey, model, customPrompt) {
  throw new Error('Grok API not implemented yet');
}

// Handle fetching models for a provider
async function handleFetchModels({ provider, apiKey }) {
  console.log('Fetching models for', provider);
  
  const providerConfig = CONFIG.PROVIDERS[provider];
  
  // If no models URL, return empty array
  if (!providerConfig.modelsUrl) {
    console.log('No models URL for', provider);
    return { success: true, models: [] };
  }
  
  // If no API key, return empty array (user needs to add API key first)
  if (!apiKey) {
    console.log('No API key for', provider, 'cannot fetch models');
    return { success: true, models: [], needsApiKey: true };
  }
  
  try {
    let models = [];
    
    switch (provider) {
      case 'Claude':
        models = await fetchClaudeModels(apiKey);
        break;
      case 'OpenAI':
        models = await fetchOpenAIModels(apiKey);
        break;
      case 'Gemini':
        models = await fetchGeminiModels(apiKey);
        break;
      case 'DeepSeek':
        models = await fetchDeepSeekModels(apiKey);
        break;
      case 'Grok':
        models = await fetchGrokModels(apiKey);
        break;
      default:
        models = providerConfig.models;
    }
    
    return { success: true, models };
  } catch (error) {
    console.error('Error fetching models:', error);
    // Return empty array on error
    return { success: true, models: [], error: error.message };
  }
}

// Fetch Claude models
async function fetchClaudeModels(apiKey) {
  console.log('Fetching Claude models');
  
  try {
    const response = await fetch(CONFIG.PROVIDERS.Claude.modelsUrl, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process Claude models
    const models = data.data
      .map(model => ({
        id: model.id,
        name: model.display_name || model.id,
        created_at: model.created_at
      }))
      // Sort by creation date (newest first)
      .sort((a, b) => {
        if (a.created_at && b.created_at) {
          return new Date(b.created_at) - new Date(a.created_at);
        }
        // Fallback to alphabetical if no creation date
        return a.id.localeCompare(b.id);
      });
    
    console.log('Found Claude models:', models);
    return models;
  } catch (error) {
    console.error('Error fetching Claude models:', error);
    throw error; // Let the parent handler deal with it
  }
}

// Fetch OpenAI models
async function fetchOpenAIModels(apiKey) {
  console.log('Fetching OpenAI models');
  
  try {
    const response = await fetch(CONFIG.PROVIDERS.OpenAI.modelsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Filter for chat models (or any model that supports chat completions)
    const chatModels = data.data
      .filter(model => {
        // Include models that support chat completions
        return model.id.includes('gpt') || 
               model.id.includes('chatgpt') || 
               model.id.includes('o1') ||
               (model.capabilities && model.capabilities.includes('chat'));
      })
      .map(model => ({
        id: model.id,
        name: model.name || model.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        created: model.created
      }))
      // Sort by creation time (newest first)
      .sort((a, b) => {
        if (a.created && b.created) {
          return b.created - a.created;
        }
        return b.id.localeCompare(a.id);
      });
    
    console.log('Found OpenAI models:', chatModels);
    return chatModels;
  } catch (error) {
    console.error('Error fetching OpenAI models:', error);
    throw error;
  }
}

// Fetch Gemini models
async function fetchGeminiModels(apiKey) {
  console.log('Fetching Gemini models');
  
  try {
    const response = await fetch(`${CONFIG.PROVIDERS.Gemini.modelsUrl}?key=${apiKey}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    
    const data = await response.json();
    
    const models = data.models
      .filter(model => model.supportedGenerationMethods.includes('generateContent'))
      .map(model => ({
        id: model.name.split('/').pop(),
        name: model.displayName || model.name.split('/').pop()
      }));
    
    console.log('Found Gemini models:', models);
    return models;
  } catch (error) {
    console.error('Error fetching Gemini models:', error);
    throw error;
  }
}

// Placeholder functions for other providers
async function fetchDeepSeekModels(apiKey) {
  // DeepSeek uses OpenAI-compatible API
  try {
    const response = await fetch(CONFIG.PROVIDERS.DeepSeek.modelsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    
    const data = await response.json();
    const models = data.data.map(model => ({
      id: model.id,
      name: model.id
    }));
    
    return models;
  } catch (error) {
    console.error('Error fetching DeepSeek models:', error);
    throw error;
  }
}

async function fetchGrokModels(apiKey) {
  // Similar to OpenAI format
  try {
    const response = await fetch(CONFIG.PROVIDERS.Grok.modelsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    
    const data = await response.json();
    const models = data.data.map(model => ({
      id: model.id,
      name: model.id
    }));
    
    return models;
  } catch (error) {
    console.error('Error fetching Grok models:', error);
    throw error;
  }
}