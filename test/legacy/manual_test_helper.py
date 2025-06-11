#!/usr/bin/env python3
"""
Manual Test Helper - Avoids extension loading issues
Opens browser for manual testing setup
"""

import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def open_browser_for_manual_testing():
    """Open Chrome browser without automatic extension loading"""
    try:
        print("🚀 Opening Chrome for manual extension testing...")
        print("=" * 50)
        
        # Get extension directory
        test_dir = os.path.dirname(os.path.abspath(__file__))
        extension_dir = os.path.dirname(test_dir)
        
        # Setup Chrome options - minimal for manual testing
        chrome_options = Options()
        chrome_options.add_experimental_option("detach", True)  # Keep browser open
        chrome_options.add_argument("--disable-web-security")
        chrome_options.add_argument("--no-first-run")
        chrome_options.add_argument("--disable-default-apps")
        
        # Initialize driver
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.set_window_size(1200, 800)
        
        # Open chrome://extensions page
        driver.get("chrome://extensions/")
        time.sleep(2)
        
        print("✅ Browser opened successfully!")
        print("")
        print("📋 Manual Setup Instructions:")
        print("=" * 30)
        print("1. Enable 'Developer mode' toggle (top right)")
        print("2. Click 'Load unpacked' button")
        print(f"3. Select this directory: {extension_dir}")
        print("4. The extension should load successfully")
        print("5. Click on the extension icon or open popup manually")
        print("")
        print("🔍 To test search functionality:")
        print("- Open several tabs with different websites")
        print("- Open the extension popup")
        print("- Go to Current tab")
        print("- Use the search box to filter tabs")
        print("- Verify group counters update")
        print("- Verify empty groups are hidden")
        print("")
        print("📂 To test GROUP BY functionality:")
        print("- Open tabs with different domains")
        print("- Switch between Category and Domain grouping")
        print("- Verify proper domain names (no 'unknown')")
        print("")
        print("⚠️  Note: Browser will stay open for manual testing")
        print("💡 Close browser manually when done testing")
        
        return True
        
    except Exception as e:
        print(f"❌ Error opening browser: {e}")
        return False

def main():
    """Run manual test helper"""
    success = open_browser_for_manual_testing()
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())