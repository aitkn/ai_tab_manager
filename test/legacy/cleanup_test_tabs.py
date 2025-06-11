#!/usr/bin/env python3
"""
Quick cleanup script to close test tabs and restore environment
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def cleanup_test_tabs():
    """Close test tabs created during testing"""
    driver = None
    try:
        print("🧹 Cleaning up test tabs...")
        
        # Connect to Windows Chrome
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        print("✅ Connected to Chrome")
        
        # Get all tabs
        all_handles = driver.window_handles
        print(f"📊 Found {len(all_handles)} total tabs")
        
        # Test URLs we created
        test_urls = [
            "github.com/microsoft/vscode",
            "github.com/nodejs/node", 
            "stackoverflow.com/questions/javascript",
            "stackoverflow.com/questions/python",
            "docs.python.org/3/tutorial",
            "youtube.com/watch?v=test1"
        ]
        
        closed_count = 0
        extension_popup_tabs = 0
        
        for handle in all_handles:
            try:
                driver.switch_to.window(handle)
                current_url = driver.current_url
                
                # Close extension popup tabs (but keep any extension background/service worker tabs)
                if "chrome-extension:" in current_url and "popup.html" in current_url:
                    print(f"🗑️  Closing extension popup: {current_url}")
                    driver.close()
                    extension_popup_tabs += 1
                    time.sleep(0.1)
                    continue
                
                # Close test tabs
                should_close = False
                for test_url in test_urls:
                    if test_url in current_url:
                        should_close = True
                        break
                
                if should_close:
                    print(f"🗑️  Closing: {current_url}")
                    driver.close()
                    closed_count += 1
                    time.sleep(0.1)  # Small delay between closes
                
            except Exception as e:
                # Tab might already be closed or not accessible
                continue
        
        total_closed = closed_count + extension_popup_tabs
        print(f"✅ Cleanup complete:")
        print(f"   - Closed {closed_count} test tabs")
        print(f"   - Closed {extension_popup_tabs} extension popup tabs")
        print(f"   - Total tabs closed: {total_closed}")
        print(f"   - Remaining tabs: {len(all_handles) - total_closed}")
        
        # Don't try to switch back to extension tab since we closed them all
        print("🏁 All extension popup tabs closed - clean environment restored")
            
    except Exception as e:
        print(f"❌ Cleanup error: {e}")
    finally:
        if driver:
            try:
                pass  # Don't quit driver, just leave it connected
            except:
                pass

if __name__ == "__main__":
    cleanup_test_tabs()
    print("\n🎯 Environment restored - ready for next test")