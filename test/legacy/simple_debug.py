#!/usr/bin/env python3
"""
Simple debug to check current browser state and open extension correctly
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def simple_debug():
    """Simple debug of browser state"""
    driver = None
    try:
        print("🔍 Checking browser state...")
        
        # Connect to Chrome
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        # Check current tabs
        all_handles = driver.window_handles
        print(f"📊 Found {len(all_handles)} tabs")
        
        for i, handle in enumerate(all_handles):
            try:
                driver.switch_to.window(handle)
                url = driver.current_url
                title = driver.title
                print(f"   Tab {i+1}: {title[:30]} - {url[:60]}")
            except Exception as e:
                print(f"   Tab {i+1}: (error accessing tab: {e})")
        
        # Try to open extension in a completely new tab
        extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
        popup_url = f"chrome-extension://{extension_id}/popup.html"
        
        print(f"\n🚀 Method 1: Opening extension with window.open(): {popup_url}")
        initial_handles = set(driver.window_handles)
        driver.execute_script(f"window.open('{popup_url}', '_blank');")
        time.sleep(3)
        
        # Check if that worked
        after_open_handles = set(driver.window_handles)
        if len(after_open_handles) == len(initial_handles):
            print("❌ window.open() failed, trying driver.get() method...")
            
            # Try using driver.get() instead in current tab
            driver.get(popup_url)
            time.sleep(3)
        
        # Find the NEW tab that was created
        new_handles = set(driver.window_handles)
        new_tab_handles = new_handles - initial_handles
        
        print(f"📊 After opening extension: {len(new_handles)} total tabs, {len(new_tab_handles)} new tabs")
        
        extension_found = False
        extension_handle = None
        
        # Check only the new tab(s)
        for handle in new_tab_handles:
            try:
                driver.switch_to.window(handle)
                url = driver.current_url
                title = driver.title
                print(f"   New tab: {title[:30]} - {url}")
                if extension_id in url:
                    print(f"   ✅ Extension found in new tab!")
                    extension_found = True
                    extension_handle = handle
                    break
            except Exception as e:
                print(f"   New tab error: {e}")
        
        # Also check all tabs to be sure
        print(f"\n📋 All tabs after opening extension:")
        for i, handle in enumerate(driver.window_handles):
            try:
                driver.switch_to.window(handle)
                url = driver.current_url
                title = driver.title
                marker = "🎯" if extension_id in url else "  "
                print(f"   {marker} Tab {i+1}: {title[:30]} - {url[:60]}")
            except Exception as e:
                print(f"   Tab {i+1}: (error: {e})")
        
        if extension_found:
            print("\n✅ Extension successfully opened!")
            return True
        else:
            print("\n❌ Extension not found after opening")
            return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    finally:
        # Don't quit driver
        pass

if __name__ == "__main__":
    simple_debug()