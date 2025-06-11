#!/usr/bin/env python3
"""
Check what URL a New Tab page actually has
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def check_newtab_url():
    try:
        print("🔍 Connecting to Chrome...")
        
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        print("✅ Connected to Chrome")
        
        # Check current tabs and their URLs
        for i, handle in enumerate(driver.window_handles):
            try:
                driver.switch_to.window(handle)
                url = driver.current_url
                title = driver.title
                print(f"Tab {i+1}:")
                print(f"  Title: '{title}'")
                print(f"  URL: '{url}'")
                print(f"  URL type: {type(url)}")
                
                # Test our restore conditions
                should_not_restore = (not url or 
                                    url == "about:blank" or 
                                    "fnklipkenfpdakdficiofcdejbiajgeh" in url)
                
                print(f"  Should restore: {not should_not_restore}")
                print()
                
            except Exception as e:
                print(f"Tab {i+1}: Error - {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    check_newtab_url()