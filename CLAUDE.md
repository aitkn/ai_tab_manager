# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Tab Manager is a Chrome extension that uses LLM APIs (Claude, OpenAI, Gemini, DeepSeek, Grok) to categorize and manage browser tabs. The extension is built with vanilla JavaScript and uses a modular architecture after recent refactoring.

## Commands

### Build for Chrome Web Store
```bash
./build_for_store.sh
```
This creates a production build in `build/` directory and generates a zip file for store submission.

### Development
No build process required - Chrome loads the extension directly from source files.
1. Go to `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked" and select the project directory

## Architecture

### Modular Structure (Post-Refactoring)
The codebase was recently refactored from a monolithic `popup.js` (3,400+ lines) to a modular structure:

```
src/
├── modules/
│   ├── state-manager.js      # Centralized state management with subscription pattern
│   ├── ui-manager.js         # Theme, navigation, status messages
│   ├── categorization-service.js  # LLM integration for tab categorization
│   ├── event-handlers.js     # All UI event handlers
│   ├── tab-display.js        # Tab rendering in various views (700+ lines)
│   ├── tab-operations.js     # CRUD operations for tabs
│   ├── saved-tabs-manager.js # Saved tabs functionality
│   ├── search-filter.js      # Search functionality
│   ├── import-export.js      # CSV import/export
│   ├── settings-manager.js   # Settings UI and persistence
│   ├── ui-utilities.js       # UI helper functions
│   └── app-initializer.js    # App bootstrap and initialization
├── services/
│   ├── ChromeAPIService.js   # Promise-based Chrome API wrappers
│   ├── StorageService.js     # Chrome storage abstraction
│   └── MessageService.js     # Background script communication
└── utils/
    ├── constants.js          # All constants (DOM IDs, CSS classes, etc.)
    ├── helpers.js            # Pure utility functions
    └── dom-helpers.js        # Lightweight jQuery-like DOM utilities
```

### Key Architectural Decisions

1. **State Management**: Centralized in `state-manager.js` with subscription pattern for reactive updates
2. **Background Script**: Handles all LLM API calls and tab event monitoring
3. **Database**: IndexedDB (`database_v2.js`) stores saved tabs individually with indexes for searching
4. **Module Loading**: ES6 modules with dynamic imports to reduce initial load
5. **No Framework**: Vanilla JS with custom DOM helpers instead of jQuery/React

### Critical State Flow

1. **Tab Categorization**:
   - User clicks "Categorize" → `categorization-service.js` → Background script → LLM API
   - Response updates `state.categorizedTabs` → UI re-renders automatically
   - Duplicate URLs are handled by storing `urlToDuplicateIds` mapping

2. **Tab Display**:
   - **CRITICAL**: ALL tabs from ALL windows must be fetched and displayed (NOT just current window)
   - The extension must ALWAYS use `chrome.tabs.query({})` without any window filtering
   - Current tabs are fetched via `getCurrentTabs()` which uses `CurrentTabsProcessor`
   - Tabs can be grouped by: category, domain, save date/week/month
   - State persistence across popup open/close via `savePopupState()`

3. **Real-time Updates**:
   - Background script monitors tab create/remove/update events
   - Sends updates to popup when open via `chrome.runtime.sendMessage`
   - Popup updates display without re-categorization

## Important Implementation Details

### LLM Integration & Categorization Philosophy
- API calls go through background script to avoid CORS issues
- Tabs are deduplicated before sending to LLM to reduce tokens
- Already-saved URLs are excluded from LLM calls but shown in UI
- Custom prompts stored in `state.settings.customPrompt`
- **API Key Help**: Settings page includes direct links to API key pages for each LLM provider
- **Refindability-based categorization** (v3): Categories based on how long it takes to find a tab again:
  - Category 1 (Easy to Refind/Can Close): < 10 seconds - common sites, homepages
  - Category 2 (Moderate Effort/Save for Later): 10s-2min - searchable content, articles
  - Category 3 (Hard to Refind/Important): > 2min - unique IDs, sessions, deep links

### Database Operations
- No individual `saveTab` method - use `saveTabs({ [category]: [tab] })`
- **URL-only Storage**: Database stores only one entry per URL (simplified from URL+title)
- Handles dynamic title changes (e.g., Gmail unread counts, YouTube progress)
- Duplicate URLs prevented at database level
- Category priority: Important (3) > Save Later (2) > Can Close (1)

### UI State Preservation
- Scroll positions saved per tab view
- Grouping selections persist
- Search queries maintained
- Window close triggers state save via `beforeunload`
- **Flicker-free Initialization**: Synchronous pre-initialization loads saved state before DOM ready
- Prevents visual artifacts when popup opens by determining correct initial tab early

### Tab Operations
- Close operations handle duplicate tabs via `duplicateIds` array
- Tab click switches to correct window first, then activates tab
- Save operations update both database and remove from current view
- **Warning Dialogs**: Shows warning when closing tabs with uncategorized items (both individual and "Close All")
- Prevents accidental loss of potentially important uncategorized tabs
- **Rule-based categorization**: Applied before LLM categorization
- Users can opt-out of LLM and use only rule-based categorization
- Default rules (40) aligned with refindability philosophy in `state-manager.js`
- **Rule evaluation**: Simple and predictable
  - Each rule has URL and/or Title patterns (both optional)
  - Checkbox determines if pattern is regex or substring match
  - First matching rule determines the category
  - Unmatched tabs go to AI (if enabled) or Useful category
  - Homepage-only rules use regex: `^https?://(www\.)?youtube\.com/?$`
  - Content rules use substring: `youtube.com/watch`
  - 50+ default rules cover common patterns

### DOM Updates and Transitions
- **Morphdom Integration**: Uses morphdom library (12KB minified) for smooth DOM updates without flicker
- All tab list updates in `tab-display.js` use morphdom for efficient DOM diffing
- Morphdom configuration preserves node identity via `data-tab-id` attributes
- Real-time updates (including duplicate counts) are handled smoothly without visual disruption

## Common Issues and Solutions

1. **"Maximum call stack size exceeded"**: Check for recursive function calls (e.g., `extractDateFromGroupName`)
2. **Empty settings fields**: Ensure `CONFIG` is loaded before state initialization
3. **Tabs not updating**: Verify background script connection and message passing
4. **"0 tabs closed"**: Check that `duplicateIds` or `urlToDuplicateIds` is properly populated
5. **Database version mismatch**: Ensure `database.js` version matches existing database (currently version 2)
6. **UI flickering during updates**: Solved by using morphdom instead of manual DOM manipulation
7. **Duplicate counter not updating in real-time**: Issue was in `content-manager.js` - `generateTabHash()` function didn't include `duplicateCount` in change detection, so UI wasn't refreshing when counters changed. Fixed by adding `:${tab.duplicateCount || 1}` to hash calculation in `content-manager.js:284`

8. **Popup not updating when last tab is closed**: Issue was in `app-initializer.js` - `processTabChange()` function skipped updates when no categorized tabs existed, even when on Current tab view. Users expect to see empty state updates. Fixed by modifying condition in `app-initializer.js:497` to only skip updates when NOT on Current tab view: `if (!hasCategorizedTabs && changeType !== 'created' && state.popupState.activeTab !== 'categorize')`

9. **Extension auto-switches to Saved tab when last tab is closed**: Issue was in `app-initializer.js:533-550` - logic automatically switched from Current to Saved tab when all tabs were closed. Users should stay on Current tab and see empty state. Fixed by removing the auto-switch logic and allowing normal empty state display to proceed.

10. **Domain grouping shows "unknown" headers**: Issue was in `src/utils/helpers.js` - `extractDomain()` function returned 'unknown' for special URL schemes (about:, chrome://, file://, etc.) because URL constructor threw exceptions. Fixed by adding special case handling before URL parsing: `about:` → `about`, `chrome://` → `chrome`, `file://` → `local-file`, `chrome-extension://` → `extension`. Used TDD approach to detect and verify fix.

### Critical Event Listener Issues (Debugging Pattern)

**Symptoms**: Event handlers not working or behaving inconsistently
- Click events fire but attributes don't change properly
- Attributes toggle twice rapidly (e.g., `true → false → true` on single click)
- Visual state doesn't match data state despite correct attribute changes

**Root Cause**: Multiple Event Listeners
When initialization functions (like `initializeRulesUI()`) are called multiple times without cleanup, each call adds NEW event listeners to the same elements. A single click then triggers ALL listeners in sequence, causing unexpected behavior.

**Debugging Process**:
1. **Check for proper state transitions**: Log before/after states to verify single vs multiple toggles
2. **Add call stack traces**: Use `console.trace()` in initialization functions to track multiple calls
3. **Verify computed styles match expected**: Use `window.getComputedStyle()` to confirm CSS is updating

**Solution Pattern**:
```javascript
// WRONG: Adds new listeners on each call
element.addEventListener('click', handler);

// CORRECT: Remove old listeners before adding new ones
const newElement = element.cloneNode(true);
element.parentNode.replaceChild(newElement, element);
newElement.addEventListener('click', handler);
```

**Prevention**:
- Always check if initialization functions might be called multiple times
- Use event delegation on parent containers when possible
- Clone and replace elements to ensure clean event listeners
- Add debugging logs to track initialization calls

**Related Files**: `src/modules/settings-manager.js` (Rules UI), any module with `initialize*()` functions

## Development Practices

- Commit and push after every code update
- Test with multiple browser windows open
- Verify all grouping modes after changes
- Check that state persists across popup close/open
- Monitor console for API errors or rate limits
- **CRITICAL**: For simple UI issues (like counters not updating), check change detection logic first before investigating complex message passing or event systems. Often the issue is in hash/comparison functions not detecting the specific change type.

## Recent Major Changes

### ML Training Architecture Fix (January 2025)
- **CRITICAL FIX**: Resolved TensorFlow.js layer disposal conflicts by implementing unified model architecture
- **True Incremental Training**: Models now properly save/load weights and continue training from previous accuracy
- **GPU Acceleration**: Full WebGL backend support with CPU fallback for optimal performance
- **Model Persistence**: Uses TensorFlow.js standard save/load format ensuring reliable model persistence across sessions
- **Performance**: 174K parameter neural network with shared embeddings, batch normalization, and dropout layers

### Rule-Based Categorization UI (January 2025)
- Redesigned rules UI with individual rule management
- Each rule has URL and Title fields with regex checkboxes
- Rules grouped by category (Ignore/Useful/Important) with proper colors/icons
- '+' button to add new rules per category, delete button per rule
- Auto-save with debouncing for better UX
- "Restore Default Rules" button to reset to 50+ default rules
- Clear indication that unmatched tabs go to AI or Useful category

### Refindability-Based Categorization (January 2025)
- Changed from importance-based to refindability-based categorization
- Three categories based on time to refind: <10s, 10s-2min, >2min
- Updated default prompt (v3) and 40 default rules to align with new philosophy
- LLM integration is now optional - users can opt-out and use only rules

### Extension Self-Exclusion Safety Feature (January 2025)
- **Problem**: When extension runs in a tab (via MCP debug or manual opening), it could accidentally close itself during "Close All" operations
- **Solution**: Extension automatically excludes its own tabs from Current Tab list using precise URL matching
- **Implementation**: Uses `chrome.runtime.id` and `chrome.runtime.getURL('popup.html')` for exact URL matching in `CurrentTabsProcessor.js:58-64`
- **Precision**: Only excludes tabs with exact URL `chrome-extension://<extension-id>/popup.html` to avoid affecting other extensions
- **Safety**: Prevents extension from closing itself while maintaining full functionality for managing all other browser tabs
- **Testing**: Verified to work with bulk operations like "Close All" - extension tabs remain protected

### Real-time Updates & Domain Grouping Fixes (June 2025)
- **Popup Empty State Fix**: Fixed `app-initializer.js` to show proper empty state when last tab is closed, instead of skipping updates on Current tab view
- **Auto-switch Removal**: Removed unwanted auto-switching from Current to Saved tab when all tabs are closed - users now stay on Current tab as expected
- **Domain Grouping Fix**: Fixed "unknown" domain headers in GROUP BY Domain mode using TDD approach
- **Git Recovery**: Successfully recovered lost `database.js` functionality (updateTabCategory method) from git reset incident using git reflog
- **Enhanced Testing**: Added GROUP BY functionality tests to Current Tab test suite with TDD detection of domain grouping issues
- **Database Restoration**: Restored complete database functionality including 50 lines of lost updateTabCategory implementation

## Critical Requirements (DO NOT FORGET)

1. **ALL TABS FROM ALL WINDOWS**: The extension MUST display tabs from ALL browser windows, not just the current window. This is achieved by using `chrome.tabs.query({})` without any window filtering. This requirement has been missed multiple times - always verify this is working correctly.

2. **Real-time Updates**: The extension must update the display in real-time when tabs are opened/closed/updated, including duplicate count changes in tab titles.

3. **Morphdom for DOM Updates**: Use morphdom for all DOM updates to prevent flickering and ensure smooth transitions. Do not use manual DOM manipulation with opacity transitions.

## MCP Chrome Extension Debug Server

**ALWAYS USE THESE TOOLS FOR DEBUGGING AND TESTING**

The chrome-extension-debug MCP server provides powerful capabilities for debugging, testing, and controlling the Chrome extension. These tools should be the PRIMARY method for testing and debugging extension functionality.

### Extension Connection and Status

```javascript
// Connect to extension (required first step)
mcp__chrome-extension-debug__connect_extension
// Parameters: extensionId = "fnklipkenfpdakdficiofcdejbiajgeh"

// List all available extensions
mcp__chrome-extension-debug__list_extensions

// Get console logs for debugging
mcp__chrome-extension-debug__get_console_logs
// Parameters: extensionId, context = "background" | "popup"
```

### Background Script Control

**Execute any JavaScript code in the extension's background script:**

```javascript
mcp__chrome-extension-debug__execute_in_background
// Parameters: extensionId, code = "JavaScript code to execute"

// Examples:
// - Tab operations: chrome.tabs.query({}, callback)
// - Create/close tabs: chrome.tabs.create() / chrome.tabs.remove()
// - Storage access: chrome.storage.local.get/set()
// - Extension functions: any background script function
```

### Chrome API Access Through Extension

**Full Chrome APIs available through the extension context:**

- **Tabs API**: Query, create, close, move, update, duplicate tabs
- **Windows API**: Manage browser windows
- **Storage API**: Read/write extension data (local, sync, session)
- **Management API**: Get extension information
- **Runtime API**: Send messages, handle events

### Extension UI Interaction

**CRITICAL: Open extension in a tab for full UI access:**

```javascript
// Open extension popup as a tab (enables UI interaction)
mcp__chrome-extension-debug__execute_in_background
// Code: chrome.tabs.create({url: 'chrome-extension://fnklipkenfpdakdficiofcdejbiajgeh/popup.html', active: true})

// Once opened in tab, full UI interaction is available:
mcp__chrome-extension-debug__execute_in_popup
mcp__chrome-extension-debug__query_selector  
mcp__chrome-extension-debug__click_element
```

### Storage and Configuration Access

```javascript
mcp__chrome-extension-debug__get_storage
// Parameters: extensionId, area = "local" | "sync" | "session"

// Access all extension settings, rules, API keys, ML data, etc.
```

### Testing Workflows

**Always use these MCP tools for:**

1. **Feature Testing**:
   - Create test tabs with specific URLs to test categorization rules
   - Trigger categorization and verify results
   - Test save/close operations
   - Verify ML training and performance

2. **Debugging Issues**:
   - Check console logs for errors
   - Inspect extension storage state
   - Verify tab operations work correctly
   - Test API integrations

3. **UI Testing**:
   - Open extension in tab
   - Click buttons and fill forms programmatically
   - Test navigation between tabs (Current/Saved/Settings)
   - Verify state persistence

4. **Advanced Testing**:
   - Modify extension settings programmatically
   - Simulate user workflows end-to-end
   - Test with multiple browser windows
   - Verify real-time updates

### Extension Information

- **Extension ID**: `fnklipkenfpdakdficiofcdejbiajgeh`
- **Popup URL**: `chrome-extension://fnklipkenfpdakdficiofcdejbiajgeh/popup.html`
- **Background Script**: Service worker with tab monitoring and API integration
- **Storage Areas**: local (main data), sync (not used), session (not used)

### Best Practices

1. **Always connect to extension first** before running other commands
2. **Open extension in tab** for UI interaction capabilities  
3. **Check console logs** after operations to verify success
4. **Use MCP tools instead of manual testing** for consistent results
5. **Test with real extension state** rather than mock data
6. **Verify ALL windows functionality** by creating tabs in different windows

### Common MCP Testing Patterns

```javascript
// Pattern 1: Test categorization with specific URLs
const testUrls = ['https://youtube.com/watch?v=test', 'https://google.com', 'https://github.com/user/repo'];
testUrls.forEach(url => chrome.tabs.create({url, active: false}));

// Pattern 2: Verify extension settings
chrome.storage.local.get(['settings'], (result) => {
  console.log('Current settings:', result.settings);
});

// Pattern 3: Test tab operations
chrome.tabs.query({}, (tabs) => {
  console.log(`Found ${tabs.length} tabs across all windows`);
  tabs.forEach((tab, i) => console.log(`${i+1}. ${tab.title} - ${tab.url}`));
});

// Pattern 4: Trigger extension features
// (Open extension in tab first, then use popup interaction commands)
```

**Remember**: These MCP tools provide the most reliable way to test and debug the extension. Use them proactively for all testing scenarios instead of manual browser interaction.