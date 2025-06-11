#!/usr/bin/env python3
"""
Test Windows Chrome Connection
Simple test to verify we can connect to Windows Chrome with extension
"""

import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def test_windows_chrome_connection():
    """Test connecting to Windows Chrome Default profile"""
    
    print("🔍 Testing Windows Chrome Connection")
    print("=" * 50)
    
    extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
    driver = None
    
    try:
        print("🚀 Setting up Windows Chrome connection...")
        
        chrome_options = Options()
        
        # Method 1: Try to use Windows Chrome binary directly
        try:
            windows_chrome_path = "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
            chrome_options.binary_location = windows_chrome_path
            
            # Use Windows Chrome Default profile
            username = os.environ.get('USER', 'proshkin')
            windows_user_data = f"/mnt/c/Users/{username}/AppData/Local/Google/Chrome/User Data"
            
            print(f"📁 Windows user data: {windows_user_data}")
            print(f"👤 Username: {username}")
            
            chrome_options.add_argument(f"--user-data-dir={windows_user_data}")
            chrome_options.add_argument("--profile-directory=Default")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--remote-debugging-port=9222")
            
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            
            print("✅ Connected to Windows Chrome Default profile")
            
        except Exception as e:
            print(f"❌ Direct connection failed: {e}")
            print("🔄 Trying fallback method...")
            
            # Method 2: Connect to existing Chrome session on Windows host
            # Use correct IP and port
            connection_attempts = [
                "172.25.48.1:9223",  # Correct endpoint
                "172.25.48.1:9222",  # Backup
                "127.0.0.1:9223",    # Local fallback
                "127.0.0.1:9222"     # Local fallback
            ]
            
            for address in connection_attempts:
                try:
                    print(f"🔄 Trying connection to {address}...")
                    chrome_options = Options()
                    chrome_options.add_experimental_option("debuggerAddress", address)
                    
                    service = Service(ChromeDriverManager().install())
                    driver = webdriver.Chrome(service=service, options=chrome_options)
                    
                    print(f"✅ Connected to Chrome session at {address}")
                    break
                    
                except Exception as addr_error:
                    print(f"❌ Failed to connect to {address}: {addr_error}")
                    continue
            else:
                raise Exception("All connection attempts failed")
        
        # Test extension access
        popup_url = f"chrome-extension://{extension_id}/popup.html"
        print(f"🔗 Testing extension access: {popup_url}")
        
        driver.get(popup_url)
        time.sleep(3)
        
        print(f"📍 Current URL: {driver.current_url}")
        print(f"📍 Page title: {driver.title}")
        
        # Check if we're on the extension page
        if extension_id in driver.current_url:
            print("✅ Successfully accessed extension!")
            
            # Quick check for extension elements
            page_source = driver.page_source
            if "AI Tab Manager" in page_source:
                print("✅ Extension UI detected!")
            else:
                print("⚠️ Extension URL accessible but UI may not be loaded")
                
        else:
            print("❌ Not on extension page")
            
        # Take a screenshot for debugging
        screenshot_path = f"windows_chrome_test_{int(time.time())}.png"
        driver.save_screenshot(screenshot_path)
        print(f"📷 Screenshot saved: {screenshot_path}")
        
        return True
        
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False
        
    finally:
        if driver:
            try:
                driver.quit()
                print("✅ Browser closed")
            except:
                pass

def main():
    """Run Windows Chrome connection test"""
    success = test_windows_chrome_connection()
    
    if success:
        print("\n🎯 Windows Chrome connection test completed")
        print("If extension was detected, you can now run the full TDD test")
    else:
        print("\n❌ Windows Chrome connection test failed")
        print("💡 Troubleshooting steps:")
        print("1. Make sure Windows Chrome is closed")
        print("2. Or start Chrome with: '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe' --remote-debugging-port=9222")
        print("3. Verify extension ID is correct in chrome://extensions")
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())