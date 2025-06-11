# Functional Test Suite

Clean, organized pytest-based functional test suite for Chrome Extension AI Tab Manager.

## Overview

This test suite provides comprehensive functional testing with:
- **Pytest framework** for better test discovery and reporting
- **Standardized setup/cleanup** for consistent test environment
- **Smart tab management** with proper state restoration
- **Demo mode** with visual balloon notifications
- **Modular test organization** by feature area

## Quick Start

### Prerequisites
- Python 3.8+
- Chrome browser with remote debugging enabled
- Chrome Extension loaded and running

### Setup
```bash
# Install dependencies
pip install -r functional/requirements.txt

# Enable Chrome remote debugging (Windows from WSL)
# Chrome should be running with: --remote-debugging-port=9223
```

### Run All Tests
```bash
# Fast mode (no visual feedback)
pytest functional/

# Demo mode (with visual balloons)
pytest functional/ --demo

# Run specific test file
pytest functional/test_search.py

# Run with HTML report
pytest functional/ --html=logs/report.html
```

## Test Structure

### Core Test Modules
- **`test_search.py`** - Search functionality (filtering, clearing, counters)
- **`test_groupby.py`** - GROUP BY functionality (domain, category, none)
- **`test_current_tabs.py`** - Current tabs loading and display

### Test Infrastructure
- **`conftest.py`** - Pytest fixtures and shared utilities
- **`__init__.py`** - Package initialization

## Test Features

### Standardized Test Flow
Every test follows the same pattern:
1. **Remember initial state** - Track existing tabs and URLs
2. **Open extension** - Smart extension loading with tab restoration
3. **Create test data** - Generate test tabs as needed
4. **Execute test** - Run specific functionality test
5. **Cleanup** - Close test tabs, restore initial browser state

### Smart Tab Management
- **URL Restoration**: Remembers replaced tabs and restores them
- **Chrome Security Handling**: Works around `window.open()` restrictions
- **Extension Exclusion**: Prevents extension from closing itself
- **Initial State Restoration**: Returns browser to pre-test condition

### Demo Mode
Visual testing with balloon notifications:
```bash
pytest functional/ --demo
```
- Shows test progress with static balloons
- Color-coded status (green=passed, red=failed, blue=info)
- 2.5 second display duration
- No animations (static placement)

## Test Categories

### Search Tests (`test_search.py`)
- ✅ Basic search filtering
- ✅ Search clearing and restoration
- ✅ Group counter updates during search
- ✅ Case insensitive search
- ✅ Empty group hiding
- ✅ Special character search
- ✅ No results handling

### GROUP BY Tests (`test_groupby.py`)
- ✅ Domain grouping with multiple domains
- ✅ Category grouping
- ✅ No grouping mode
- ✅ Switching between grouping modes
- ✅ Duplicate URL handling
- ✅ Subdomain grouping

### Current Tabs Tests (`test_current_tabs.py`)
- ✅ Current tab button functionality
- ✅ All windows tab inclusion
- ✅ Extension tab exclusion
- ✅ Tab list refresh
- ✅ Display format validation
- ✅ Performance with many tabs
- ✅ Special URL handling

## Running Specific Tests

### By Category
```bash
# Search functionality only
pytest functional/test_search.py

# GROUP BY functionality only
pytest functional/test_groupby.py

# Current tabs functionality only
pytest functional/test_current_tabs.py
```

### By Test Markers
```bash
# Search-related tests
pytest functional/ -m search

# GROUP BY related tests  
pytest functional/ -m groupby

# Current tabs related tests
pytest functional/ -m current_tabs
```

### By Test Name Pattern
```bash
# All basic functionality tests
pytest functional/ -k "basic"

# All edge case tests
pytest functional/ -k "edge"

# Specific test
pytest functional/test_search.py::TestSearchFunctionality::test_search_filtering_basic
```

## Configuration

### Command Line Options
- `--demo` - Enable visual balloon notifications
- `--extension-id=ID` - Override extension ID (default: fnklipkenfpdakdficiofcdejbiajgeh)
- `--html=PATH` - Generate HTML test report
- `--verbose` - Verbose output
- `-s` - Show print statements

### Chrome Connection
Tests connect to Chrome via remote debugging:
- **IP**: 172.25.48.1 (WSL to Windows)
- **Port**: 9223
- **Profile**: Default

## Troubleshooting

### Common Issues

**Connection Failed**
```bash
# Check Chrome is running with remote debugging
curl -s http://172.25.48.1:9223/json/version
```

**Extension Not Found**
```bash
# Verify extension ID and popup URL
pytest functional/test_current_tabs.py::TestCurrentTabsFunctionality::test_current_tab_button_click -v
```

**Tests Fail to Clean Up**
```bash
# Manually close test tabs and restart Chrome
# Or run: python -c "import subprocess; subprocess.run(['chrome', '--remote-debugging-port=9223'])"
```

### Debug Mode
```bash
# Run single test with detailed output
pytest functional/test_search.py::TestSearchFunctionality::test_search_filtering_basic -v -s --demo
```

## Contributing

### Adding New Tests
1. Create test file in `functional/` directory
2. Import from `conftest`: `from conftest import create_test_tabs, show_demo_balloon, wait_for_element`
3. Use `extension_driver` fixture for extension connection
4. Follow standardized test flow pattern
5. Add appropriate test markers

### Test Naming Convention
- Test files: `test_<feature>.py`
- Test classes: `Test<Feature>Functionality`
- Test methods: `test_<feature>_<specific_case>`
- Edge case classes: `Test<Feature>EdgeCases`

### Example New Test
```python
import pytest
from selenium.webdriver.common.by import By
from conftest import create_test_tabs, show_demo_balloon, wait_for_element

class TestNewFeature:
    def test_new_functionality(self, extension_driver, demo_mode):
        state = extension_driver
        show_demo_balloon(state, "Testing new feature", "INFO", demo_mode=demo_mode)
        
        # Create test data
        test_urls = ["https://example.com/test"]
        create_test_tabs(state, test_urls)
        
        # Test specific functionality
        # ... test code ...
        
        # Verify results
        assert condition, "Test should pass"
        show_demo_balloon(state, "✅ New feature works", "PASSED", demo_mode=demo_mode)
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Run Functional Tests
  run: |
    cd test/functional
    pytest --html=../../logs/functional-report.html --self-contained-html
```

### Local Development
```bash
# Quick smoke test
pytest functional/test_current_tabs.py::TestCurrentTabsFunctionality::test_current_tab_button_click

# Full test suite
pytest functional/ --html=logs/report.html

# Demo run for verification
pytest functional/test_search.py --demo
```

This functional test suite provides reliable, maintainable testing for the Chrome Extension with proper cleanup and state management.