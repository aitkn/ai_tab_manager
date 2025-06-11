# Manual Test Checklist for AI Tab Manager

Run through this checklist after each refactoring step to ensure nothing is broken.

## Core Functionality Tests

### 1. Extension Loading
- [ ] Extension icon appears in toolbar
- [ ] Popup opens when clicked
- [ ] No console errors on load
- [ ] All tabs (Current, Saved, Settings) are visible

### 2. Tab Categorization
- [ ] "Refresh & Categorize" button works
- [ ] Shows loading status
- [ ] Categorizes tabs into 3 categories correctly
- [ ] Shows tab counts in category headers
- [ ] Already-saved tabs show green titles
- [ ] Duplicate tabs show count (e.g., "(2)")

### 3. Saving Tabs
- [ ] "Save and Close All" button appears after categorization
- [ ] Only saves Important (cat 3) and Save for Later (cat 2) tabs
- [ ] Closes all categorized tabs after saving
- [ ] Shows success message

### 4. Saved Tabs View
- [ ] Switching to "Saved" tab works
- [ ] Shows all saved tabs
- [ ] Group by options work (Category, Domain, Date)
- [ ] Can open individual saved tabs
- [ ] Can delete saved tabs
- [ ] Search in saved tabs works

### 5. Current Tab Features
- [ ] Search works in current tabs
- [ ] Group by Category/Domain toggle works
- [ ] Collapse/Expand all groups works
- [ ] Can move tabs between categories
- [ ] Can close individual tabs

### 6. Settings
- [ ] Theme switcher works (System/Light/Dark)
- [ ] Can select LLM provider
- [ ] Can save API key
- [ ] Model dropdown populates
- [ ] Custom prompt can be saved
- [ ] Max tabs setting persists

### 7. Import/Export
- [ ] Export CSV creates proper file
- [ ] Import CSV file picker opens
- [ ] Imported tabs appear in saved tabs
- [ ] Duplicate detection during import works

### 8. State Persistence
- [ ] Categorized tabs persist when closing/reopening popup
- [ ] Settings persist across sessions
- [ ] Saved tabs remain after browser restart
- [ ] Selected grouping option persists

## Quick Smoke Test (2 minutes)
1. Open popup
2. Click "Refresh & Categorize"
3. Click "Save and Close All"
4. Go to Saved tab
5. Search for a saved tab
6. Open Settings and change theme
7. Close and reopen popup - verify state persists

## Version Check
Current refactoring version: `refactoring-v1`
Check console: `window.DEBUG.version`