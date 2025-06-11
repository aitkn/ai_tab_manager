# Quick Start - Current Tab Test (Python 3.13 + venv)

## Setup (One-time)

```bash
cd test/
./setup_test_env.sh
```

## Run the Test (2 methods)

### Method 1: Automated Runner (Easiest)
```bash
cd test/
./run_test.sh
```

### Method 2: Direct Python (in venv)
```bash
cd test/
source venv/bin/activate
python test_simple.py
```

## Expected Output

**SUCCESS:**
```
🚀 Starting Current Tab Basic Test
==================================================
🔄 Executing: Setup browser with extension
[20:55:30] PASSED: Successfully launched Chrome with extension
🔄 Executing: Open extension in full screen
[20:55:31] PASSED: Successfully opened extension in full screen
...
🎯 Final Result: PASSED
📄 Report saved to: test_results_20250610_205532.txt
Test Name: Current Tab Basic Functionality - PASSED
```

**FAILURE:**
```
🚀 Starting Current Tab Basic Test
==================================================
🔄 Executing: Setup browser with extension
[20:55:30] FAILED: Failed to setup browser: Extension not found
🎯 Final Result: FAILED
📄 Report saved to: test_results_20250610_205532.txt
Test Name: Current Tab Basic Functionality - FAILED
```

## What the Test Does

1. ✅ **Opens Chrome** with extension loaded in clean environment
2. ✅ **Opens extension** in full screen (not popup)
3. ✅ **Goes to Saved Tabs** and deletes all saved tabs
4. ✅ **Goes to Current Tabs** - should show no URLs initially
5. ✅ **Opens new browser tab** with test URL (example.com)
6. ✅ **Verifies URL appears** in Current Tab view
7. ✅ **Verifies URL** is in "Uncategorized" group

## Test Results

- **File:** `test_results_YYYYMMDD_HHMMSS.txt`
- **Format:** Single line result + detailed steps
- **Result:** `Test Name: Current Tab Basic Functionality - PASSED/FAILED`

## Troubleshooting

**"Extension not found"** → Run from `/test` folder, ensure `../manifest.json` exists
**"Navigation timeout"** → Extension may have errors, check browser console
**"URL not found"** → Extension may not detect new tabs, check background script