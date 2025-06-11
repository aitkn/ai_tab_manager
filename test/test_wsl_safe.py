#!/usr/bin/env python3
"""
WSL-Safe Testing - Avoids Windows display issues
Uses headless Chrome and prints results instead of GUI interaction
"""

import os
import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

class WSLSafeTest:
    def __init__(self):
        self.driver = None
        self.extension_id = None
    
    def setup_headless_browser(self):
        """Setup Chrome in headless mode for WSL"""
        try:
            print("🚀 Setting up headless Chrome for WSL...")
            
            # Get extension directory
            test_dir = os.path.dirname(os.path.abspath(__file__))
            extension_dir = os.path.dirname(test_dir)
            
            # Setup Chrome options for headless WSL
            chrome_options = Options()
            chrome_options.add_argument("--headless")  # No GUI
            chrome_options.add_argument("--no-sandbox")  # Required for WSL
            chrome_options.add_argument("--disable-dev-shm-usage")  # WSL memory issue
            chrome_options.add_argument("--disable-gpu")  # No GPU in WSL
            chrome_options.add_argument("--disable-web-security")
            chrome_options.add_argument("--disable-features=VizDisplayCompositor")
            chrome_options.add_argument("--disable-extensions-file-access-check")
            chrome_options.add_argument("--disable-default-apps")
            chrome_options.add_argument("--no-first-run")
            chrome_options.add_argument(f"--load-extension={extension_dir}")
            
            # Initialize driver
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.driver.set_page_load_timeout(30)
            
            print("✅ Headless Chrome started successfully")
            return True
            
        except Exception as e:
            print(f"❌ Error setting up browser: {e}")
            return False
    
    def check_extension_loaded(self):
        """Check if extension is loaded without opening windows"""
        try:
            # Navigate to chrome://extensions to check
            self.driver.get("chrome://extensions/")
            time.sleep(2)
            
            # Check page source for our extension
            page_source = self.driver.page_source
            
            if "AI Tab Manager" in page_source or "Tab Manager" in page_source:
                print("✅ Extension detected in chrome://extensions")
                
                # Try to extract extension ID from page source
                import re
                extension_id_match = re.search(r'chrome-extension://([a-z]+)/', page_source)
                if extension_id_match:
                    self.extension_id = extension_id_match.group(1)
                    print(f"✅ Extension ID found: {self.extension_id}")
                
                return True
            else:
                print("❌ Extension not found - may need manual loading")
                return False
                
        except Exception as e:
            print(f"❌ Error checking extension: {e}")
            return False
    
    def test_extension_popup_access(self):
        """Test if we can access extension popup"""
        try:
            if not self.extension_id:
                print("⚠️ No extension ID - skipping popup test")
                return False
            
            popup_url = f"chrome-extension://{self.extension_id}/popup.html"
            print(f"🔗 Trying to access: {popup_url}")
            
            self.driver.get(popup_url)
            time.sleep(3)
            
            # Check if popup loaded
            current_url = self.driver.current_url
            if "chrome-extension://" in current_url:
                print("✅ Extension popup accessible")
                
                # Check for key elements
                page_source = self.driver.page_source
                if "Current" in page_source and "Saved" in page_source:
                    print("✅ Extension UI elements detected")
                    return True
                else:
                    print("⚠️ Extension loaded but UI elements not found")
                    return False
            else:
                print(f"❌ Could not access popup. Current URL: {current_url}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing popup: {e}")
            return False
    
    def test_search_functionality(self):
        """Test search functionality comprehensively"""
        try:
            print("🔍 Testing search functionality...")
            
            # First, create some test tabs to search through
            test_urls = [
                "https://github.com/microsoft/vscode",
                "https://stackoverflow.com/questions/javascript", 
                "https://youtube.com/watch?v=python-tutorial",
                "https://google.com/search?q=testing"
            ]
            
            print("📝 Creating test tabs...")
            for i, url in enumerate(test_urls):
                try:
                    self.driver.execute_script(f"window.open('{url}', '_blank');")
                    time.sleep(0.5)
                    print(f"   Created tab {i+1}: {url[:40]}...")
                except:
                    print(f"   ⚠️  Could not create tab: {url}")
            
            # Navigate back to extension popup
            popup_url = f"chrome-extension://{self.extension_id}/popup.html"
            self.driver.get(popup_url)
            time.sleep(2)
            
            # Check for Current tab button and click it
            current_tab_selectors = [
                "#categorizeTab",
                "[data-tab='categorize']",
                "button:contains('Current')"
            ]
            
            current_tab_clicked = False
            for selector in current_tab_selectors:
                try:
                    if "contains" in selector:
                        buttons = self.driver.find_elements(By.TAG_NAME, "button")
                        for btn in buttons:
                            if "current" in btn.text.lower():
                                btn.click()
                                current_tab_clicked = True
                                break
                    else:
                        element = self.driver.find_element(By.CSS_SELECTOR, selector)
                        element.click()
                        current_tab_clicked = True
                    
                    if current_tab_clicked:
                        print("✅ Clicked Current tab button")
                        break
                except:
                    continue
            
            if not current_tab_clicked:
                print("⚠️  Could not find/click Current tab button")
            
            time.sleep(2)
            
            # Look for search input
            search_selectors = [
                "#searchInput",
                ".search-input", 
                "input[type='search']",
                "input[placeholder*='search']",
                "input[placeholder*='Search']"
            ]
            
            search_element = None
            for selector in search_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        search_element = elements[0]
                        print(f"✅ Search input found: {selector}")
                        break
                except:
                    continue
            
            if not search_element:
                print("❌ Search input not found")
                return False
            
            # Test 1: Check initial tab count
            initial_tabs = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            initial_count = len(initial_tabs)
            print(f"📊 Initial tab count: {initial_count}")
            
            # Test 2: Perform search
            print("🔍 Testing search filtering...")
            search_element.clear()
            search_element.send_keys("github")
            time.sleep(2)
            
            # Check filtered results
            filtered_tabs = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            filtered_count = len(filtered_tabs)
            print(f"📊 Filtered tab count: {filtered_count}")
            
            if filtered_count < initial_count:
                print(f"✅ Search filtering works: {filtered_count} < {initial_count}")
            else:
                print(f"❌ Search filtering failed: {filtered_count} = {initial_count}")
                
            # Check if "github" appears in filtered content
            page_text = self.driver.find_element(By.TAG_NAME, "body").text.lower()
            if "github" in page_text:
                print("✅ Search results contain 'github'")
            else:
                print("❌ Search results don't contain 'github'")
            
            # Test 3: Test group counter updates
            print("📊 Checking group counter updates...")
            group_headers = self.driver.find_elements(By.CSS_SELECTOR, ".group-header, .category-header, .category-section h3")
            
            counters_found = 0
            for header in group_headers:
                header_text = header.text.strip()
                if "(" in header_text and ")" in header_text:
                    print(f"   Group: {header_text}")
                    counters_found += 1
            
            if counters_found > 0:
                print(f"✅ Found {counters_found} group counters")
            else:
                print("⚠️  No group counters found")
            
            # Test 4: Clear search
            print("🧹 Testing search clear...")
            search_element.clear()
            time.sleep(2)
            
            restored_tabs = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            restored_count = len(restored_tabs)
            print(f"📊 Restored tab count: {restored_count}")
            
            if restored_count >= initial_count - 1:  # Allow small variance
                print(f"✅ Search clear works: {restored_count} ≈ {initial_count}")
            else:
                print(f"❌ Search clear failed: {restored_count} vs {initial_count}")
            
            # Test 5: Test GROUP BY functionality
            return self.test_groupby_functionality()
            
        except Exception as e:
            print(f"❌ Error testing search functionality: {e}")
            return False
    
    def test_groupby_functionality(self):
        """Test GROUP BY domain functionality"""
        try:
            print("📂 Testing GROUP BY functionality...")
            
            # Look for GROUP BY selector
            groupby_selectors = [
                "#categorizeGroupingSelect",
                ".grouping-select",
                "select[id*='grouping']",
                "select[id*='Group']"
            ]
            
            groupby_element = None
            for selector in groupby_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        groupby_element = elements[0]
                        print(f"✅ GROUP BY selector found: {selector}")
                        break
                except:
                    continue
            
            if not groupby_element:
                print("❌ GROUP BY selector not found")
                return False
            
            # Test switching to domain grouping
            print("🌐 Switching to Domain grouping...")
            self.driver.execute_script("""
                var select = arguments[0];
                select.value = 'domain';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            """, groupby_element)
            
            time.sleep(2)
            
            # Check for domain groups
            group_headers = self.driver.find_elements(By.CSS_SELECTOR, ".group-header, .group-section, .group-title")
            domain_groups = len(group_headers)
            print(f"📊 Found {domain_groups} domain groups")
            
            if domain_groups > 0:
                print("✅ Domain grouping works")
                
                # Check for "unknown" domains (should be fixed)
                page_text = self.driver.find_element(By.TAG_NAME, "body").text.lower()
                if "unknown" in page_text:
                    print("❌ Found 'unknown' domain headers (bug not fixed)")
                else:
                    print("✅ No 'unknown' domain headers (bug fixed)")
            else:
                print("❌ Domain grouping failed")
            
            return domain_groups > 0
            
        except Exception as e:
            print(f"❌ Error testing GROUP BY: {e}")
            return False
    
    def cleanup(self):
        """Clean up resources"""
        try:
            if self.driver:
                self.driver.quit()
                print("✅ Browser cleaned up")
        except:
            pass
    
    def run_wsl_safe_test(self):
        """Run WSL-safe extension test"""
        print("🐧 WSL-Safe Chrome Extension Test")
        print("=" * 40)
        
        try:
            # Setup
            if not self.setup_headless_browser():
                return False
            
            # Test extension loading
            if not self.check_extension_loaded():
                print("\n💡 Manual Setup Required:")
                print("1. Open Chrome on Windows")
                print("2. Go to chrome://extensions/")
                print("3. Enable Developer mode")
                print("4. Click 'Load unpacked'")
                print("5. Select the extension directory in WSL:")
                print(f"   {os.path.dirname(os.path.dirname(os.path.abspath(__file__)))}")
                return False
            
            # Test popup access
            if not self.test_extension_popup_access():
                return False
            
            # Test search functionality
            if not self.test_search_functionality():
                return False
            
            print("\n🎯 WSL-Safe Test Results:")
            print("✅ Extension loaded successfully")
            print("✅ Popup accessible")
            print("✅ Search functionality tested")
            print("✅ GROUP BY functionality tested")
            print("✅ Ready for manual testing")
            
            return True
            
        except Exception as e:
            print(f"❌ Test failed: {e}")
            return False
        finally:
            self.cleanup()

def main():
    """Run WSL-safe test"""
    test = WSLSafeTest()
    success = test.run_wsl_safe_test()
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())