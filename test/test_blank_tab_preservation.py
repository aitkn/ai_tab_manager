#!/usr/bin/env python3
"""
Test that specifically verifies preservation of about:blank tabs
"""

import os
import subprocess
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def get_chrome_debug_address():
    return os.environ.get('CHROME_DEBUG_ADDRESS', '127.0.0.1:9222')

def setup_blank_tabs():
    """Create a test scenario with multiple blank tabs"""
    options = Options()
    debug_address = get_chrome_debug_address()
    options.add_experimental_option("debuggerAddress", debug_address)
    
    driver = webdriver.Chrome(options=options)
    
    # Close any existing tabs except one
    handles = driver.window_handles
    for handle in handles[1:]:  # Keep first tab, close others
        driver.switch_to.window(handle)
        driver.close()
    
    # Navigate first tab to blank
    driver.switch_to.window(handles[0])
    driver.get("about:blank")
    
    # Create a second blank tab
    driver.execute_script("window.open('about:blank', '_blank');")
    
    # Create a third blank tab  
    driver.execute_script("window.open('about:blank', '_blank');")
    
    # Verify we have 3 blank tabs
    final_handles = driver.window_handles
    print(f"Setup complete: {len(final_handles)} blank tabs created")
    
    for i, handle in enumerate(final_handles, 1):
        driver.switch_to.window(handle)
        url = driver.current_url
        print(f"  Tab {i}: {url}")
    
    driver.quit()
    return len(final_handles)

def get_tab_count():
    """Get current tab count"""
    options = Options()
    debug_address = get_chrome_debug_address()
    options.add_experimental_option("debuggerAddress", debug_address)
    
    driver = webdriver.Chrome(options=options)
    count = len(driver.window_handles)
    driver.quit()
    return count

def main():
    print("🧪 BLANK TAB PRESERVATION TEST")
    print("=" * 40)
    
    # Setup test scenario with blank tabs
    print("\n📋 SETUP: Creating blank tabs...")
    try:
        expected_count = setup_blank_tabs()
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        return
    
    # Record before state
    before_count = get_tab_count()
    print(f"\n📋 BEFORE TEST: {before_count} tabs")
    
    # Run test
    print(f"\n🧪 RUNNING TEST...")
    os.environ['CHROME_DEBUG_ADDRESS'] = get_chrome_debug_address()
    
    result = subprocess.run([
        'python', '-m', 'pytest', 
        'functional/test_current_tabs.py::TestCurrentTabsFunctionality::test_current_tab_button_click',
        '-v', '--tb=no', '-q'
    ], capture_output=True, text=True, cwd='.')
    
    test_passed = result.returncode == 0
    print(f"  Test result: {'✅ PASSED' if test_passed else '❌ FAILED'}")
    
    # Record after state
    after_count = get_tab_count()
    print(f"\n📋 AFTER TEST: {after_count} tabs")
    
    # Verify preservation
    print(f"\n🔍 VERIFICATION:")
    print(f"  Expected: {before_count} tabs")
    print(f"  Actual:   {after_count} tabs")
    
    if before_count == after_count:
        print("  ✅ BLANK TAB COUNT PRESERVED")
        if test_passed:
            print("  ✅ TEST PASSED")
            print("\n🎯 SUCCESS: Blank tabs properly preserved!")
        else:
            print("  ❌ TEST FAILED (but tabs preserved)")
            print("\n⚠️  PARTIAL: Tabs preserved but test failed")
    else:
        print("  ❌ BLANK TAB COUNT CHANGED")
        print(f"\n❌ FAILURE: Lost {before_count - after_count} blank tabs")

if __name__ == "__main__":
    main()