#!/usr/bin/env python3
"""
Functional tests for search functionality
"""

import pytest
import time
from selenium.webdriver.common.by import By
from .conftest import create_test_tabs, show_demo_balloon, wait_for_element, track_tabs_before_close_all


class TestSearchFunctionality:
    """Test suite for search functionality"""
    
    def test_search_filtering_basic(self, extension_driver, demo_mode):
        """Test basic search filtering works"""
        state = extension_driver
        show_demo_balloon(state, "Testing basic search filtering", "INFO", demo_mode=demo_mode)
        
        # Create test tabs
        test_urls = [
            "https://github.com/microsoft/vscode",
            "https://stackoverflow.com/questions/javascript", 
            "https://docs.python.org/3/tutorial/"
        ]
        create_test_tabs(state, test_urls)
        
        # Click Current tab to load tabs
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(1)
        
        show_demo_balloon(state, "✅ Current tab loaded", "PASSED", demo_mode=demo_mode)
        
        # Set domain grouping
        grouping_select = wait_for_element(state.driver, "#unifiedGroupingSelect")
        if grouping_select.get_attribute("value") != 'domain':
            state.driver.execute_script("""
                var select = document.getElementById('unifiedGroupingSelect');
                select.value = 'domain';
                select.dispatchEvent(new Event('change', {bubbles: true}));
            """)
            time.sleep(2)
        
        # Test search filtering
        search_input = wait_for_element(state.driver, "#unifiedSearchInput")
        search_input.clear()
        search_input.send_keys("github")
        state.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(1)
        
        # Verify filtering results
        visible_tabs = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
        hidden_groups = state.driver.find_elements(By.CSS_SELECTOR, ".group-section.group-hidden")
        
        assert len(visible_tabs) > 0, "Should have visible tabs matching 'github'"
        assert len(hidden_groups) > 0, "Should have hidden groups with no matches"
        
        show_demo_balloon(state, f"✅ Search filtering: {len(visible_tabs)} visible tabs, {len(hidden_groups)} hidden groups", "PASSED", demo_mode=demo_mode)
    
    def test_search_clearing(self, extension_driver, demo_mode):
        """Test search clearing restores all tabs"""
        state = extension_driver
        show_demo_balloon(state, "Testing search clearing", "INFO", demo_mode=demo_mode)
        
        # Create test tabs
        test_urls = [
            "https://github.com/microsoft/vscode",
            "https://stackoverflow.com/questions/javascript"
        ]
        create_test_tabs(state, test_urls)
        
        # Load current tabs
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(1)
        
        # Apply search filter
        search_input = wait_for_element(state.driver, "#unifiedSearchInput")
        search_input.clear()
        search_input.send_keys("github")
        state.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(1)
        
        # Clear search
        search_input.clear()
        state.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(1)
        
        # Verify all tabs are restored
        visible_tabs_after = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
        visible_groups_after = state.driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
        
        assert len(visible_tabs_after) >= len(test_urls), f"Should restore all tabs, got {len(visible_tabs_after)}"
        assert len(visible_groups_after) > 0, "Should restore all groups"
        
        show_demo_balloon(state, f"✅ Search cleared: {len(visible_tabs_after)} tabs restored", "PASSED", demo_mode=demo_mode)
    
    def test_search_group_counters(self, extension_driver, demo_mode):
        """Test that group counters update correctly during search"""
        state = extension_driver
        show_demo_balloon(state, "Testing group counter updates", "INFO", demo_mode=demo_mode)
        
        # Create specific test tabs for counter testing
        test_urls = [
            "https://github.com/user1/repo1",
            "https://github.com/user2/repo2",
            "https://stackoverflow.com/questions/test"
        ]
        create_test_tabs(state, test_urls)
        
        # Give extension time to detect new tabs
        time.sleep(2)
        
        # Load current tabs with domain grouping
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(3)  # More time for extension to load and process tabs
        
        # Ensure domain grouping
        state.driver.execute_script("""
            var select = document.getElementById('unifiedGroupingSelect');
            select.value = 'domain';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        """)
        time.sleep(2)
        
        # Get initial group count
        initial_groups = state.driver.find_elements(By.CSS_SELECTOR, ".group-section")
        initial_count = len(initial_groups)
        
        # Apply search that should hide some groups
        search_input = wait_for_element(state.driver, "#unifiedSearchInput")
        search_input.clear()
        search_input.send_keys("github")
        state.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(1)
        
        # Check that github group is visible and stackoverflow group is hidden
        visible_groups = state.driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
        hidden_groups = state.driver.find_elements(By.CSS_SELECTOR, ".group-section.group-hidden")
        
        assert len(visible_groups) < initial_count, "Some groups should be hidden"
        assert len(hidden_groups) > 0, "Should have hidden groups"
        
        # DEBUG: Print all visible groups for debugging
        print(f"\n🔍 DEBUG: Found {len(visible_groups)} visible groups after search:")
        for i, group in enumerate(visible_groups):
            try:
                header = group.find_element(By.CSS_SELECTOR, ".group-header, h3")
                header_text = header.text
                group_tabs = group.find_elements(By.CSS_SELECTOR, ".tab-item")
                group_visible_tabs = group.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
                print(f"   Group {i+1}: {header_text} (total: {len(group_tabs)}, visible: {len(group_visible_tabs)})")
                
                # Print individual tabs in this group
                for j, tab in enumerate(group_tabs):
                    try:
                        url_elem = tab.find_element(By.CSS_SELECTOR, ".tab-url, .url")
                        url = url_elem.text if url_elem else "No URL"
                        is_hidden = "hidden" in tab.get_attribute("class")
                        print(f"     Tab {j+1}: {url[:50]} {'(HIDDEN)' if is_hidden else '(VISIBLE)'}")
                    except:
                        print(f"     Tab {j+1}: Could not read URL")
            except Exception as e:
                print(f"   Group {i+1}: Could not read - {e}")
        
        # Verify github group shows correct count (2 tabs)
        github_group = None
        for group in visible_groups:
            try:
                header_text = group.find_element(By.CSS_SELECTOR, ".group-header, h3").text
                if "github.com" in header_text.lower():
                    github_group = group
                    break
            except:
                continue
        
        assert github_group is not None, "GitHub group should be visible"
        
        # Count visible tabs in github group
        github_visible_tabs = github_group.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
        assert len(github_visible_tabs) == 2, f"GitHub group should show 2 tabs, got {len(github_visible_tabs)}"
        
        show_demo_balloon(state, f"✅ Group counters: {len(visible_groups)} visible groups, GitHub has {len(github_visible_tabs)} tabs", "PASSED", demo_mode=demo_mode)
    
    def test_search_case_sensitivity(self, extension_driver, demo_mode):
        """Test search is case insensitive"""
        state = extension_driver
        show_demo_balloon(state, "Testing case insensitive search", "INFO", demo_mode=demo_mode)
        
        # Create test tab
        test_urls = ["https://GitHub.com/User/Repo"]
        create_test_tabs(state, test_urls)
        
        # Load current tabs
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(1)
        
        # Test lowercase search
        search_input = wait_for_element(state.driver, "#unifiedSearchInput")
        search_input.clear()
        search_input.send_keys("github")
        state.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(1)
        
        visible_tabs = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
        assert len(visible_tabs) > 0, "Lowercase 'github' should match 'GitHub'"
        
        # Test uppercase search
        search_input.clear()
        search_input.send_keys("GITHUB")
        state.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(1)
        
        visible_tabs_upper = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
        assert len(visible_tabs_upper) > 0, "Uppercase 'GITHUB' should match 'GitHub'"
        
        show_demo_balloon(state, "✅ Case insensitive search working", "PASSED", demo_mode=demo_mode)
    
    def test_search_empty_groups_hidden(self, extension_driver, demo_mode):
        """Test that empty groups are properly hidden during search"""
        state = extension_driver
        show_demo_balloon(state, "Testing empty group hiding", "INFO", demo_mode=demo_mode)
        
        # Create tabs from different domains
        test_urls = [
            "https://github.com/test/repo",
            "https://stackoverflow.com/questions/test",
            "https://docs.python.org/guide"
        ]
        create_test_tabs(state, test_urls)
        
        # Load current tabs with domain grouping
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(1)
        
        state.driver.execute_script("""
            var select = document.getElementById('unifiedGroupingSelect');
            select.value = 'domain';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        """)
        time.sleep(2)
        
        # Count initial groups
        initial_groups = state.driver.find_elements(By.CSS_SELECTOR, ".group-section")
        initial_count = len(initial_groups)
        
        # Search for something that only matches one domain
        search_input = wait_for_element(state.driver, "#unifiedSearchInput")
        search_input.clear()
        search_input.send_keys("github")  # Should only match github.com
        state.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(1)
        
        # Verify groups are properly hidden/shown
        visible_groups = state.driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
        hidden_groups = state.driver.find_elements(By.CSS_SELECTOR, ".group-section.group-hidden")
        
        assert len(visible_groups) == 1, f"Should have exactly 1 visible group (github), got {len(visible_groups)}"
        assert len(hidden_groups) >= 2, f"Should have at least 2 hidden groups, got {len(hidden_groups)}"
        assert len(visible_groups) + len(hidden_groups) == initial_count, "Total groups should match initial count"
        
        show_demo_balloon(state, f"✅ Empty groups hidden: {len(visible_groups)} visible, {len(hidden_groups)} hidden", "PASSED", demo_mode=demo_mode)


@pytest.mark.search
class TestSearchEdgeCases:
    """Test edge cases for search functionality"""
    
    def test_search_special_characters(self, extension_driver, demo_mode):
        """Test search with special characters"""
        state = extension_driver
        show_demo_balloon(state, "Testing special character search", "INFO", demo_mode=demo_mode)
        
        # Create tab with special characters
        test_urls = ["https://example.com/path?param=value&other=test"]
        create_test_tabs(state, test_urls)
        
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(1)
        
        # Search for URL parameter
        search_input = wait_for_element(state.driver, "#unifiedSearchInput")
        search_input.clear()
        search_input.send_keys("param=value")
        state.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(1)
        
        visible_tabs = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
        assert len(visible_tabs) > 0, "Should find tabs with URL parameters"
        
        show_demo_balloon(state, "✅ Special character search working", "PASSED", demo_mode=demo_mode)
    
    def test_search_no_results(self, extension_driver, demo_mode):
        """Test search with no results"""
        state = extension_driver
        show_demo_balloon(state, "Testing no results search", "INFO", demo_mode=demo_mode)
        
        # Create test tabs
        test_urls = ["https://github.com/test/repo"]
        create_test_tabs(state, test_urls)
        
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(1)
        
        # Search for something that won't match
        search_input = wait_for_element(state.driver, "#unifiedSearchInput")
        search_input.clear()
        search_input.send_keys("nonexistentstring12345")
        state.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(1)
        
        visible_tabs = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
        visible_groups = state.driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
        
        assert len(visible_tabs) == 0, "Should have no visible tabs"
        assert len(visible_groups) == 0, "Should have no visible groups"
        
        show_demo_balloon(state, "✅ No results search working", "PASSED", demo_mode=demo_mode)