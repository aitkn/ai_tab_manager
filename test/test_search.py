#!/usr/bin/env python3
"""
Search Functionality Test for Chrome Extension
Tests search filtering, group counter updates, and empty group handling
"""

import time
import re
from selenium.webdriver.common.by import By
from test_base import ExtensionTestBase

class SearchTest(ExtensionTestBase):
    def __init__(self):
        super().__init__()
    
    def check_initial_state(self):
        """Check initial state before testing"""
        try:
            time.sleep(1)
            
            # Check for basic UI elements
            tab_items = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            
            self.log_result(f"Initial state: Found {len(tab_items)} tab items", "PASSED")
            return True
            
        except Exception as e:
            self.log_result(f"Failed to check initial state: {e}", "FAILED")
            return False
    
    def test_search_filtering(self):
        """Test basic search filtering functionality"""
        try:
            self.log_result("🔍 Testing search filtering", "PASSED")
            
            # Create diverse test tabs
            test_urls = [
                "https://github.com/microsoft/vscode",
                "https://stackoverflow.com/questions/javascript",
                "https://docs.google.com/spreadsheet",
                "https://youtube.com/watch?v=python-tutorial",
                "https://reddit.com/r/programming"
            ]
            
            # Open test tabs
            for i, url in enumerate(test_urls):
                self.driver.execute_script(f"window.open('{url}', '_blank');")
                time.sleep(0.3)
                self.log_result(f"Created test tab {i+1}: {url[:40]}...", "PASSED")
            
            # Switch back to extension
            if not self.switch_back_to_extension():
                return False
            
            time.sleep(2.0)  # Wait for tabs to be processed
            
            # Get initial counts before search
            initial_tab_items = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            initial_count = len(initial_tab_items)
            self.log_result(f"Before search: {initial_count} tabs", "PASSED")
            
            # Find search input
            search_selectors = [
                "#searchInput",
                "[data-search]",
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
                        self.log_result(f"Found search input: {selector}", "PASSED")
                        break
                except:
                    continue
            
            if not search_element:
                self.log_result("❌ No search input found", "FAILED")
                return False
            
            # Test search for "github"
            search_element.clear()
            search_element.send_keys("github")
            time.sleep(1.5)  # Wait for filtering
            
            # Check filtered results
            filtered_tab_items = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            filtered_count = len(filtered_tab_items)
            
            if filtered_count < initial_count:
                self.log_result(f"✅ FILTERING WORKS: {filtered_count} tabs (was {initial_count})", "PASSED")
                
                # Verify results contain search term
                page_text = self.driver.find_element(By.TAG_NAME, "body").text.lower()
                if "github" in page_text:
                    self.log_result("✅ CONTENT MATCH: Search results show 'github'", "PASSED")
                else:
                    self.log_result("❌ CONTENT MATCH: Search results missing 'github'", "FAILED")
                    return False
            else:
                self.log_result(f"❌ NO FILTERING: Count unchanged ({filtered_count})", "FAILED")
                return False
            
            # Clear search and verify restoration
            search_element.clear()
            time.sleep(1.5)
            
            restored_tab_items = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            restored_count = len(restored_tab_items)
            
            if restored_count >= initial_count - 2:  # Allow small variance
                self.log_result(f"✅ RESTORE WORKS: {restored_count} tabs restored", "PASSED")
            else:
                self.log_result(f"❌ RESTORE FAILED: Only {restored_count} tabs", "FAILED")
                return False
            
            return True
            
        except Exception as e:
            self.log_result(f"Search filtering test failed: {e}", "FAILED")
            return False
    
    def test_group_counter_updates(self):
        """Test that group counters update correctly during search"""
        try:
            self.log_result("🔢 Testing group counter updates", "PASSED")
            
            # Find search input
            search_element = self.driver.find_element(By.CSS_SELECTOR, "#searchInput, .search-input, input[type='search']")
            
            # Get initial group counters
            initial_headers = self.driver.find_elements(By.CSS_SELECTOR, ".group-header, .category-header, .category-section h3")
            initial_counters = []
            
            for header in initial_headers:
                header_text = header.text.strip()
                if "(" in header_text and ")" in header_text:
                    match = re.search(r'\((\d+)\)', header_text)
                    if match:
                        initial_counters.append(int(match.group(1)))
            
            initial_total = sum(initial_counters)
            self.log_result(f"Initial group counter total: {initial_total}", "PASSED")
            
            # Perform search
            search_element.clear()
            search_element.send_keys("python")
            time.sleep(1.5)
            
            # Check updated group counters
            updated_headers = self.driver.find_elements(By.CSS_SELECTOR, ".group-header, .category-header, .category-section h3")
            updated_counters = []
            
            for header in updated_headers:
                header_text = header.text.strip()
                if "(" in header_text and ")" in header_text:
                    match = re.search(r'\((\d+)\)', header_text)
                    if match:
                        updated_counters.append(int(match.group(1)))
                        self.log_result(f"Group counter: '{header_text}'", "PASSED")
            
            updated_total = sum(updated_counters)
            
            if updated_total < initial_total:
                self.log_result(f"✅ COUNTERS UPDATED: {updated_total} (was {initial_total})", "PASSED")
            else:
                self.log_result(f"❌ COUNTERS NOT UPDATED: Still {updated_total}", "FAILED")
                return False
            
            # Clear search
            search_element.clear()
            time.sleep(1.0)
            
            return True
            
        except Exception as e:
            self.log_result(f"Group counter test failed: {e}", "FAILED")
            return False
    
    def test_empty_group_handling(self):
        """Test that empty groups are hidden during search"""
        try:
            self.log_result("🗂️ Testing empty group handling", "PASSED")
            
            # Find search input
            search_element = self.driver.find_element(By.CSS_SELECTOR, "#searchInput, .search-input, input[type='search']")
            
            # Search for something very specific that should limit results
            search_element.clear()
            search_element.send_keys("veryrareunlikelysearchterm12345")
            time.sleep(1.5)
            
            # Check if any groups are still visible
            visible_groups = self.driver.find_elements(By.CSS_SELECTOR, ".group-header, .category-header, .category-section h3")
            
            # Check if any visible groups have (0) count
            zero_count_groups = []
            for group in visible_groups:
                group_text = group.text.strip()
                if "(0)" in group_text:
                    zero_count_groups.append(group_text)
            
            if len(zero_count_groups) == 0:
                self.log_result("✅ EMPTY GROUPS HIDDEN: No (0) count groups visible", "PASSED")
            else:
                self.log_result(f"❌ EMPTY GROUPS VISIBLE: Found {len(zero_count_groups)} groups with (0)", "FAILED")
                for group in zero_count_groups[:3]:  # Show first 3
                    self.log_result(f"  Empty group: {group}", "FAILED")
            
            # Clear search
            search_element.clear()
            time.sleep(1.0)
            
            return len(zero_count_groups) == 0
            
        except Exception as e:
            self.log_result(f"Empty group test failed: {e}", "FAILED")
            return False
    
    def test_case_insensitive_search(self):
        """Test that search is case insensitive"""
        try:
            self.log_result("🔤 Testing case insensitive search", "PASSED")
            
            # Find search input
            search_element = self.driver.find_element(By.CSS_SELECTOR, "#searchInput, .search-input, input[type='search']")
            
            # Test lowercase search
            search_element.clear()
            search_element.send_keys("github")
            time.sleep(1.5)
            
            lowercase_items = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            lowercase_count = len(lowercase_items)
            
            # Test uppercase search
            search_element.clear()
            search_element.send_keys("GITHUB")
            time.sleep(1.5)
            
            uppercase_items = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item, .tab-title")
            uppercase_count = len(uppercase_items)
            
            if lowercase_count == uppercase_count and lowercase_count > 0:
                self.log_result(f"✅ CASE INSENSITIVE: Both searches found {lowercase_count} results", "PASSED")
            else:
                self.log_result(f"❌ CASE SENSITIVE: lowercase={lowercase_count}, uppercase={uppercase_count}", "FAILED")
                return False
            
            # Clear search
            search_element.clear()
            time.sleep(1.0)
            
            return True
            
        except Exception as e:
            self.log_result(f"Case insensitive test failed: {e}", "FAILED")
            return False
    
    def run_search_tests(self):
        """Run all search functionality tests"""
        print("🔍 Starting Search Functionality Tests")
        print("=" * 50)
        
        try:
            # Setup
            if not self.run_basic_setup():
                return False
            
            if not self.check_initial_state():
                return False
            
            # Run search tests
            tests = [
                ("Search Filtering", self.test_search_filtering),
                ("Group Counter Updates", self.test_group_counter_updates),
                ("Empty Group Handling", self.test_empty_group_handling),
                ("Case Insensitive Search", self.test_case_insensitive_search)
            ]
            
            all_passed = True
            for test_name, test_func in tests:
                print(f"\n🔄 Executing: {test_name}")
                if not test_func():
                    all_passed = False
                    break
            
            result = "PASSED" if all_passed else "FAILED"
            self.log_result(f"Overall search test result: {result}", result)
            
            # Save report
            report_file = self.save_report("Search Functionality Tests", result)
            print(f"Test Name: Search Functionality Tests - {result}")
            print(f"\n🎯 Final Result: {result}")
            
            return all_passed
            
        except Exception as e:
            self.log_result(f"Search tests failed: {e}", "FAILED")
            return False
        finally:
            self.cleanup()

def main():
    """Run search tests"""
    test = SearchTest()
    success = test.run_search_tests()
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())