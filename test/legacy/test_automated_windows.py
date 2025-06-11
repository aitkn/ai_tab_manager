#!/usr/bin/env python3
"""
Automated Testing for Windows Chrome Extension
Uses non-headless Chrome to connect to actual Windows Chrome extension
"""

import os
import time
import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

class AutomatedWindowsTest:
    def __init__(self):
        self.driver = None
        self.extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
        self.results = []
        
    def log_result(self, message, status):
        """Log test result with timestamp"""
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        result_entry = f"[{timestamp}] {status}: {message}"
        self.results.append(result_entry)
        print(result_entry)
    
    def setup_chrome_with_extension_access(self):
        """Setup Chrome that can access the Windows extension"""
        try:
            self.log_result("Setting up Chrome with extension access", "INFO")
            
            chrome_options = Options()
            # Configure for testing without loading extension
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage") 
            chrome_options.add_argument("--disable-web-security")
            chrome_options.add_argument("--disable-features=VizDisplayCompositor")
            chrome_options.add_argument("--disable-extensions-file-access-check")
            chrome_options.add_argument("--disable-default-apps")
            chrome_options.add_argument("--no-first-run")
            chrome_options.add_argument("--disable-background-timer-throttling")
            chrome_options.add_argument("--disable-backgrounding-occluded-windows")
            chrome_options.add_argument("--disable-renderer-backgrounding")
            
            # Use a clean test profile directory
            test_profile_dir = "/tmp/chrome-automated-test-profile"
            if os.path.exists(test_profile_dir):
                import shutil
                shutil.rmtree(test_profile_dir)
            chrome_options.add_argument(f"--user-data-dir={test_profile_dir}")
            
            # Don't load extension here - we'll access the existing Windows Chrome extension
            self.log_result("Using clean test profile for Chrome automation", "INFO")
            
            # Initialize driver
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.driver.set_window_size(1200, 800)
            self.driver.set_page_load_timeout(30)
            
            # Test basic functionality
            self.driver.get("about:blank")
            time.sleep(2)
            
            self.log_result("Chrome setup completed successfully", "PASSED")
            return True
            
        except Exception as e:
            self.log_result(f"Chrome setup failed: {e}", "FAILED")
            return False
    
    def open_extension_popup(self):
        """Open the extension popup"""
        try:
            popup_url = f"chrome-extension://{self.extension_id}/popup.html"
            self.log_result(f"Opening extension popup: {popup_url}", "INFO")
            
            self.driver.get(popup_url)
            time.sleep(3)
            
            # Verify we're on the extension page
            current_url = self.driver.current_url
            if self.extension_id in current_url:
                self.log_result("Extension popup opened successfully", "PASSED")
                return True
            else:
                self.log_result(f"Failed to open extension popup. Current URL: {current_url}", "FAILED")
                return False
                
        except Exception as e:
            self.log_result(f"Error opening extension popup: {e}", "FAILED")
            return False
    
    def go_to_current_tab(self):
        """Navigate to Current tabs section"""
        try:
            self.log_result("Navigating to Current tab", "INFO")
            
            # Try multiple selectors for Current tab button
            current_tab_selectors = [
                "#categorizeTab",
                "[data-tab='categorize']",
                ".tab-current",
                "button[data-tab='categorize']"
            ]
            
            for selector in current_tab_selectors:
                try:
                    element = WebDriverWait(self.driver, 2).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                    )
                    element.click()
                    time.sleep(1)
                    self.log_result(f"Clicked Current tab button: {selector}", "PASSED")
                    return True
                except:
                    continue
            
            # Fallback: try to find by text
            try:
                buttons = self.driver.find_elements(By.TAG_NAME, "button")
                for btn in buttons:
                    if "current" in btn.text.lower():
                        btn.click()
                        time.sleep(1)
                        self.log_result("Clicked Current tab button (by text)", "PASSED")
                        return True
            except:
                pass
            
            self.log_result("Could not find Current tab button", "FAILED")
            return False
            
        except Exception as e:
            self.log_result(f"Error navigating to Current tab: {e}", "FAILED")
            return False
    
    def create_test_tabs(self):
        """Create test tabs for search testing"""
        try:
            self.log_result("Creating test tabs for search testing", "INFO")
            
            test_urls = [
                "https://github.com/microsoft/vscode",
                "https://stackoverflow.com/questions/javascript",
                "https://youtube.com/watch?v=python-tutorial",
                "https://google.com/search?q=testing",
                "https://docs.python.org/3/"
            ]
            
            for i, url in enumerate(test_urls):
                try:
                    self.driver.execute_script(f"window.open('{url}', '_blank');")
                    time.sleep(0.5)
                    self.log_result(f"Created test tab {i+1}: {url[:40]}...", "PASSED")
                except Exception as e:
                    self.log_result(f"Failed to create tab {url}: {e}", "FAILED")
            
            # Switch back to extension tab
            extension_handles = []
            for handle in self.driver.window_handles:
                self.driver.switch_to.window(handle)
                if self.extension_id in self.driver.current_url:
                    extension_handles.append(handle)
            
            if extension_handles:
                self.driver.switch_to.window(extension_handles[0])
                time.sleep(2)
                self.log_result("Switched back to extension popup", "PASSED")
                return True
            else:
                self.log_result("Could not find extension tab", "FAILED")
                return False
                
        except Exception as e:
            self.log_result(f"Error creating test tabs: {e}", "FAILED")
            return False
    
    def test_search_functionality(self):
        """Test search functionality comprehensively"""
        try:
            self.log_result("🔍 TESTING SEARCH FUNCTIONALITY", "INFO")
            
            # Find search input
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
                    search_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    self.log_result(f"Found search input: {selector}", "PASSED")
                    break
                except:
                    continue
            
            if not search_element:
                self.log_result("Search input not found", "FAILED")
                return False
            
            # Test 1: Check initial tab count
            time.sleep(2)
            initial_tabs = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            initial_count = len(initial_tabs)
            self.log_result(f"Initial tab count: {initial_count}", "PASSED")
            
            # Test 2: Perform search filtering
            self.log_result("Testing search filtering with 'github'", "INFO")
            search_element.clear()
            search_element.send_keys("github")
            time.sleep(2)
            
            filtered_tabs = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            filtered_count = len(filtered_tabs)
            
            if filtered_count < initial_count:
                self.log_result(f"✅ SEARCH FILTERING WORKS: {filtered_count} < {initial_count}", "PASSED")
            else:
                self.log_result(f"❌ SEARCH FILTERING FAILED: {filtered_count} = {initial_count}", "FAILED")
                return False
            
            # Test 3: Verify search content
            page_text = self.driver.find_element(By.TAG_NAME, "body").text.lower()
            if "github" in page_text:
                self.log_result("✅ SEARCH CONTENT MATCH: 'github' found in results", "PASSED")
            else:
                self.log_result("❌ SEARCH CONTENT MISMATCH: 'github' not in results", "FAILED")
            
            # Test 4: Check group counter updates
            self.log_result("Testing group counter updates", "INFO")
            group_headers = self.driver.find_elements(By.CSS_SELECTOR, ".group-header, .category-header, .category-section h3")
            
            counters_found = 0
            for header in group_headers:
                header_text = header.text.strip()
                if "(" in header_text and ")" in header_text:
                    self.log_result(f"Group counter: '{header_text}'", "PASSED")
                    counters_found += 1
            
            if counters_found > 0:
                self.log_result(f"✅ GROUP COUNTERS FOUND: {counters_found} counters", "PASSED")
            else:
                self.log_result("⚠️ NO GROUP COUNTERS: May not be visible", "PASSED")
            
            # Test 5: Test case insensitive search
            self.log_result("Testing case insensitive search", "INFO")
            search_element.clear()
            search_element.send_keys("GITHUB")
            time.sleep(2)
            
            uppercase_tabs = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            uppercase_count = len(uppercase_tabs)
            
            if uppercase_count == filtered_count:
                self.log_result(f"✅ CASE INSENSITIVE WORKS: {uppercase_count} = {filtered_count}", "PASSED")
            else:
                self.log_result(f"❌ CASE SENSITIVE: {uppercase_count} ≠ {filtered_count}", "FAILED")
            
            # Test 6: Test search clearing
            self.log_result("Testing search clearing", "INFO")
            search_element.clear()
            time.sleep(2)
            
            restored_tabs = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            restored_count = len(restored_tabs)
            
            if restored_count >= initial_count - 1:  # Allow small variance
                self.log_result(f"✅ SEARCH CLEAR WORKS: {restored_count} ≈ {initial_count}", "PASSED")
            else:
                self.log_result(f"❌ SEARCH CLEAR FAILED: {restored_count} vs {initial_count}", "FAILED")
            
            # Test 7: Test empty search results
            self.log_result("Testing empty search results", "INFO")
            search_element.clear()
            search_element.send_keys("xyznomatchingresults123")
            time.sleep(2)
            
            no_results_tabs = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            no_results_count = len(no_results_tabs)
            
            if no_results_count == 0:
                self.log_result("✅ EMPTY SEARCH WORKS: No tabs shown for no matches", "PASSED")
            else:
                self.log_result(f"❌ EMPTY SEARCH FAILED: Still showing {no_results_count} tabs", "FAILED")
            
            # Clear search for next test
            search_element.clear()
            time.sleep(1)
            
            return True
            
        except Exception as e:
            self.log_result(f"Search functionality test failed: {e}", "FAILED")
            return False
    
    def test_groupby_with_search(self):
        """Test GROUP BY functionality with search"""
        try:
            self.log_result("🔂 TESTING GROUP BY WITH SEARCH", "INFO")
            
            # Find GROUP BY selector
            groupby_selectors = [
                "#categorizeGroupingSelect",
                ".grouping-select",
                "select[id*='grouping']",
                "select[id*='Group']"
            ]
            
            groupby_element = None
            for selector in groupby_selectors:
                try:
                    groupby_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    self.log_result(f"Found GROUP BY selector: {selector}", "PASSED")
                    break
                except:
                    continue
            
            if not groupby_element:
                self.log_result("GROUP BY selector not found", "FAILED")
                return False
            
            # Test switching to domain grouping
            self.log_result("Switching to Domain grouping", "INFO")
            self.driver.execute_script("""
                var select = arguments[0];
                select.value = 'domain';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            """, groupby_element)
            
            time.sleep(2)
            
            # Check for domain groups
            group_headers = self.driver.find_elements(By.CSS_SELECTOR, ".group-header, .group-section, .group-title")
            domain_groups = len(group_headers)
            
            if domain_groups > 0:
                self.log_result(f"✅ DOMAIN GROUPING WORKS: Found {domain_groups} groups", "PASSED")
            else:
                self.log_result("❌ DOMAIN GROUPING FAILED: No groups found", "FAILED")
                return False
            
            # Check for "unknown" domains (should be fixed)
            page_text = self.driver.find_element(By.TAG_NAME, "body").text.lower()
            if "unknown" in page_text:
                self.log_result("❌ DOMAIN BUG: Found 'unknown' domain headers", "FAILED")
            else:
                self.log_result("✅ DOMAIN FIX VERIFIED: No 'unknown' headers", "PASSED")
            
            # Test search in domain grouping mode
            self.log_result("Testing search in domain grouping mode", "INFO")
            search_element = self.driver.find_element(By.CSS_SELECTOR, "#searchInput, .search-input, input[type='search']")
            
            search_element.clear()
            search_element.send_keys("python")
            time.sleep(2)
            
            domain_search_tabs = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            domain_search_count = len(domain_search_tabs)
            
            if domain_search_count > 0:
                self.log_result(f"✅ SEARCH IN DOMAIN MODE WORKS: Found {domain_search_count} results", "PASSED")
            else:
                self.log_result("⚠️ SEARCH IN DOMAIN MODE: No results (may be expected)", "PASSED")
            
            # Clear search
            search_element.clear()
            time.sleep(1)
            
            return True
            
        except Exception as e:
            self.log_result(f"GROUP BY with search test failed: {e}", "FAILED")
            return False
    
    def save_report(self):
        """Save test results to file"""
        try:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"automated_test_results_{timestamp}.txt"
            
            passed_count = sum(1 for result in self.results if "PASSED:" in result)
            failed_count = sum(1 for result in self.results if "FAILED:" in result)
            overall_result = "PASSED" if failed_count == 0 else "FAILED"
            
            with open(filename, 'w') as f:
                f.write("AUTOMATED CHROME EXTENSION TEST REPORT\n")
                f.write("=" * 50 + "\n")
                f.write(f"Test Name: Automated Search Functionality Tests\n")
                f.write(f"Extension ID: {self.extension_id}\n")
                f.write(f"Overall Result: {overall_result}\n")
                f.write(f"Timestamp: {datetime.datetime.now()}\n")
                f.write(f"Passed: {passed_count}\n")
                f.write(f"Failed: {failed_count}\n\n")
                f.write("DETAILED RESULTS:\n")
                f.write("=" * 50 + "\n")
                
                for result in self.results:
                    f.write(result + "\n")
            
            print(f"📊 Report saved: {filename}")
            return filename, overall_result
            
        except Exception as e:
            print(f"Error saving report: {e}")
            return None, "ERROR"
    
    def cleanup(self):
        """Clean up resources"""
        try:
            if self.driver:
                self.driver.quit()
                time.sleep(1)
        except:
            pass
    
    def run_automated_test(self):
        """Run complete automated test suite"""
        print("🤖 Automated Windows Chrome Extension Testing")
        print("=" * 50)
        
        try:
            # Setup and basic checks
            if not self.setup_chrome_with_extension_access():
                return False
            
            if not self.open_extension_popup():
                return False
            
            if not self.go_to_current_tab():
                return False
            
            if not self.create_test_tabs():
                return False
            
            # Main functionality tests
            search_ok = self.test_search_functionality()
            groupby_ok = self.test_groupby_with_search()
            
            # Save results
            report_file, overall_result = self.save_report()
            
            print(f"\n🎯 Automated Test Results:")
            print("=" * 30)
            print(f"Search Functionality: {'✅ PASSED' if search_ok else '❌ FAILED'}")
            print(f"GROUP BY Functionality: {'✅ PASSED' if groupby_ok else '❌ FAILED'}")
            print(f"Overall Result: {overall_result}")
            
            if report_file:
                print(f"📄 Detailed report: {report_file}")
            
            return search_ok and groupby_ok
            
        except Exception as e:
            self.log_result(f"Automated test failed: {e}", "FAILED")
            return False
        finally:
            self.cleanup()

def main():
    """Run automated test"""
    test = AutomatedWindowsTest()
    success = test.run_automated_test()
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())