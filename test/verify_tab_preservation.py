#!/usr/bin/env python3
"""
Simple script to verify that tests preserve the initial set of tabs
"""

import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def get_chrome_debug_address():
    """Get Chrome remote debugging address from environment or default"""
    return os.environ.get('CHROME_DEBUG_ADDRESS', '127.0.0.1:9222')

def get_browser_state():
    """Get current browser state"""
    options = Options()
    debug_address = get_chrome_debug_address()
    options.add_experimental_option("debuggerAddress", debug_address)
    
    driver = webdriver.Chrome(options=options)
    
    tabs = []
    for i, handle in enumerate(driver.window_handles, 1):
        try:
            driver.switch_to.window(handle)
            title = driver.title[:50] or "No title"
            url = driver.current_url[:80] or "No URL"
            tabs.append(f"{i}. {title} - {url}")
        except Exception as e:
            tabs.append(f"{i}. ERROR: {str(e)[:50]}")
    
    count = len(driver.window_handles)
    driver.quit()
    return tabs, count

def main():
    print("🔍 VERIFICATION: Tab Preservation During Tests")
    print("=" * 50)
    
    # Record state before test
    print("\n📋 BEFORE TEST:")
    try:
        before_tabs, before_count = get_browser_state()
        for tab in before_tabs:
            print(f"  {tab}")
        print(f"  Total: {before_count} tabs")
    except Exception as e:
        print(f"❌ Error reading initial state: {e}")
        return
    
    # Run a single test
    print(f"\n🧪 RUNNING TEST...")
    os.environ['CHROME_DEBUG_ADDRESS'] = get_chrome_debug_address()
    
    # Run a simple current tabs test (should be clean without Close All complications)
    import subprocess
    result = subprocess.run([
        'python', '-m', 'pytest', 
        'functional/test_current_tabs.py::TestCurrentTabsFunctionality::test_current_tab_button_click',
        '-v', '--tb=no', '-q'
    ], capture_output=True, text=True, cwd='.')
    
    test_passed = result.returncode == 0
    print(f"  Test result: {'✅ PASSED' if test_passed else '❌ FAILED'}")
    if not test_passed:
        print(f"  Error output: {result.stderr[:200]}")
    
    # Check state after test
    print(f"\n📋 AFTER TEST:")
    try:
        after_tabs, after_count = get_browser_state()
        for tab in after_tabs:
            print(f"  {tab}")
        print(f"  Total: {after_count} tabs")
    except Exception as e:
        print(f"❌ Error reading final state: {e}")
        return
    
    # Compare states
    print(f"\n🔍 COMPARISON:")
    print(f"  Tabs before: {before_count}")
    print(f"  Tabs after:  {after_count}")
    
    if before_count == after_count:
        print("  ✅ TAB COUNT PRESERVED")
    else:
        print("  ❌ TAB COUNT CHANGED")
    
    # Check if the same tabs exist (allowing for handle changes)
    before_urls = set()
    after_urls = set()
    
    for tab in before_tabs:
        if " - " in tab and not tab.startswith("ERROR"):
            url = tab.split(" - ", 1)[1]
            before_urls.add(url)
    
    for tab in after_tabs:
        if " - " in tab and not tab.startswith("ERROR"):
            url = tab.split(" - ", 1)[1]
            after_urls.add(url)
    
    missing_urls = before_urls - after_urls
    extra_urls = after_urls - before_urls
    
    if missing_urls:
        print(f"  ❌ MISSING URLs: {list(missing_urls)}")
    if extra_urls:
        print(f"  ❌ EXTRA URLs: {list(extra_urls)}")
    
    if not missing_urls and not extra_urls:
        print("  ✅ ALL ORIGINAL URLS PRESERVED")
    
    # Final verdict
    tabs_preserved = (before_count == after_count and not missing_urls and not extra_urls)
    print(f"\n🎯 FINAL RESULT:")
    if tabs_preserved:
        print("  ✅ SUCCESS: All original tabs preserved during test execution")
    else:
        print("  ❌ FAILURE: Original browser state was not fully preserved")
    
    return tabs_preserved

if __name__ == "__main__":
    main()