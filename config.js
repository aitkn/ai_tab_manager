// Configuration for the extension
const CONFIG = {
  // LLM Provider configurations
  PROVIDERS: {
    Claude: {
      name: 'Claude',
      apiUrl: 'https://api.anthropic.com/v1/messages',
      modelsUrl: 'https://api.anthropic.com/v1/models',
      apiKeyPlaceholder: 'sk-ant-api03-...',
      headers: {
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      models: [] // Will be fetched dynamically
    },
    OpenAI: {
      name: 'OpenAI',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      modelsUrl: 'https://api.openai.com/v1/models',
      apiKeyPlaceholder: 'sk-...',
      headers: {},
      models: [] // Will be fetched dynamically
    },
    Gemini: {
      name: 'Gemini',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
      modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
      apiKeyPlaceholder: 'AIza...',
      headers: {},
      models: [] // Will be fetched dynamically
    },
    DeepSeek: {
      name: 'DeepSeek',
      apiUrl: 'https://api.deepseek.com/v1/chat/completions',
      modelsUrl: 'https://api.deepseek.com/v1/models',
      apiKeyPlaceholder: 'sk-...',
      headers: {},
      models: [] // Will be fetched dynamically
    },
    Grok: {
      name: 'Grok',
      apiUrl: 'https://api.x.ai/v1/chat/completions',
      modelsUrl: 'https://api.x.ai/v1/models',
      apiKeyPlaceholder: 'xai-...',
      headers: {},
      models: [] // Will be fetched dynamically
    }
  },
  
  // Default settings
  DEFAULT_PROVIDER: 'Claude',
  DEFAULT_MODEL: '', // Will be set dynamically
  
  // Default domains to consider as "frequently opened"
  FREQUENT_DOMAINS: [
    'mail.google.com',
    'gmail.com',
    'x.com',
    'twitter.com',
    'youtube.com',
    'google.com',
    'facebook.com',
    'instagram.com',
    'linkedin.com',
    'reddit.com',
    'github.com'
  ],
  
  // Default categorization prompt
  DEFAULT_PROMPT: `You are a tab categorization assistant. Categorize the following browser tabs into exactly 3 categories:

1. Not Important (can be closed): Empty tabs, new tabs, error pages (404, 500, etc.), frequently opened sites (Gmail, X/Twitter homepage, YouTube homepage, etc.), default pages, inbox pages
2. Somewhat Important (save for later): Interesting articles/videos that aren't too old, useful posts that might be referenced later, general browsing
3. Important (must save): Unique websites hard to find again, important articles/documentation, active LLM conversations that may need continuation, work-related tabs, specific tweets/posts, GitHub repos with code

Consider these domains as category 1 when they're just the homepage/inbox: {FREQUENT_DOMAINS}

Rules:
- LLM chat conversations (claude.ai/chat/*, chatgpt.com/*, grok.com/chat/*) are ALWAYS category 3
- GitHub repos (not just github.com) are category 3
- Specific tweets/posts are category 2 or 3, but twitter/x.com homepage is category 1
- Documentation sites are category 3
- Google searches are category 1
- YouTube videos (not homepage) are category 2

For each tab, assign a category (1, 2, or 3) based on the title and URL.

Tabs data:
{TABS_DATA}

Respond with ONLY a JSON object where keys are tab IDs and values are category numbers (1, 2, or 3).
Example: {"123": 1, "456": 3, "789": 2}

Do not include any explanation or other text, just the JSON object.`
};