# AI Tab Manager - Smart Chrome Extension for Tab Organization

An intelligent Chrome extension that uses AI (Claude, OpenAI, Gemini, DeepSeek, or Grok) to automatically categorize and manage your browser tabs. Save time by letting AI decide which tabs to keep, save for later, or close.

## Features

### 🤖 AI-Powered Categorization
- Automatically categorizes tabs into three groups:
  - **Can Be Closed**: Error pages, empty tabs, frequently visited homepages
  - **Save for Later**: Interesting articles, videos, and general browsing
  - **Important**: Documentation, active AI conversations, work-related tabs, GitHub repos

### 🎨 Modern UI with Theme Support
- **Automatic Dark/Light Mode**: Follows system preferences
- **Manual Theme Toggle**: Choose between System, Light, or Dark themes
- **Space-Efficient Design**: Optimized for managing hundreds of tabs
- **Professional Material Design Icons**: Clean, modern interface

### 💾 Smart Save System
- **Duplicate Detection**: Prevents saving the same URL multiple times
- **Priority Management**: Automatically updates tab priority if saved again
- **Category-Specific Actions**:
  - "Close All" for unimportant tabs
  - "Save & Close" for important categories
  - "Save & Close All" for bulk operations

### 🔍 Advanced Features
- **Click to Activate**: Click any tab in the list to switch to it
- **Search Functionality**: Quickly find tabs by title or URL
- **Multiple Grouping Options**: 
  - By Category
  - By Domain
  - By Save Date/Week/Month
- **Error Page Detection**: Automatically identifies 404, 500, and other error pages

## Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/aitkn/ai_tab_manager.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the extension directory

5. The AI Tab Manager icon will appear in your Chrome toolbar

## Setup

1. Click the extension icon in your Chrome toolbar
2. Click the settings button (⚙️)
3. Configure your preferred AI provider:
   - **Claude** (Anthropic)
   - **OpenAI** (ChatGPT)
   - **Gemini** (Google)
   - **DeepSeek**
   - **Grok** (X.AI)
4. Enter your API key for the selected provider
5. Choose your preferred model (models are fetched automatically)
6. Optionally customize the categorization prompt

## Usage

### Categorizing Tabs
1. Click the extension icon
2. Click "Categorize Tabs" to analyze all open tabs
3. Review the AI's categorization
4. Use section-specific actions:
   - **Close All**: Remove all tabs in "Can Be Closed"
   - **Save & Close**: Save and close tabs in a specific category
   - **Save & Close All**: Save important tabs and close everything

### Managing Saved Tabs
1. Click the bookmark icon (📑) to view saved tabs
2. Use grouping options to organize your view
3. Click "Open All" to restore a group of tabs
4. Search for specific tabs using the search bar

### Keyboard Shortcuts
- Click on any tab title to activate it in the browser
- Use the up/down arrows to move tabs between categories

## API Key Setup

### Claude (Anthropic)
1. Get your API key from [Anthropic Console](https://console.anthropic.com/)
2. API key format: `sk-ant-api03-...`

### OpenAI
1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. API key format: `sk-...`

### Gemini (Google)
1. Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. API key format: `AIza...`

### DeepSeek
1. Get your API key from [DeepSeek Platform](https://platform.deepseek.com/)
2. API key format: `sk-...`

### Grok (X.AI)
1. Get your API key from [X.AI Console](https://console.x.ai/)
2. API key format: `xai-...`

## Customization

### Custom Categorization Prompt
You can customize how the AI categorizes your tabs by modifying the prompt in settings. The default prompt considers:
- Error pages → Can Be Closed
- AI chat conversations → Important
- Documentation → Important
- News articles → Save for Later
- Social media homepages → Can Be Closed

### Theme Customization
The extension supports three theme modes:
- **System**: Automatically matches your OS theme
- **Light**: Force light theme
- **Dark**: Force dark theme

## Privacy & Security

- **Local Storage Only**: All data is stored locally in your browser
- **No Tracking**: The extension doesn't collect any usage data
- **API Keys**: Stored securely in Chrome's local storage
- **Direct API Calls**: Communicates directly with your chosen AI provider

## Development

### Updating the Default Prompt

When you need to update the default categorization prompt:

1. Update the prompt in `config.js`:
   ```javascript
   DEFAULT_PROMPT: `Your new prompt here...`
   ```

2. **Important**: Increment the `PROMPT_VERSION`:
   ```javascript
   PROMPT_VERSION: 2, // Increment this number
   ```

3. Users will automatically get the new default prompt when they update the extension, unless they have customized their prompt.

### How Prompt Updates Work

- If a user has **not** customized their prompt: They automatically get the new default
- If a user **has** customized their prompt: They keep their custom version
- Users can always click "Reset to Default" to get the latest default prompt

### Technologies Used
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Storage**: IndexedDB for saved tabs, Chrome Storage API for settings
- **AI Integration**: Support for multiple LLM providers
- **Icons**: Material Design SVG icons

### Project Structure
```
├── manifest.json          # Chrome extension manifest
├── popup.html            # Main extension popup
├── popup.js              # Main logic and UI handling
├── popup.css             # Styles with theme support
├── background.js         # Background service worker
├── config.js             # Configuration and prompts
├── database_v2.js        # IndexedDB implementation
└── README.md            # This file
```

### Building from Source
No build process required! The extension runs directly from source files.

### Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues

**"Failed to save tab" error**
- Clear extension data and reload
- Check browser console for specific errors

**Tabs not categorizing correctly**
- Ensure your API key is valid
- Check that you have sufficient API credits
- Try the default prompt if using custom prompt

**Theme not changing**
- Refresh the extension popup
- Check system theme settings

## License

This software is proprietary and protected by copyright law. See [LICENSE](LICENSE) for details.

**Key Points:**
- ✅ Free for personal, non-commercial use
- ❌ Commercial use requires a license
- ❌ Redistribution of modified versions prohibited
- 📧 For commercial licensing: support@aitkn.com

## Support Development

If you find this extension useful, please consider supporting its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/aitkn)

Your support helps maintain and improve this extension!

## Acknowledgments

- Anthropic Claude for AI categorization
- Material Design for icon inspiration
- Chrome Extension API documentation

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/aitkn/ai_tab_manager/issues) page.

---

Made with ❤️ by [AI Tech Knowledge LLC](https://aitkn.com)

© 2024 AI Tech Knowledge LLC. All rights reserved.