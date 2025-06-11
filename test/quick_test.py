#!/usr/bin/env python3
"""
Quick test to open extension and verify connection
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

def quick_test():
    """Quick connection test"""
    driver = None
    try:
        print("🔍 Connecting to Chrome...")
        
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        print("✅ Connected to Chrome")
        
        # Try to navigate directly to extension
        extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
        popup_url = f"chrome-extension://{extension_id}/popup.html"
        
        print(f"🚀 Navigating to: {popup_url}")
        driver.get(popup_url)
        time.sleep(3)
        
        print(f"📍 Current URL: {driver.current_url}")
        print(f"📍 Page title: {driver.title}")
        
        if extension_id in driver.current_url:
            print("✅ Extension loaded successfully!")
            
            # Quick test of element selectors
            try:
                current_btn = driver.find_element(By.CSS_SELECTOR, "[data-tab='categorize']")
                print(f"✅ Found Current tab button: {current_btn.text}")
                
                grouping_select = driver.find_element(By.ID, "unifiedGroupingSelect")
                print(f"✅ Found grouping select: {grouping_select.get_attribute('value')}")
                
                search_input = driver.find_element(By.ID, "unifiedSearchInput")
                print(f"✅ Found search input")
                
                print("🎯 All key elements found - extension is ready for testing!")
                return True
                
            except Exception as e:
                print(f"❌ Element finding error: {e}")
                return False
        else:
            print("❌ Extension not loaded")
            return False
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        return False
    finally:
        # Don't close driver
        pass

if __name__ == "__main__":
    success = quick_test()
    if success:
        print("\n🎯 Quick test successful - ready for full test!")
    else:
        print("\n❌ Quick test failed")