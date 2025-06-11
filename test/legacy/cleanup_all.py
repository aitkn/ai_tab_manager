#!/usr/bin/env python3
"""
Complete cleanup utility - closes test tabs and extension popup tabs
Run this to restore environment to clean state
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def complete_cleanup():
    """Close all test tabs and extension popup tabs"""
    driver = None
    try:
        print("🧹 Complete environment cleanup...")
        
        # Connect to Windows Chrome
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        print("✅ Connected to Chrome")
        
        # Get all tabs
        all_handles = driver.window_handles
        print(f"📊 Found {len(all_handles)} total tabs")
        
        # Test URLs and extension patterns to clean up
        cleanup_patterns = [
            # Test URLs
            "github.com/microsoft/vscode",
            "github.com/nodejs/node", 
            "github.com/test",
            "stackoverflow.com/questions/javascript",
            "stackoverflow.com/questions/python",
            "stackoverflow.com/test",
            "docs.python.org/3/tutorial",
            "youtube.com/watch?v=test1",
            "youtube.com/watch?v=test",
            # Extension popup tabs
            "chrome-extension://",
        ]
        
        closed_count = 0
        kept_count = 0
        
        for handle in all_handles:
            try:
                driver.switch_to.window(handle)
                current_url = driver.current_url
                
                should_close = False
                close_reason = ""
                
                # Check for extension popup tabs
                if "chrome-extension://" in current_url and "popup.html" in current_url:
                    should_close = True
                    close_reason = "extension popup"
                else:
                    # Check for test URLs
                    for pattern in cleanup_patterns:
                        if pattern in current_url and pattern != "chrome-extension://":
                            should_close = True
                            close_reason = "test tab"
                            break
                
                if should_close:
                    print(f"🗑️  Closing {close_reason}: {current_url[:60]}...")
                    driver.close()
                    closed_count += 1
                    time.sleep(0.1)  # Small delay between closes
                else:
                    kept_count += 1
                
            except Exception as e:
                # Tab might already be closed or not accessible
                continue
        
        print(f"\n✅ Complete cleanup finished:")
        print(f"   - Closed {closed_count} tabs (test tabs + extension popups)")
        print(f"   - Kept {kept_count} regular browser tabs")
        print(f"   - Total tabs remaining: {kept_count}")
        
        return True
            
    except Exception as e:
        print(f"❌ Cleanup error: {e}")
        return False
    finally:
        if driver:
            try:
                pass  # Don't quit driver, just disconnect
            except:
                pass

if __name__ == "__main__":
    success = complete_cleanup()
    if success:
        print("\n🎯 Environment completely restored!")
        print("🚀 Ready for fresh testing")
    else:
        print("\n❌ Cleanup had issues")
    
    exit(0 if success else 1)