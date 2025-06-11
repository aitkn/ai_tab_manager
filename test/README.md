# Current Tab Basic Functionality Test

This directory contains automated tests for the Current Tab functionality using direct Chrome browser automation.

## Test Overview

**Test Name:** Current Tab Basic Functionality

**Test Steps:**
1. Open extension in full screen mode in empty browser
2. Go to Saved Tabs
3. Delete all saved tabs
4. Go to Current Tab (should show no URLs)
5. Open new tab in browser (https://example.com)
6. Check that Current tab shows the new URL
7. Verify URL appears in "Uncategorized" group

**Result:** Single PASSED/FAILED result with detailed report file

## Available Test Scripts

### 1. JavaScript/Node.js Test (Recommended)
- **File:** `test_current_tab_basic.js`
- **Technology:** Puppeteer (Chrome automation)
- **Advantages:** More reliable, better error handling, visual browser

### 2. Python Test
- **File:** `test_current_tab_basic.py`
- **Technology:** Chrome DevTools Protocol
- **Advantages:** Lower level control, faster execution

## Quick Start

### Option 1: Automated Runner (Easiest)
```bash
./run_test.sh
```
Choose option 1 (JavaScript) or 2 (Python) when prompted.

### Option 2: Manual JavaScript Test
```bash
# Install dependencies
npm install puppeteer

# Run test
node test_current_tab_basic.js
```

### Option 3: Manual Python Test
```bash
# Install dependencies
pip3 install aiohttp websockets

# Run test
python3 test_current_tab_basic.py
```

## Test Results

The test generates a timestamped report file:
- **Format:** `test_results_YYYYMMDD_HHMMSS.txt`
- **Content:** Detailed step-by-step results
- **Summary:** Test Name: Current Tab Basic Functionality - PASSED/FAILED

### Example Result File:
```
CURRENT TAB BASIC TEST REPORT
========================================
Test Name: Current Tab Basic Functionality
Overall Result: PASSED
Timestamp: 2025-06-10 20:55:32
Total Steps: 9
Passed: 8
Failed: 1

========================================
DETAILED RESULTS:
========================================
[20:55:30] PASSED: Successfully launched Chrome with extension
[20:55:31] PASSED: Successfully opened extension in full screen
[20:55:32] PASSED: Successfully navigated to Saved Tabs
[20:55:32] PASSED: Deleted 0 saved tabs
[20:55:33] PASSED: Successfully navigated to Current Tabs
[20:55:33] PASSED: Correctly shows minimal tabs initially: 0 tab items, 0 URLs
[20:55:35] PASSED: Opened new browser tab with test URL
[20:55:37] PASSED: Successfully found test URL in Current Tab
[20:55:37] FAILED: Could not verify Uncategorized grouping
```

## Requirements

### System Requirements:
- Google Chrome browser
- Node.js 14+ (for JavaScript test)
- Python 3.7+ (for Python test)

### Extension Requirements:
- Extension must be loaded in Chrome
- Extension ID must match `fnklipkenfpdakdficiofcdejbiajgeh`
- Extension must be in the current directory

## Test Environment

The test creates a **clean browser environment**:
- New Chrome instance with only the extension loaded
- No existing tabs or data
- Full screen mode for better visibility
- Extension opened in its own tab (not popup)

## Troubleshooting

### Common Issues:

**"Extension not found"**
- Ensure you're running from the extension directory
- Check that `manifest.json` exists
- Verify Chrome can load the extension

**"Navigation timeout"**
- Extension might take longer to load
- Check console for JavaScript errors
- Verify extension UI elements exist

**"URL not found in Current Tab"**
- Extension might not be detecting new tabs
- Check background script is running
- Verify tab change notifications work

**"Uncategorized group not found"**
- Extension might use different CSS classes
- Check actual DOM structure in browser
- Update selectors in test script

### Debug Mode:
Run tests with browser visible (JavaScript test runs in non-headless mode by default) to see what's happening.

## Customization

### Change Test URL:
Edit the `testUrl` variable in either script:
```javascript
const testUrl = 'https://www.google.com';  // Change this
```

### Add More Verification Steps:
Extend the `steps` array in either script with additional test functions.

### Change Extension ID:
Update the `extensionId` variable if your extension has a different ID.

## Integration

These tests can be integrated into CI/CD pipelines:
- Exit code 0 = PASSED
- Exit code 1 = FAILED
- Results in machine-readable format

Example CI usage:
```bash
./run_test.sh
if [ $? -eq 0 ]; then
    echo "✅ Tests passed - ready for deployment"
else
    echo "❌ Tests failed - blocking deployment"
    exit 1
fi
```