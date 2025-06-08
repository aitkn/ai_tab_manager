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
- **Rule evaluation**: Rules use OR logic - first matching rule wins
  - Each rule is evaluated independently
  - A tab only needs to match ONE rule to be categorized
  - Once a match is found, no further rules are checked
  - **Order matters**: More specific rules must come before general ones
  - Default rules are ordered: Important (most specific) → Useful → Ignore (most general)
  - **Pattern**: Specific content (youtube.com/watch?v=) before domains (youtube.com)
  - This ensures specific videos/posts are saved while homepages can be ignored

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
6. **Duplicate count not updating**: Fixed by checking title changes in `tab-display.js` real-time updates
7. **UI flickering during updates**: Solved by using morphdom instead of manual DOM manipulation

## Development Practices

- Commit and push after every code update
- Test with multiple browser windows open
- Verify all grouping modes after changes
- Check that state persists across popup close/open
- Monitor console for API errors or rate limits

## Recent Major Changes

### Rule-Based Categorization UI (January 2025)
- Redesigned rules UI from individual rule items to category-grouped textareas
- Rules grouped by category (Ignore/Useful/Important) with multiline support
- Each category shows 4 rule types: domain, url_contains, title_contains, regex
- Auto-save with debouncing for better UX
- "Restore Default Rules" button to reset to 40 default rules

### Refindability-Based Categorization (January 2025)
- Changed from importance-based to refindability-based categorization
- Three categories based on time to refind: <10s, 10s-2min, >2min
- Updated default prompt (v3) and 40 default rules to align with new philosophy
- LLM integration is now optional - users can opt-out and use only rules

## Critical Requirements (DO NOT FORGET)

1. **ALL TABS FROM ALL WINDOWS**: The extension MUST display tabs from ALL browser windows, not just the current window. This is achieved by using `chrome.tabs.query({})` without any window filtering. This requirement has been missed multiple times - always verify this is working correctly.

2. **Real-time Updates**: The extension must update the display in real-time when tabs are opened/closed/updated, including duplicate count changes in tab titles.

3. **Morphdom for DOM Updates**: Use morphdom for all DOM updates to prevent flickering and ensure smooth transitions. Do not use manual DOM manipulation with opacity transitions.