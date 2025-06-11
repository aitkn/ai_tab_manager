#!/usr/bin/env python3
"""
Debug Extension UI - See what's actually on the page
"""

import os
import time
import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

class ExtensionUIDebugger:
    def __init__(self):
        self.driver = None
        self.extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
    
    def setup_browser(self):
        """Setup Chrome for debugging"""
        try:
            chrome_options = Options()
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-web-security")
            chrome_options.add_argument("--user-data-dir=/tmp/chrome-debug-profile")
            
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.driver.set_window_size(1200, 800)
            
            print("✅ Chrome launched for debugging")
            return True
            
        except Exception as e:
            print(f"❌ Browser setup failed: {e}")
            return False
    
    def debug_extension_ui(self):
        """Debug what's actually on the extension page"""
        try:
            # Access extension
            popup_url = f"chrome-extension://{self.extension_id}/popup.html"
            print(f"📍 Accessing: {popup_url}")
            
            self.driver.get(popup_url)
            time.sleep(5)  # Give it time to load
            
            print(f"📍 Current URL: {self.driver.current_url}")
            print(f"📍 Page title: {self.driver.title}")
            
            # Take screenshot
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            screenshot_path = f"debug_extension_ui_{timestamp}.png"
            self.driver.save_screenshot(screenshot_path)
            print(f"📷 Screenshot saved: {screenshot_path}")
            
            # Get page source
            page_source = self.driver.page_source
            source_file = f"debug_extension_source_{timestamp}.html"
            with open(source_file, 'w', encoding='utf-8') as f:
                f.write(page_source)
            print(f"📄 Page source saved: {source_file}")
            
            # Debug navigation buttons
            print("\n🔍 Looking for navigation buttons...")
            
            # Check all buttons
            buttons = self.driver.find_elements(By.TAG_NAME, "button")
            print(f"Found {len(buttons)} buttons:")
            for i, btn in enumerate(buttons):
                try:
                    text = btn.text.strip()
                    data_tab = btn.get_attribute("data-tab")
                    btn_id = btn.get_attribute("id")
                    classes = btn.get_attribute("class")
                    visible = btn.is_displayed()
                    enabled = btn.is_enabled()
                    
                    print(f"  Button {i+1}:")
                    print(f"    Text: '{text}'")
                    print(f"    ID: {btn_id}")
                    print(f"    data-tab: {data_tab}")
                    print(f"    Classes: {classes}")
                    print(f"    Visible: {visible}, Enabled: {enabled}")
                    print()
                except Exception as e:
                    print(f"    Error reading button {i+1}: {e}")
            
            # Check for specific elements
            print("🔍 Looking for specific elements...")
            
            # Current tab button
            current_selectors = [
                "button[data-tab='categorize']",
                "#categorizeTab", 
                ".tab-btn",
                "[data-tab='categorize']"
            ]
            
            for selector in current_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    print(f"  Selector '{selector}': Found {len(elements)} elements")
                    for elem in elements:
                        print(f"    - Text: '{elem.text}', Visible: {elem.is_displayed()}")
                except Exception as e:
                    print(f"  Selector '{selector}': Error - {e}")
            
            # Search input
            search_selectors = [
                "#unifiedSearchInput",
                ".search-input",
                "input[type='text']",
                "input[placeholder*='Search']"
            ]
            
            print("\n🔍 Looking for search inputs...")
            for selector in search_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    print(f"  Selector '{selector}': Found {len(elements)} elements")
                    for elem in elements:
                        placeholder = elem.get_attribute("placeholder")
                        print(f"    - Placeholder: '{placeholder}', Visible: {elem.is_displayed()}")
                except Exception as e:
                    print(f"  Selector '{selector}': Error - {e}")
            
            # GROUP BY select
            groupby_selectors = [
                "#unifiedGroupingSelect",
                ".grouping-select",
                "select"
            ]
            
            print("\n🔍 Looking for GROUP BY selects...")
            for selector in groupby_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    print(f"  Selector '{selector}': Found {len(elements)} elements")
                    for elem in elements:
                        options = elem.find_elements(By.TAG_NAME, "option")
                        print(f"    - Options: {len(options)}, Visible: {elem.is_displayed()}")
                        for opt in options:
                            print(f"      Option: '{opt.text}' (value: {opt.get_attribute('value')})")
                except Exception as e:
                    print(f"  Selector '{selector}': Error - {e}")
            
            # Check if there are any error messages or loading states
            print("\n🔍 Checking for error/loading messages...")
            error_selectors = [
                ".error",
                ".loading", 
                "#apiKeyPrompt",
                ".status"
            ]
            
            for selector in error_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for elem in elements:
                        if elem.is_displayed():
                            print(f"  Found visible {selector}: '{elem.text}'")
                except Exception as e:
                    print(f"  Error checking {selector}: {e}")
            
            return True
            
        except Exception as e:
            print(f"❌ Debug failed: {e}")
            return False
    
    def cleanup(self):
        """Clean up resources"""
        try:
            if self.driver:
                self.driver.quit()
                print("✅ Browser closed")
        except:
            pass

def main():
    """Run extension UI debugger"""
    print("🔍 Extension UI Debugger")
    print("=" * 40)
    
    debugger = ExtensionUIDebugger()
    
    try:
        if not debugger.setup_browser():
            return 1
        
        if not debugger.debug_extension_ui():
            return 1
        
        print("\n✅ Debug completed successfully")
        print("Check the screenshot and HTML source files for details")
        return 0
        
    except Exception as e:
        print(f"❌ Debug error: {e}")
        return 1
    finally:
        debugger.cleanup()

if __name__ == "__main__":
    exit(main())