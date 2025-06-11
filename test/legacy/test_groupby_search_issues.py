#!/usr/bin/env python3
"""
TDD Test to Confirm GROUP BY + Search Issues
Tests the specific problems:
1. Empty groups still showing when search filters all tabs in a group
2. Group header counters not updating when search filters tabs
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

class GroupBySearchIssuesTest(ExtensionTestBase):
    def __init__(self):
        super().__init__()
        self.test_name = "GROUP BY + Search Issues Test"
        self.extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"  # Known Windows Chrome extension
    
    def setup_windows_chrome(self):
        """Setup Chrome to connect to Windows Chrome Default profile with extension"""
        try:
            chrome_options = Options()
            
            # Use Windows Chrome with Default profile that has the extension
            windows_chrome_path = "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
            chrome_options.binary_location = windows_chrome_path
            
            # Use Windows Chrome Default profile where extension is installed
            import os
            username = os.environ.get('USER', 'proshkin')  # WSL username
            windows_user_data = f"/mnt/c/Users/{username}/AppData/Local/Google/Chrome/User Data"
            
            chrome_options.add_argument(f"--user-data-dir={windows_user_data}")
            chrome_options.add_argument("--profile-directory=Default")
            
            # Configuration for automation
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-web-security")
            chrome_options.add_argument("--remote-debugging-port=9222")
            chrome_options.add_argument("--disable-extensions-file-access-check")
            
            # Initialize driver
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.driver.set_window_size(1200, 800)
            self.driver.set_page_load_timeout(30)
            
            self.log_result("Connected to Windows Chrome Default profile", "PASSED")
            return True
            
        except Exception as e:
            self.log_result(f"Windows Chrome connection failed: {e}", "FAILED")
            
            # Fallback: try connecting to existing Chrome session
            try:
                self.log_result("Connecting to Windows Chrome remote debugging...", "INFO")
                
                chrome_options = Options()
                chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
                
                service = Service(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=service, options=chrome_options)
                
                self.log_result("Connected to Windows Chrome session", "PASSED")
                return True
                
            except Exception as e2:
                self.log_result(f"Remote debugging connection failed: {e2}", "FAILED")
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
                time.sleep(1)
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
        
    def test_groupby_search_issues(self):
        """TDD test to confirm GROUP BY + search issues"""
        try:
            self.log_result("🔍 TDD: Testing GROUP BY + Search Issues", "INFO")
            
            # Step 1: Create test tabs with different domains
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
            
            # Step 2: Navigate to Current tab
            if not self.go_to_current_tabs():
                return False
            
            time.sleep(2)  # Wait for tabs to load
            
            # Step 3: Switch to Domain grouping
            self.log_result("Setting GROUP BY to Domain", "INFO")
            if not self.set_groupby_mode("domain"):
                return False
            
            time.sleep(2)  # Wait for grouping to apply
            
            # Step 4: Count initial groups and tabs
            initial_groups = self.get_group_headers_with_counts()
            initial_tabs = self.get_visible_tabs_with_content()
            
            self.log_result(f"Initial state: {len(initial_groups)} groups, {len(initial_tabs)} tabs", "INFO")
            for group in initial_groups:
                self.log_result(f"  Group: {group['text']} (Count: {group['count']})", "INFO")
            
            # Show sample of initial tabs
            for i, tab in enumerate(initial_tabs[:3]):
                self.log_result(f"  Sample tab {i+1}: '{tab['title']}' - {tab['url']}", "INFO")
            
            # Step 5: Perform search that should filter some domains completely
            search_term = "github"  # Should only match github.com domain
            self.log_result(f"Searching for: '{search_term}'", "INFO")
            
            if not self.perform_search(search_term):
                return False
            
            time.sleep(3)  # Wait for search filtering
            
            # Step 6: Check for issues after search
            filtered_groups = self.get_group_headers_with_counts()
            filtered_tabs = self.get_visible_tabs_with_content()
            
            self.log_result(f"After search: {len(filtered_groups)} groups, {len(filtered_tabs)} tabs", "INFO")
            
            # CRITICAL: Verify visible tabs actually match search
            matching_tabs, non_matching_tabs = self.verify_tabs_match_search(filtered_tabs, search_term)
            
            self.log_result(f"Visible tabs analysis:", "INFO")
            self.log_result(f"  Total visible: {len(filtered_tabs)}", "INFO")
            self.log_result(f"  Actually match '{search_term}': {len(matching_tabs)}", "INFO") 
            self.log_result(f"  Don't match '{search_term}': {len(non_matching_tabs)}", "INFO")
            
            # Show what's actually visible
            for tab in filtered_tabs[:5]:  # Show first 5 visible tabs
                matches = search_term.lower() in tab['title'].lower() or search_term.lower() in tab['url'].lower()
                match_indicator = "✅" if matches else "❌"
                self.log_result(f"  {match_indicator} Visible: '{tab['title']}' - {tab['url']}", "INFO")
            
            # Show groups after search
            for group in filtered_groups:
                self.log_result(f"  Group: {group['text']} (Count: {group['count']})", "INFO")
            
            # Issue 1: Check if search is actually working
            issues_found = []
            
            # CRITICAL TEST: Are non-matching tabs still visible?
            if len(non_matching_tabs) > 0:
                issue_msg = f"ISSUE 1 CONFIRMED: {len(non_matching_tabs)} tabs visible that don't match search '{search_term}'"
                self.log_result(issue_msg, "FAILED")
                issues_found.append("Search not filtering properly")
                
                for tab in non_matching_tabs[:3]:  # Show first 3 non-matching
                    self.log_result(f"  ❌ Shouldn't be visible: '{tab['title']}' - {tab['url']}", "FAILED")
            else:
                self.log_result("✅ Search filtering works: All visible tabs match search term", "PASSED")
            
            # Issue 2: Check if empty groups are still showing
            empty_groups = [g for g in filtered_groups if g['count'] == 0]
            if empty_groups:
                issue_msg = f"ISSUE 2 CONFIRMED: {len(empty_groups)} empty groups still showing after search"
                self.log_result(issue_msg, "FAILED")
                issues_found.append("Empty groups still visible")
                
                for empty_group in empty_groups:
                    self.log_result(f"  Empty group: {empty_group['text']}", "FAILED")
            else:
                self.log_result("✅ Empty groups handled correctly", "PASSED")
            
            # Issue 3: Check if visible group counts match actual tabs
            if len(filtered_groups) > 0:
                total_header_count = sum(g['count'] for g in filtered_groups)
                actual_visible_count = len(filtered_tabs)
                
                if total_header_count != actual_visible_count:
                    issue_msg = f"ISSUE 3 CONFIRMED: Group counters show {total_header_count} but {actual_visible_count} tabs actually visible"
                    self.log_result(issue_msg, "FAILED")
                    issues_found.append("Group counters not matching visible tabs")
                else:
                    self.log_result("✅ Group counters match visible tab count", "PASSED")
            
            # Step 7: Test different search scenarios
            search_scenarios = [
                ("stackoverflow", "Should filter to stackoverflow.com only"),
                ("python", "Should match across multiple domains"),
                ("nonexistent123", "Should result in no matches")
            ]
            
            for search_term, description in search_scenarios:
                self.log_result(f"Testing search scenario: '{search_term}' - {description}", "INFO")
                
                if not self.perform_search(search_term):
                    continue
                
                time.sleep(1)
                
                scenario_groups = self.get_group_headers_with_counts()
                scenario_tabs = self.get_visible_tabs_with_content()
                
                scenario_empty_groups = [g for g in scenario_groups if g['count'] == 0]
                if scenario_empty_groups:
                    self.log_result(f"  Found {len(scenario_empty_groups)} empty groups for '{search_term}'", "FAILED")
                    if "Empty groups still visible" not in issues_found:
                        issues_found.append("Empty groups still visible")
                
                # Check counters for this scenario
                scenario_actual_counts = self.count_tabs_per_group()
                for group in scenario_groups:
                    group_name = self.extract_group_name(group['text'])
                    actual_count = scenario_actual_counts.get(group_name, 0)
                    header_count = group['count']
                    
                    if actual_count != header_count:
                        self.log_result(
                            f"  Counter mismatch in '{search_term}': {group_name} "
                            f"shows {header_count}, has {actual_count}", 
                            "FAILED"
                        )
                        if "Group counters not updated" not in issues_found:
                            issues_found.append("Group counters not updated")
            
            # Step 8: Clear search and verify restoration
            self.log_result("Clearing search to test restoration", "INFO")
            if not self.clear_search():
                return False
            
            time.sleep(2)
            
            restored_groups = self.get_group_headers_with_counts()
            restored_tabs = self.get_visible_tabs_with_content()
            
            self.log_result(f"After clearing search: {len(restored_groups)} groups, {len(restored_tabs)} tabs", "INFO")
            
            # Summary
            self.log_result("🎯 TDD TEST RESULTS - GROUP BY + Search Issues", "INFO")
            self.log_result("=" * 60, "INFO")
            
            if issues_found:
                self.log_result(f"✅ TDD SUCCESSFUL: Found {len(issues_found)} confirmed issues:", "PASSED")
                for i, issue in enumerate(issues_found, 1):
                    self.log_result(f"  {i}. {issue}", "FAILED")
                
                self.log_result("\n🔧 Issues to fix in search-filter.js:", "INFO")
                self.log_result("  1. Hide empty groups when search filters all tabs in a group", "INFO")
                self.log_result("  2. Update group header counters to reflect filtered tab counts", "INFO")
                
                return True  # TDD successful - issues confirmed
            else:
                self.log_result("❌ TDD INCOMPLETE: Expected issues not found", "FAILED")
                self.log_result("Search functionality may already be working correctly", "INFO")
                return False
                
        except Exception as e:
            self.log_result(f"TDD test failed with error: {e}", "FAILED")
            return False
    
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
    
    def count_tabs_per_group(self):
        """Count actual visible tabs per group"""
        try:
            # This is a simplified version - in real implementation,
            # we'd need to identify which tabs belong to which group
            # For now, return approximate counts based on visible tabs
            
            visible_tabs = self.get_visible_tabs_with_content()
            
            # Try to determine groups by looking for group containers
            group_counts = {}
            
            # Look for group containers
            try:
                group_containers = self.driver.find_elements(By.CSS_SELECTOR, ".group-section, .category-section, [class*='group-container']")
                
                for container in group_containers:
                    # Try to find group name
                    group_name = "unknown"
                    try:
                        header = container.find_element(By.CSS_SELECTOR, "h3, .group-header, .category-header")
                        group_name = self.extract_group_name(header.text)
                    except:
                        pass
                    
                    # Count tabs in this container
                    tabs_in_group = container.find_elements(By.CSS_SELECTOR, ".tab-item:not([style*='display: none']), .tab-title:not([style*='display: none'])")
                    group_counts[group_name] = len(tabs_in_group)
                
            except:
                # Fallback: estimate based on total visible tabs
                if visible_tabs:
                    group_counts["estimated"] = len(visible_tabs)
            
            return group_counts
            
        except Exception as e:
            self.log_result(f"Error counting tabs per group: {e}", "FAILED")
            return {}
    
    def extract_group_name(self, group_text):
        """Extract clean group name from header text like 'Domain Name (3)'"""
        try:
            if "(" in group_text:
                return group_text.split("(")[0].strip()
            return group_text.strip()
        except:
            return group_text
    
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
    """Run GROUP BY + Search Issues TDD test"""
    test = GroupBySearchIssuesTest()
    
    print("🔍 TDD Test: GROUP BY + Search Issues")
    print("=" * 50)
    print("Testing for:")
    print("1. Empty groups still showing when search filters all tabs in a group")
    print("2. Group header counters not updating when search filters tabs")
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
        
        # Run the main test
        success = test.test_groupby_search_issues()
        
        if success:
            print("\n✅ TDD Test Completed - Issues Confirmed")
            print("Ready to implement fixes in search-filter.js")
        else:
            print("\n❌ TDD Test Failed or Issues Not Found")
        
        # Save report
        test.save_report("TDD GROUP BY + Search Issues", "PASSED" if success else "FAILED")
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ TDD Test Error: {e}")
        return 1
    finally:
        test.cleanup()

if __name__ == "__main__":
    exit(main())