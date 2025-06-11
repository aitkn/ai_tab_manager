# WSL + Windows Chrome Testing Guide

## Quick Setup (One-time)

### Step 1: Load Extension in Windows Chrome
1. Open Chrome **on Windows** (not in WSL)
2. Go to `chrome://extensions/`
3. Enable "Developer mode" toggle (top right)
4. Click "Load unpacked" button
5. Navigate to your WSL extension folder:
   - Path: `\\wsl$\Ubuntu\home\proshkin\proj\chrome_tabs_extension`
   - Or use: `\\wsl$\<your-distro>\home\<username>\proj\chrome_tabs_extension`
6. Select the folder and click "Select Folder"
7. Extension should load with a new ID

### Step 2: Run WSL-Safe Tests
```bash
cd /home/proshkin/proj/chrome_tabs_extension/test
./run_modular_tests.sh wsl
```

## What the WSL-Safe Test Does

✅ **Comprehensive Testing** (No Windows GUI issues):
- Loads extension in headless Chrome
- Creates test tabs with diverse URLs
- Tests search filtering functionality
- Verifies group counter updates
- Tests search clearing
- Tests GROUP BY domain switching
- Verifies "unknown" domain fix

✅ **Search Functionality Tests**:
- Case-insensitive filtering
- Group counter updates during search
- Empty group handling
- Search restoration when cleared

✅ **GROUP BY Tests**:
- Domain grouping functionality
- Proper domain extraction (no "unknown")
- Mode switching between category/domain

## Expected Output

```
🐧 WSL-Safe Chrome Extension Test
========================================
🚀 Setting up headless Chrome for WSL...
✅ Headless Chrome started successfully
✅ Extension detected in chrome://extensions
✅ Extension ID found: <extension-id>
✅ Extension popup accessible
✅ Extension UI elements detected
🔍 Testing search functionality...
📝 Creating test tabs...
   Created tab 1: https://github.com/microsoft/vscode...
   Created tab 2: https://stackoverflow.com/questions/java...
   Created tab 3: https://youtube.com/watch?v=python-tutor...
   Created tab 4: https://google.com/search?q=testing...
✅ Clicked Current tab button
✅ Search input found: #searchInput
📊 Initial tab count: 5
🔍 Testing search filtering...
📊 Filtered tab count: 2
✅ Search filtering works: 2 < 5
✅ Search results contain 'github'
📊 Checking group counter updates...
   Group: Uncategorized (2)
✅ Found 1 group counters
🧹 Testing search clear...
📊 Restored tab count: 5
✅ Search clear works: 5 ≈ 5
📂 Testing GROUP BY functionality...
✅ GROUP BY selector found: #categorizeGroupingSelect
🌐 Switching to Domain grouping...
📊 Found 4 domain groups
✅ Domain grouping works
✅ No 'unknown' domain headers (bug fixed)

🎯 WSL-Safe Test Results:
✅ Extension loaded successfully
✅ Popup accessible
✅ Search functionality tested
✅ GROUP BY functionality tested
✅ Ready for manual testing
```

## Troubleshooting

### Extension Not Found
- Make sure extension is loaded in Windows Chrome first
- Check the extension is enabled in chrome://extensions
- Verify the path `\\wsl$\Ubuntu\...` is accessible

### Test Fails
- Extension may need to be reloaded in chrome://extensions
- Check if tabs are being created successfully
- Verify search input exists in Current tab view

### Still See Frozen Window
- The frozen window is from previous test - ignore it
- WSL-safe test runs completely in headless mode
- No new windows will open with WSL-safe testing

## Benefits of WSL-Safe Testing

✅ No Windows display conflicts
✅ No frozen browser windows  
✅ Comprehensive automated testing
✅ Fast execution (headless)
✅ Reliable results
✅ Perfect for TDD workflow