# Test Directory Index

All test-related files have been moved to this `/test/` directory.

## 🚀 Main Tests (Ready to Run)

### Current Tab Basic Functionality Test ⭐
**Primary test for Current Tab feature**
- **Runner:** `./run_test.sh` (easiest)
- **JavaScript:** `test_current_tab_basic.js` (Puppeteer)
- **Python:** `test_current_tab_basic.py` (DevTools Protocol)
- **Result:** Single PASSED/FAILED with detailed report

### MCP-Based Tests (Advanced)
- **Controls:** `test_current_tab_controls.js` - MCP Chrome debugger tests
- **Comprehensive:** `current_tab_tests.js` - Full test class
- **Functional:** `functional_tests.js` - Complete functionality suite

## 📋 Documentation

- **`README.md`** - Complete test documentation
- **`QUICK_START.md`** ⭐ - Quick usage guide  
- **`TEST_SUMMARY.md`** - Overview of main test
- **`HOW_TO_RUN_TESTS.md`** - MCP testing guide
- **`MANUAL_TEST_CHECKLIST.md`** - Manual testing checklist
- **`INDEX.md`** - This file

## 🧪 Legacy/Development Tests

### ML & TensorFlow Tests
- **`test_ml_basic.html`** - Basic ML functionality test
- **`test_ml_browser.html`** - Browser-based ML test  
- **`test_ml_simple.js`** - Simple ML test script
- **`test_ml_features.md`** - ML features testing doc
- **`test_tensorflow_loading.html`** - TensorFlow loading test

### UI Tests
- **`test_rules_ui.js`** - Rules UI testing
- **`test_scroll_final.js`** - Scroll functionality test
- **`test_scroll_fix.js`** - Scroll bug fix test

### Misc
- **`test1.js`** - Basic test script

## 🔧 Configuration

- **`package.json`** - Node.js dependencies for JavaScript tests
- **`run_test.sh`** - Automated test runner script

## 🎯 Recommended Usage

For new users testing Current Tab functionality:

```bash
cd test/
./run_test.sh
# Choose option 1 (JavaScript)
```

For developers:
- Use MCP-based tests for deep integration testing
- Use ML tests for TensorFlow functionality
- Use UI tests for specific component testing

## 📊 Test Types

| Type | Files | Purpose |
|------|-------|---------|
| **Main** | `test_current_tab_basic.*` | Primary functional test |
| **MCP** | `*_controls.js`, `functional_tests.js` | Chrome extension debugging |
| **ML** | `test_ml_*` | Machine learning features |
| **UI** | `test_*_ui.js`, `test_scroll_*` | User interface components |
| **Docs** | `*.md` | Documentation and guides |

All tests are now organized in this directory for better maintenance and clarity.