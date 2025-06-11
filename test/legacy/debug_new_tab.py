#!/usr/bin/env python3
"""
Debug NEW tab creation for extension
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def debug_new_tab():
    """Debug NEW tab creation"""
    try:
        print("🔍 Connecting to Chrome...")
        
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        print("✅ Connected to Chrome")
        print(f"📊 Found {len(driver.window_handles)} total tabs")
        
        # Show current tabs
        for i, handle in enumerate(driver.window_handles):
            try:
                driver.switch_to.window(handle)
                url = driver.current_url
                title = driver.title
                print(f"   Tab {i+1}: {title[:30]} - {url[:60]}")
            except Exception as e:
                print(f"   Tab {i+1}: Error reading - {e}")
        
        # Try to find a main tab
        extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
        popup_url = f"chrome-extension://{extension_id}/popup.html"
        
        print(f"\\n🔍 Looking for main tab to open extension from...")
        main_tab_found = False
        main_tab_handle = None
        
        for handle in driver.window_handles:
            try:
                driver.switch_to.window(handle)
                current_url = driver.current_url
                print(f"   Checking: {current_url[:60]}")
                
                # Find a proper main tab (not iframe or ad tab)
                if any(domain in current_url for domain in ["youtube.com", "cnn.com", "google.com"]):
                    print(f"   ✅ Found main tab: {current_url}")
                    main_tab_found = True
                    main_tab_handle = handle
                    break
            except Exception as e:
                print(f"   ❌ Error checking tab: {e}")
                continue
        
        if main_tab_found:
            print(f"\\n🚀 Opening extension in NEW tab from main tab...")
            initial_handles = set(driver.window_handles)
            print(f"   Initial handles: {len(initial_handles)}")
            
            # Try method 1: window.open
            print("   Method 1: window.open()")
            driver.execute_script(f"window.open('{popup_url}', '_blank');")
            time.sleep(2)
            
            after_handles_1 = set(driver.window_handles)
            new_handles_1 = after_handles_1 - initial_handles
            print(f"   Method 1 result: {len(new_handles_1)} new tabs")
            
            if len(new_handles_1) == 0:
                print("   Method 2: Chrome new tab + navigate")
                # Alternative: Create new tab using Chrome shortcuts
                driver.execute_script("window.open('about:blank', '_blank');")
                time.sleep(1)
                
                after_handles_2 = set(driver.window_handles)
                new_handles_2 = after_handles_2 - initial_handles
                print(f"   Method 2 step 1: {len(new_handles_2)} new tabs")
                
                if len(new_handles_2) > 0:
                    # Navigate the new blank tab to extension
                    new_handle = list(new_handles_2)[0]
                    driver.switch_to.window(new_handle)
                    driver.get(popup_url)
                    time.sleep(2)
                    print(f"   Method 2 step 2: navigated to {driver.current_url}")
                    
                    if extension_id in driver.current_url:
                        print("   ✅ Method 2 successful!")
                        return True
                else:
                    print("   Method 3: Direct tab creation via new window")
                    # Last resort: create completely new window
                    try:
                        driver.execute_script(f"window.open('{popup_url}');")
                        time.sleep(2)
                        
                        after_handles_3 = set(driver.window_handles)
                        new_handles_3 = after_handles_3 - initial_handles
                        print(f"   Method 3 result: {len(new_handles_3)} new tabs")
                        
                        if len(new_handles_3) > 0:
                            new_handle = list(new_handles_3)[0]
                            driver.switch_to.window(new_handle)
                            if extension_id in driver.current_url:
                                print("   ✅ Method 3 successful!")
                                return True
                    except Exception as e:
                        print(f"   Method 3 failed: {e}")
            
            after_handles = set(driver.window_handles)
            print(f"   After handles: {len(after_handles)}")
            
            new_handles = after_handles - initial_handles
            print(f"   New handles: {len(new_handles)}")
            
            if len(new_handles) > 0:
                for handle in new_handles:
                    try:
                        driver.switch_to.window(handle)
                        url = driver.current_url
                        title = driver.title
                        print(f"   New tab: {title} - {url}")
                        
                        if extension_id in url:
                            print("   ✅ Extension tab created successfully!")
                            return True
                    except Exception as e:
                        print(f"   ❌ Error checking new tab: {e}")
            else:
                print("   ❌ No new tabs created")
        else:
            print("\\n❌ No main tab found for window.open execution")
        
        return False
        
    except Exception as e:
        print(f"❌ Debug error: {e}")
        return False

if __name__ == "__main__":
    success = debug_new_tab()
    if success:
        print("\\n🎯 NEW tab creation successful!")
    else:
        print("\\n❌ NEW tab creation failed")