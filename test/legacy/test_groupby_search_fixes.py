#!/usr/bin/env python3
"""
TDD Test to Verify GROUP BY + Search Fixes
Tests that the fixes implemented in search-filter.js resolve the issues:
1. Group header counters now update correctly when search filters tabs
2. Empty groups are hidden when search filters all tabs in a group
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
from test_base import ExtensionTestBase

class GroupBySearchFixesTest(ExtensionTestBase):
    def __init__(self):
        super().__init__()
        self.test_name = "GROUP BY + Search Fixes Verification"
        self.extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"  # Known Windows Chrome extension
    
    def setup_windows_chrome(self):
        """Setup Chrome to connect to Windows Chrome Default profile with extension"""
        try:
            self.log_result("Connecting to Windows Chrome remote debugging...", "INFO")
            
            chrome_options = Options()
            chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
            
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            
            self.log_result("Connected to Windows Chrome session", "PASSED")
            return True
            
        except Exception as e:
            self.log_result(f"Remote debugging connection failed: {e}", "FAILED")
            return False
    
    def refresh_extension_popup(self):
        """Refresh the extension popup to ensure clean state"""
        try:
            self.log_result("🔄 Refreshing extension popup for clean state", "INFO")
            self.driver.refresh()
            time.sleep(3)  # Wait for popup to reload
            self.log_result("✅ Extension popup refreshed", "PASSED")
            return True
        except Exception as e:
            self.log_result(f"Failed to refresh popup: {e}", "FAILED")
            return False
    
    def create_test_tabs(self, urls):
        """Create test tabs with specific URLs"""
        try:
            self.log_result(f"Creating {len(urls)} test tabs", "INFO")
            
            # Store current window handle (extension window)
            original_window = self.driver.current_window_handle
            
            for i, url in enumerate(urls):
                try:
                    # Create tab in current window instead of new window
                    self.driver.execute_script(f"""
                        window.open('{url}', '_blank');
                    """)
                    time.sleep(0.5)  # Small delay between tabs
                    self.log_result(f"Created tab {i+1}: {url[:50]}...", "PASSED")
                except Exception as e:
                    self.log_result(f"Failed to create tab {url}: {e}", "FAILED")
            
            # Switch back to original extension window
            try:
                self.driver.switch_to.window(original_window)
                time.sleep(0.3)
                self.log_result("Switched back to extension tab", "PASSED")
                return True
            except Exception as e:
                self.log_result(f"Failed to switch back to extension: {e}", "FAILED")
                
                # Fallback: find extension tab
                for handle in self.driver.window_handles:
                    try:
                        self.driver.switch_to.window(handle)
                        if self.extension_id in self.driver.current_url:
                            self.log_result("Found extension tab (fallback)", "PASSED")
                            return True
                    except:
                        continue
                
                self.log_result("Could not find extension tab", "FAILED")
                return False
            
        except Exception as e:
            self.log_result(f"Error creating test tabs: {e}", "FAILED")
            return False
    
    def test_groupby_search_fixes(self):
        """Test that GROUP BY + search fixes work correctly"""
        try:
            self.log_result("🔧 Testing GROUP BY + Search FIXES", "INFO")
            
            # Step 1: Refresh popup for clean state
            if not self.refresh_extension_popup():
                return False
            
            # Step 2: Create test tabs with different domains
            test_urls = [
                "https://github.com/microsoft/vscode",      # github.com domain
                "https://github.com/nodejs/node",           # github.com domain  
                "https://stackoverflow.com/questions/javascript",  # stackoverflow.com domain
                "https://stackoverflow.com/questions/python",      # stackoverflow.com domain
                "https://docs.python.org/3/tutorial/",      # docs.python.org domain
                "https://youtube.com/watch?v=test1",         # youtube.com domain
            ]
            
            if not self.create_test_tabs(test_urls):
                return False
            
            # Step 3: Navigate to Current tab
            if not self.go_to_current_tabs():
                return False
            
            time.sleep(0.5)  # Wait for tabs to load
            
            # Step 4: Switch to Domain grouping
            self.log_result("Setting GROUP BY to Domain", "INFO")
            if not self.set_groupby_mode("domain"):
                return False
            
            time.sleep(0.5)  # Wait for grouping to apply
            
            # Step 5: Get initial state
            initial_groups = self.get_group_headers_with_counts()
            initial_tabs = self.get_visible_tabs_with_content()
            
            self.log_result(f"Initial state: {len(initial_groups)} groups, {len(initial_tabs)} tabs", "INFO")
            for group in initial_groups:
                self.log_result(f"  Group: {group['text']} (Count: {group['count']})", "INFO")
            
            # Step 6: Perform search that should filter some domains
            search_term = "github"  # Should only match github.com domain
            self.log_result(f"Searching for: '{search_term}'", "INFO")
            
            if not self.perform_search(search_term):
                return False
            
            time.sleep(0.5)  # Wait for search filtering
            
            # Step 7: Verify fixes after search
            filtered_groups = self.get_group_headers_with_counts()
            filtered_tabs = self.get_visible_tabs_with_content()
            
            self.log_result(f"After search: {len(filtered_groups)} groups, {len(filtered_tabs)} tabs", "INFO")
            
            # Verify visible tabs actually match search
            matching_tabs, non_matching_tabs = self.verify_tabs_match_search(filtered_tabs, search_term)
            
            self.log_result(f"Visible tabs analysis:", "INFO")
            self.log_result(f"  Total visible: {len(filtered_tabs)}", "INFO")
            self.log_result(f"  Actually match '{search_term}': {len(matching_tabs)}", "INFO") 
            self.log_result(f"  Don't match '{search_term}': {len(non_matching_tabs)}", "INFO")
            
            # Show groups after search
            for group in filtered_groups:
                self.log_result(f"  Group after search: {group['text']} (Count: {group['count']})", "INFO")
            
            # Test Results
            fixes_working = []
            fixes_failed = []
            
            # Fix 1: Verify search filtering works correctly
            if len(non_matching_tabs) == 0:
                self.log_result("✅ FIX 1 VERIFIED: Search filtering works - all visible tabs match search term", "PASSED")
                fixes_working.append("Search filtering accuracy")
            else:
                issue_msg = f"❌ FIX 1 FAILED: {len(non_matching_tabs)} tabs visible that don't match search '{search_term}'"
                self.log_result(issue_msg, "FAILED")
                fixes_failed.append("Search filtering accuracy")
            
            # Fix 2: Verify empty groups are handled correctly
            empty_groups = [g for g in filtered_groups if g['count'] == 0]
            if len(empty_groups) == 0:
                self.log_result("✅ FIX 2 VERIFIED: Empty groups are hidden correctly", "PASSED")
                fixes_working.append("Empty group hiding")
            else:
                self.log_result(f"❌ FIX 2 FAILED: {len(empty_groups)} empty groups still showing", "FAILED")
                fixes_failed.append("Empty group hiding")
                for empty_group in empty_groups:
                    self.log_result(f"  Empty group: {empty_group['text']}", "FAILED")
            
            # Fix 3: Verify group counters match visible tabs (only count VISIBLE groups)
            visible_groups = self.get_visible_groups_only(filtered_groups)
            total_header_count = sum(g['count'] for g in visible_groups)
            actual_visible_count = len(filtered_tabs)
            
            self.log_result(f"  Visible groups: {len(visible_groups)}, Hidden groups: {len(filtered_groups) - len(visible_groups)}", "INFO")
            
            if total_header_count == actual_visible_count:
                self.log_result(f"✅ FIX 3 VERIFIED: Group counters match visible tabs ({total_header_count} = {actual_visible_count})", "PASSED")
                fixes_working.append("Group counter accuracy")
            else:
                self.log_result(f"❌ FIX 3 FAILED: Group counters show {total_header_count} but {actual_visible_count} tabs actually visible", "FAILED")
                fixes_failed.append("Group counter accuracy")
            
            # Fix 4: Test search clearing
            self.log_result("Testing search clearing...", "INFO")
            if not self.clear_search():
                return False
            
            time.sleep(0.5)
            
            cleared_groups = self.get_group_headers_with_counts()
            cleared_tabs = self.get_visible_tabs_with_content()
            
            self.log_result(f"After clearing search: {len(cleared_groups)} groups, {len(cleared_tabs)} tabs", "INFO")
            
            # Verify restoration
            if len(cleared_tabs) >= len(initial_tabs):
                self.log_result("✅ FIX 4 VERIFIED: Search clearing restores all tabs", "PASSED")
                fixes_working.append("Search clearing restoration")
            else:
                self.log_result(f"❌ FIX 4 FAILED: After clearing, only {len(cleared_tabs)} tabs visible (expected >= {len(initial_tabs)})", "FAILED")
                fixes_failed.append("Search clearing restoration")
            
            # Test different search scenarios to verify robustness
            search_scenarios = [
                ("stackoverflow", "Should filter to stackoverflow.com only"),
                ("python", "Should match across multiple domains"),
                ("nonexistent123", "Should result in no matches")
            ]
            
            for search_term, description in search_scenarios:
                self.log_result(f"Testing scenario: '{search_term}' - {description}", "INFO")
                
                if not self.perform_search(search_term):
                    continue
                
                time.sleep(0.3)
                
                scenario_groups = self.get_group_headers_with_counts()
                scenario_tabs = self.get_visible_tabs_with_content()
                
                # Check if counters are working for this scenario (only count visible groups)
                scenario_visible_groups = self.get_visible_groups_only(scenario_groups)
                scenario_total_count = sum(g['count'] for g in scenario_visible_groups)
                scenario_visible_count = len(scenario_tabs)
                
                if scenario_total_count == scenario_visible_count:
                    self.log_result(f"  ✅ Scenario '{search_term}': Counters match ({scenario_total_count} = {scenario_visible_count})", "PASSED")
                else:
                    self.log_result(f"  ❌ Scenario '{search_term}': Counter mismatch ({scenario_total_count} vs {scenario_visible_count})", "FAILED")
                    if "Group counter accuracy" not in fixes_failed:
                        fixes_failed.append("Group counter accuracy across scenarios")
            
            # Clear search again
            self.clear_search()
            time.sleep(1)
            
            # Summary
            self.log_result("🎯 GROUP BY + Search Fixes Test Results", "INFO")
            self.log_result("=" * 60, "INFO")
            
            if len(fixes_working) > 0:
                self.log_result(f"✅ FIXES WORKING ({len(fixes_working)}):", "PASSED")
                for i, fix in enumerate(fixes_working, 1):
                    self.log_result(f"  {i}. {fix}", "PASSED")
            
            if len(fixes_failed) > 0:
                self.log_result(f"❌ FIXES STILL BROKEN ({len(fixes_failed)}):", "FAILED")
                for i, fix in enumerate(fixes_failed, 1):
                    self.log_result(f"  {i}. {fix}", "FAILED")
                
                return False  # Test failed - fixes not working
            else:
                self.log_result("🎉 ALL FIXES VERIFIED: GROUP BY + Search issues resolved!", "PASSED")
                return True  # Test passed - all fixes working
                
        except Exception as e:
            self.log_result(f"Fix verification test failed with error: {e}", "FAILED")
            return False
    
    def get_visible_groups_only(self, all_groups):
        """Filter groups to only include those that are actually visible (not hidden by search)"""
        try:
            visible_groups = []
            for group in all_groups:
                try:
                    # Check if the group section is hidden
                    group_section = group['element'].closest('.group-section')
                    if group_section:
                        # Check if group is hidden by CSS
                        style = group_section.get_attribute("style") or ""
                        is_hidden = "display: none" in style or "display:none" in style
                        
                        # Also check for group-hidden class
                        classes = group_section.get_attribute("class") or ""
                        has_hidden_class = "group-hidden" in classes
                        
                        if not is_hidden and not has_hidden_class and group_section.is_displayed():
                            visible_groups.append(group)
                except:
                    # If we can't determine visibility, include it
                    visible_groups.append(group)
            
            return visible_groups
            
        except Exception as e:
            self.log_result(f"Error filtering visible groups: {e}", "FAILED")
            return all_groups  # Fallback to all groups
    
    def get_group_headers_with_counts(self):
        """Get all group headers with their counts"""
        try:
            # Try multiple selectors for group headers
            group_selectors = [
                ".group-header",
                ".category-header", 
                ".category-section h3",
                ".group-section h3",
                ".group-title",
                "h3",
                "[class*='group']",
                "[class*='category']"
            ]
            
            groups = []
            for selector in group_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for element in elements:
                        text = element.text.strip()
                        if text and ("(" in text and ")" in text):
                            # Extract count from text like "Domain Name (3)"
                            count_match = text.split("(")[-1].split(")")[0]
                            try:
                                count = int(count_match)
                                groups.append({
                                    'element': element,
                                    'text': text,
                                    'count': count
                                })
                            except ValueError:
                                continue
                except:
                    continue
            
            # Remove duplicates based on text
            seen_texts = set()
            unique_groups = []
            for group in groups:
                if group['text'] not in seen_texts:
                    seen_texts.add(group['text'])
                    unique_groups.append(group)
            
            return unique_groups
            
        except Exception as e:
            self.log_result(f"Error getting group headers: {e}", "FAILED")
            return []
    
    def get_visible_tabs_with_content(self):
        """Get all currently visible tabs with their URLs and titles"""
        try:
            # Find all tab items
            tab_items = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
            
            visible_tabs = []
            for tab_item in tab_items:
                try:
                    # Check if tab is actually visible (not hidden by search)
                    display_style = tab_item.get_attribute("style") or ""
                    is_hidden = "display: none" in display_style or "display:none" in display_style
                    
                    if not is_hidden and tab_item.is_displayed():
                        # Extract tab information
                        title_elem = tab_item.find_element(By.CSS_SELECTOR, ".tab-title")
                        url_elem = tab_item.find_element(By.CSS_SELECTOR, ".tab-url")
                        
                        tab_info = {
                            'element': tab_item,
                            'title': title_elem.text.strip() if title_elem else '',
                            'url': url_elem.text.strip() if url_elem else '',
                            'is_visible': True
                        }
                        visible_tabs.append(tab_info)
                        
                except Exception as e:
                    # Skip tabs we can't read
                    continue
            
            return visible_tabs
            
        except Exception as e:
            self.log_result(f"Error getting visible tabs with content: {e}", "FAILED")
            return []
    
    def verify_tabs_match_search(self, visible_tabs, search_term):
        """Verify that visible tabs actually match the search term"""
        try:
            search_lower = search_term.lower()
            matching_tabs = []
            non_matching_tabs = []
            
            for tab in visible_tabs:
                title_lower = tab['title'].lower()
                url_lower = tab['url'].lower()
                
                if search_lower in title_lower or search_lower in url_lower:
                    matching_tabs.append(tab)
                else:
                    non_matching_tabs.append(tab)
            
            return matching_tabs, non_matching_tabs
            
        except Exception as e:
            self.log_result(f"Error verifying search matches: {e}", "FAILED")
            return [], []
    
    def set_groupby_mode(self, mode):
        """Set GROUP BY mode (domain, category, etc.)"""
        try:
            # Use the correct selector from popup.html - the unified grouping select
            groupby_selector = "#unifiedGroupingSelect"
            
            try:
                element = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, groupby_selector))
                )
                
                # Set value using JavaScript to ensure it works
                self.driver.execute_script(f"""
                    var select = arguments[0];
                    select.value = '{mode}';
                    select.dispatchEvent(new Event('change', {{ bubbles: true }}));
                """, element)
                
                self.log_result(f"Set GROUP BY to: {mode}", "PASSED")
                return True
            except Exception as e:
                self.log_result(f"Failed to set GROUP BY: {e}", "FAILED")
                return False
            
        except Exception as e:
            self.log_result(f"Error setting GROUP BY mode: {e}", "FAILED")
            return False
    
    def perform_search(self, search_term):
        """Perform search with the given term"""
        try:
            # Use the correct search input selector from popup.html
            search_selector = "#unifiedSearchInput"
            
            try:
                search_element = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, search_selector))
                )
                
                search_element.clear()
                search_element.send_keys(search_term)
                
                # Trigger input event
                self.driver.execute_script("""
                    arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
                """, search_element)
                
                self.log_result(f"Search performed: '{search_term}'", "PASSED")
                return True
            except Exception as e:
                self.log_result(f"Failed to perform search: {e}", "FAILED")
                return False
            
        except Exception as e:
            self.log_result(f"Error performing search: {e}", "FAILED")
            return False
    
    def clear_search(self):
        """Clear the search input"""
        try:
            # Use the correct search input selector
            search_selector = "#unifiedSearchInput"
            
            try:
                search_element = self.driver.find_element(By.CSS_SELECTOR, search_selector)
                search_element.clear()
                
                # Trigger input event
                self.driver.execute_script("""
                    arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
                """, search_element)
                
                self.log_result("Search cleared", "PASSED")
                return True
            except Exception as e:
                self.log_result(f"Failed to clear search: {e}", "FAILED")
                return False
            
        except Exception as e:
            self.log_result(f"Error clearing search: {e}", "FAILED")
            return False

def main():
    """Run GROUP BY + Search Fixes verification test"""
    test = GroupBySearchFixesTest()
    
    print("🔧 TDD Test: GROUP BY + Search Fixes Verification")
    print("=" * 60)
    print("Testing that fixes resolve:")
    print("1. Group header counters update correctly when search filters tabs")
    print("2. Empty groups are hidden when search filters all tabs in a group")
    print("3. Search clearing restores all tabs and counts correctly")
    print("")
    
    try:
        # Setup Windows Chrome connection
        if not test.setup_windows_chrome():
            print("❌ Windows Chrome connection failed")
            return 1
        
        # Access extension in Windows Chrome Default profile
        popup_url = f"chrome-extension://{test.extension_id}/popup.html"
        test.log_result(f"Accessing extension popup: {popup_url}", "INFO")
        
        try:
            test.driver.get(popup_url)
            time.sleep(5)  # Give more time for extension to load
            test.log_result("Extension popup accessed", "PASSED")
        except Exception as e:
            test.log_result(f"Cannot access extension popup: {e}", "FAILED")
            print("❌ Extension access failed - may need to start Windows Chrome with remote debugging")
            print("💡 Try: '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe' --remote-debugging-port=9222")
            return 1
        
        # Run the fixes verification test
        success = test.test_groupby_search_fixes()
        
        if success:
            print("\n✅ GROUP BY + Search Fixes Verification PASSED")
            print("All fixes are working correctly!")
        else:
            print("\n❌ GROUP BY + Search Fixes Verification FAILED")
            print("Some fixes need additional work")
        
        # Save report
        test.save_report("GROUP BY + Search Fixes Verification", "PASSED" if success else "FAILED")
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ Fixes verification test error: {e}")
        return 1
    finally:
        test.cleanup()

if __name__ == "__main__":
    exit(main())