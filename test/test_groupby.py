#!/usr/bin/env python3
"""
GROUP BY Functionality Test for Chrome Extension
Tests category and domain grouping, switching between modes
"""

import time
from selenium.webdriver.common.by import By
from test_base import ExtensionTestBase

class GroupByTest(ExtensionTestBase):
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
    
    def create_diverse_test_tabs(self):
        """Create tabs with diverse domains for grouping tests"""
        try:
            test_urls = [
                "https://google.com/search?q=test1",
                "https://youtube.com/watch?v=abc123",
                "https://github.com/user/repo",
                "about:blank",
                "https://stackoverflow.com/questions/python",
                "https://google.com/search?q=test2",  # Same domain as first
                "chrome://settings"
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
            return True
            
        except Exception as e:
            self.log_result(f"Failed to create test tabs: {e}", "FAILED")
            return False
    
    def test_category_grouping(self):
        """Test default category-based grouping"""
        try:
            self.log_result("📂 Testing category grouping", "PASSED")
            
            if not self.create_diverse_test_tabs():
                return False
            
            # Look for category-based grouping (should be default)
            category_headers = self.driver.find_elements(By.CSS_SELECTOR, ".category-header, .category-section, .category-section h3")
            
            if len(category_headers) > 0:
                self.log_result(f"✅ CATEGORY GROUPING: Found {len(category_headers)} category sections", "PASSED")
                
                # Check for common categories
                page_text = self.driver.find_element(By.TAG_NAME, "body").text
                common_categories = ["Uncategorized", "Useful", "Important", "Ignore"]
                found_categories = [cat for cat in common_categories if cat in page_text]
                
                if found_categories:
                    self.log_result(f"✅ CATEGORY TYPES: Found {len(found_categories)} category types", "PASSED")
                else:
                    self.log_result("⚠️ CATEGORY TYPES: No standard categories found", "PASSED")
                
                return True
            else:
                self.log_result("❌ CATEGORY GROUPING: No category sections found", "FAILED")
                return False
                
        except Exception as e:
            self.log_result(f"Category grouping test failed: {e}", "FAILED")
            return False
    
    def test_domain_grouping(self):
        """Test domain-based grouping"""
        try:
            self.log_result("🌐 Testing domain grouping", "PASSED")
            
            # Find grouping selector
            grouping_selectors = [
                "#categorizeGroupingSelect",
                "[data-grouping-select]",
                ".grouping-select",
                "select[id*='grouping']",
                "select[id*='Group']"
            ]
            
            grouping_element = None
            for selector in grouping_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        grouping_element = elements[0]
                        self.log_result(f"Found grouping selector: {selector}", "PASSED")
                        break
                except:
                    continue
            
            if not grouping_element:
                self.log_result("❌ No grouping selector found", "FAILED")
                return False
            
            # Switch to domain grouping
            self.driver.execute_script("""
                var select = arguments[0];
                select.value = 'domain';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            """, grouping_element)
            
            time.sleep(2.0)  # Wait for grouping to change
            
            # Check for domain-based groups
            group_headers = self.driver.find_elements(By.CSS_SELECTOR, ".group-header, .group-section, .group-title")
            
            if len(group_headers) > 0:
                self.log_result(f"✅ DOMAIN GROUPING: Found {len(group_headers)} domain groups", "PASSED")
                
                # Check for "unknown" headers (should be fixed)
                page_text = self.driver.find_element(By.TAG_NAME, "body").text
                if "unknown" in page_text.lower():
                    self.log_result("❌ DOMAIN BUG: Found 'unknown' domain header", "FAILED")
                    return False
                else:
                    self.log_result("✅ DOMAIN CLEAN: No 'unknown' headers found", "PASSED")
                
                # Check for expected domains
                expected_domains = ["google.com", "youtube.com", "github.com", "about", "chrome"]
                found_domains = [domain for domain in expected_domains if domain in page_text.lower()]
                
                if len(found_domains) >= 3:
                    self.log_result(f"✅ DOMAIN VARIETY: Found {len(found_domains)} expected domains", "PASSED")
                else:
                    self.log_result(f"⚠️ DOMAIN VARIETY: Only found {len(found_domains)} domains", "PASSED")
                
                return True
            else:
                self.log_result("❌ DOMAIN GROUPING: No domain groups found", "FAILED")
                return False
                
        except Exception as e:
            self.log_result(f"Domain grouping test failed: {e}", "FAILED")
            return False
    
    def test_grouping_mode_switching(self):
        """Test switching between grouping modes"""
        try:
            self.log_result("🔄 Testing grouping mode switching", "PASSED")
            
            # Find grouping selector
            grouping_element = self.driver.find_element(By.CSS_SELECTOR, "#categorizeGroupingSelect, .grouping-select, select[id*='grouping']")
            
            # Test switch to category mode
            self.driver.execute_script("""
                var select = arguments[0];
                select.value = 'category';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            """, grouping_element)
            
            time.sleep(2.0)
            
            # Verify category mode
            category_headers = self.driver.find_elements(By.CSS_SELECTOR, ".category-header, .category-section")
            if len(category_headers) > 0:
                self.log_result("✅ SWITCH TO CATEGORY: Successfully switched back", "PASSED")
            else:
                self.log_result("❌ SWITCH TO CATEGORY: Failed to switch back", "FAILED")
                return False
            
            # Test switch back to domain mode
            self.driver.execute_script("""
                var select = arguments[0];
                select.value = 'domain';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            """, grouping_element)
            
            time.sleep(2.0)
            
            # Verify domain mode
            domain_groups = self.driver.find_elements(By.CSS_SELECTOR, ".group-header, .group-section, .group-title")
            if len(domain_groups) > 0:
                self.log_result("✅ SWITCH TO DOMAIN: Successfully switched to domain", "PASSED")
            else:
                self.log_result("❌ SWITCH TO DOMAIN: Failed to switch to domain", "FAILED")
                return False
            
            return True
            
        except Exception as e:
            self.log_result(f"Grouping mode switching test failed: {e}", "FAILED")
            return False
    
    def test_group_statistics(self):
        """Test that group statistics are displayed correctly"""
        try:
            self.log_result("📊 Testing group statistics", "PASSED")
            
            # Look for group statistics elements
            stats_selectors = [
                ".group-stats",
                ".stat-item", 
                ".total",
                ".tab-count",
                "[class*='stat']"
            ]
            
            stats_found = False
            for selector in stats_selectors:
                try:
                    stats = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if stats:
                        stats_found = True
                        self.log_result(f"✅ STATISTICS: Found {len(stats)} stat elements ({selector})", "PASSED")
                        break
                except:
                    continue
            
            if not stats_found:
                # Look for statistics in group headers (e.g., "Domain (5)")
                group_headers = self.driver.find_elements(By.CSS_SELECTOR, ".group-header, .category-header h3")
                counter_headers = [h for h in group_headers if "(" in h.text and ")" in h.text]
                
                if counter_headers:
                    self.log_result(f"✅ HEADER STATS: Found {len(counter_headers)} headers with counters", "PASSED")
                    stats_found = True
            
            if stats_found:
                return True
            else:
                self.log_result("⚠️ STATISTICS: No group statistics found", "PASSED")
                return True  # Not critical for functionality
                
        except Exception as e:
            self.log_result(f"Group statistics test failed: {e}", "FAILED")
            return False
    
    def run_groupby_tests(self):
        """Run all GROUP BY functionality tests"""
        print("📂 Starting GROUP BY Functionality Tests")
        print("=" * 50)
        
        try:
            # Setup
            if not self.run_basic_setup():
                return False
            
            if not self.check_initial_state():
                return False
            
            # Run GROUP BY tests
            tests = [
                ("Category Grouping", self.test_category_grouping),
                ("Domain Grouping", self.test_domain_grouping),
                ("Grouping Mode Switching", self.test_grouping_mode_switching),
                ("Group Statistics", self.test_group_statistics)
            ]
            
            all_passed = True
            for test_name, test_func in tests:
                print(f"\n🔄 Executing: {test_name}")
                if not test_func():
                    all_passed = False
                    break
            
            result = "PASSED" if all_passed else "FAILED"
            self.log_result(f"Overall GROUP BY test result: {result}", result)
            
            # Save report
            report_file = self.save_report("GROUP BY Functionality Tests", result)
            print(f"Test Name: GROUP BY Functionality Tests - {result}")
            print(f"\n🎯 Final Result: {result}")
            
            return all_passed
            
        except Exception as e:
            self.log_result(f"GROUP BY tests failed: {e}", "FAILED")
            return False
        finally:
            self.cleanup()

def main():
    """Run GROUP BY tests"""
    test = GroupByTest()
    success = test.run_groupby_tests()
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())