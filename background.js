/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Proprietary License - See LICENSE file
 * support@aitkn.com
 */

// Background service worker for handling API calls

console.log('Background service worker starting...');

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
  
  // Default response for unknown actions
  sendResponse({ error: 'Unknown action: ' + request.action });
  return false;
});

async function handleCategorizeTabs({ tabs, apiKey, provider, model, customPrompt }) {
  console.log('Background: Categorizing tabs with', provider, model, tabs.length, 'tabs');
  console.log('Using custom prompt:', !!customPrompt);
  
  try {
    let categorized;
    
    switch (provider) {
      case 'Claude':
        categorized = await callClaudeAPI(tabs, apiKey, model, customPrompt);
        break;
      case 'OpenAI':
        categorized = await callOpenAIAPI(tabs, apiKey, model, customPrompt);
        break;
      case 'Gemini':
        categorized = await callGeminiAPI(tabs, apiKey, model, customPrompt);
        break;
      case 'DeepSeek':
        categorized = await callDeepSeekAPI(tabs, apiKey, model, customPrompt);
        break;
      case 'Grok':
        categorized = await callGrokAPI(tabs, apiKey, model, customPrompt);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
    
    console.log('Background: API response received, categories:', Object.keys(categorized));
    console.log('Background: Tab counts by category:', {
      category1: categorized[1]?.length || 0,
      category2: categorized[2]?.length || 0,
      category3: categorized[3]?.length || 0
    });
    return { success: true, data: categorized };
  } catch (error) {
    console.error('Background: API error', error);
    return { success: false, error: error.message };
  }
}

// Common prompt for all LLMs
function getCategorizationPrompt(tabs, customPrompt) {
  // Use custom prompt if provided and different from default
  const promptToUse = (customPrompt && customPrompt !== CONFIG.DEFAULT_PROMPT) ? customPrompt : CONFIG.DEFAULT_PROMPT;
  
  // Replace placeholders in the prompt
  return promptToUse
    .replace('{FREQUENT_DOMAINS}', CONFIG.FREQUENT_DOMAINS.join(', '))
    .replace('{TABS_DATA}', JSON.stringify(tabs, null, 2));
}

async function callClaudeAPI(tabs, apiKey, model, customPrompt) {
  console.log('callClaudeAPI started with model:', model);
  
  try {
    const prompt = getCategorizationPrompt(tabs, customPrompt);
    console.log('Calling Claude API with', tabs.length, 'tabs');

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
  console.log('Claude API raw response:', data);
  
  if (!data.content || !data.content[0] || !data.content[0].text) {
    throw new Error('Invalid response format from Claude');
  }
  
  const content = data.content[0].text;
  console.log('Claude response text length:', content.length);
  
  // Don't log the full content to avoid console truncation issues
  if (content.length > 1000) {
    console.log('Claude response preview:', content.substring(0, 100) + '...[truncated]...' + content.substring(content.length - 100));
  } else {
    console.log('Claude response text:', content);
  }

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
  
  try {
    const prompt = getCategorizationPrompt(tabs, customPrompt);
    
    const response = await fetch(CONFIG.PROVIDERS.OpenAI.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
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
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    const categorization = JSON.parse(content);
    
    return organizeTabs(tabs, categorization);
  } catch (error) {
    console.error('Error in callOpenAIAPI:', error);
    throw error;
  }
}

// Helper function to organize tabs
function organizeTabs(tabs, categorization) {
  const organized = { 1: [], 2: [], 3: [] };
  
  tabs.forEach((tab, index) => {
    // Check for categorization by tab ID (for regular tabs) or by index (for imported tabs)
    let category;
    if (tab.id !== undefined) {
      category = categorization[tab.id.toString()] || 1;
    } else {
      // For imported tabs without IDs, use the index
      category = categorization[index.toString()] || 1;
    }
    
    organized[category].push(tab);
  });
  
  // Sort tabs within each category by domain
  Object.keys(organized).forEach(cat => {
    organized[cat].sort((a, b) => {
      const domainA = a.domain || '';
      const domainB = b.domain || '';
      return domainA.localeCompare(domainB);
    });
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