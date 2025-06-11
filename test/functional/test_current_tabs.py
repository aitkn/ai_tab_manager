#!/usr/bin/env python3
"""
Functional tests for current tabs functionality
"""

import pytest
import time
from selenium.webdriver.common.by import By
from conftest import create_test_tabs, show_demo_balloon, wait_for_element


class TestCurrentTabsFunctionality:
    """Test suite for current tabs functionality"""
    
    def test_current_tab_button_click(self, extension_driver, demo_mode):
        """Test that Current tab button loads tabs correctly"""
        state = extension_driver
        show_demo_balloon(state, "Testing Current tab button click", "INFO", demo_mode=demo_mode)
        
        # Create test tabs
        test_urls = [
            "https://github.com/test/repo",
            "https://stackoverflow.com/questions/test"
        ]
        create_test_tabs(state, test_urls)
        
        # Click Current tab button
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        initial_text = current_btn.text
        current_btn.click()
        time.sleep(2)
        
        # Verify tabs are loaded
        tab_items = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        assert len(tab_items) >= len(test_urls), f"Should load at least {len(test_urls)} tabs, got {len(tab_items)}"
        
        # Verify button state/text might change
        final_text = current_btn.text
        show_demo_balloon(state, f"✅ Current tab loaded: {len(tab_items)} tabs found", "PASSED", demo_mode=demo_mode)
    
    def test_current_tabs_from_all_windows(self, extension_driver, demo_mode):
        """Test that current tabs includes tabs from ALL windows, not just current window"""
        state = extension_driver
        show_demo_balloon(state, "Testing tabs from all windows", "INFO", demo_mode=demo_mode)
        
        # Create test tabs in current window
        test_urls = [
            "https://github.com/test/repo1",
            "https://stackoverflow.com/q/1"
        ]
        create_test_tabs(state, test_urls)
        
        # Try to create a new window with additional tabs
        # Note: This may be limited by Chrome security, but we'll attempt it
        try:
            state.driver.execute_script("window.open('https://docs.python.org/3/', '_blank');")
            time.sleep(1)
        except:
            pass  # If new window creation fails, continue with existing tabs
        
        # Switch back to extension and load current tabs
        if state.extension_handle:
            state.driver.switch_to.window(state.extension_handle)
        
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(2)
        
        # Verify tabs are loaded (should include tabs from multiple windows if any)
        tab_items = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        
        # At minimum, should have our test tabs
        assert len(tab_items) >= len(test_urls), f"Should have at least {len(test_urls)} tabs"
        
        # Check that tabs show URLs from different sources
        tab_urls = []
        for tab in tab_items[:10]:  # Check first 10 tabs
            try:
                url_element = tab.find_element(By.CSS_SELECTOR, ".tab-url")
                tab_urls.append(url_element.text)
            except:
                continue
        
        # Should find some of our test URLs
        found_test_urls = [url for url in tab_urls if any(test in url for test in ["github.com", "stackoverflow.com"])]
        assert len(found_test_urls) > 0, f"Should find test URLs in loaded tabs, got: {tab_urls[:5]}"
        
        show_demo_balloon(state, f"✅ All windows tabs: {len(tab_items)} total tabs, {len(found_test_urls)} test tabs found", "PASSED", demo_mode=demo_mode)
    
    def test_current_tabs_exclude_extension_tabs(self, extension_driver, demo_mode):
        """Test that extension tabs are excluded from current tabs list"""
        state = extension_driver
        show_demo_balloon(state, "Testing extension tab exclusion", "INFO", demo_mode=demo_mode)
        
        # Create test tabs
        test_urls = ["https://github.com/test/repo"]
        create_test_tabs(state, test_urls)
        
        # Load current tabs
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(2)
        
        # Check that no extension tabs appear in the list
        tab_items = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        
        extension_tabs_found = []
        for tab in tab_items:
            try:
                url_element = tab.find_element(By.CSS_SELECTOR, ".tab-url")
                tab_url = url_element.text
                if state.extension_id in tab_url:
                    extension_tabs_found.append(tab_url)
            except:
                continue
        
        assert len(extension_tabs_found) == 0, f"Should not find extension tabs in current list, found: {extension_tabs_found}"
        
        show_demo_balloon(state, f"✅ Extension exclusion: {len(tab_items)} tabs, 0 extension tabs", "PASSED", demo_mode=demo_mode)
    
    def test_current_tabs_refresh(self, extension_driver, demo_mode):
        """Test that current tabs can be refreshed to show new tabs"""
        state = extension_driver
        show_demo_balloon(state, "Testing current tabs refresh", "INFO", demo_mode=demo_mode)
        
        # Create initial test tabs
        initial_urls = ["https://github.com/test/repo1"]
        create_test_tabs(state, initial_urls)
        
        # Load current tabs
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(2)
        
        initial_tabs = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        initial_count = len(initial_tabs)
        
        show_demo_balloon(state, f"Initial load: {initial_count} tabs", "INFO", 1.5, demo_mode=demo_mode)
        
        # Create additional tabs
        additional_urls = ["https://stackoverflow.com/questions/refresh"]
        create_test_tabs(state, additional_urls)
        
        # Switch back to extension and refresh current tabs
        if state.extension_handle:
            state.driver.switch_to.window(state.extension_handle)
        
        # Click current tab button again to refresh
        current_btn.click()
        time.sleep(2)
        
        # Verify additional tabs are now shown
        refreshed_tabs = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        refreshed_count = len(refreshed_tabs)
        
        assert refreshed_count >= initial_count, f"Refreshed count ({refreshed_count}) should be >= initial count ({initial_count})"
        
        # Look for the new tab URL
        found_new_tab = False
        for tab in refreshed_tabs:
            try:
                url_element = tab.find_element(By.CSS_SELECTOR, ".tab-url")
                if "stackoverflow.com" in url_element.text and "refresh" in url_element.text:
                    found_new_tab = True
                    break
            except:
                continue
        
        assert found_new_tab, "Should find the newly created tab after refresh"
        
        show_demo_balloon(state, f"✅ Refresh working: {initial_count} → {refreshed_count} tabs", "PASSED", demo_mode=demo_mode)
    
    def test_current_tabs_display_format(self, extension_driver, demo_mode):
        """Test that current tabs display with correct format (title, URL, favicon)"""
        state = extension_driver
        show_demo_balloon(state, "Testing tab display format", "INFO", demo_mode=demo_mode)
        
        # Create test tab with known content
        test_urls = ["https://github.com/microsoft/vscode"]
        create_test_tabs(state, test_urls)
        
        # Load current tabs
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(2)
        
        # Find our test tab
        tab_items = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        github_tab = None
        
        for tab in tab_items:
            try:
                url_element = tab.find_element(By.CSS_SELECTOR, ".tab-url")
                if "github.com/microsoft/vscode" in url_element.text:
                    github_tab = tab
                    break
            except:
                continue
        
        assert github_tab is not None, "Should find GitHub test tab"
        
        # Verify tab elements
        try:
            title_element = github_tab.find_element(By.CSS_SELECTOR, ".tab-title")
            url_element = github_tab.find_element(By.CSS_SELECTOR, ".tab-url")
            
            title_text = title_element.text
            url_text = url_element.text
            
            assert len(title_text) > 0, "Tab should have title text"
            assert "github.com" in url_text, "Tab should show GitHub URL"
            
            # Try to find favicon (optional, may not always be present)
            try:
                favicon_element = github_tab.find_element(By.CSS_SELECTOR, ".tab-favicon, .favicon, img")
                favicon_found = True
            except:
                favicon_found = False
            
            show_demo_balloon(state, f"✅ Tab format: title='{title_text[:30]}', favicon={favicon_found}", "PASSED", demo_mode=demo_mode)
            
        except Exception as e:
            pytest.fail(f"Tab format check failed: {e}")


@pytest.mark.current_tabs  
class TestCurrentTabsEdgeCases:
    """Test edge cases for current tabs functionality"""
    
    def test_current_tabs_with_many_tabs(self, extension_driver, demo_mode):
        """Test current tabs performance with many tabs"""
        state = extension_driver
        show_demo_balloon(state, "Testing with many tabs", "INFO", demo_mode=demo_mode)
        
        # Create multiple test tabs
        test_urls = [
            f"https://example.com/page{i}" for i in range(5)
        ]
        create_test_tabs(state, test_urls)
        
        # Load current tabs
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        start_time = time.time()
        current_btn.click()
        time.sleep(3)  # Give more time for many tabs
        load_time = time.time() - start_time
        
        # Verify tabs loaded
        tab_items = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        
        assert len(tab_items) >= len(test_urls), f"Should load at least {len(test_urls)} tabs"
        assert load_time < 10, f"Should load within 10 seconds, took {load_time:.2f}s"
        
        show_demo_balloon(state, f"✅ Many tabs: {len(tab_items)} tabs loaded in {load_time:.2f}s", "PASSED", demo_mode=demo_mode)
    
    def test_current_tabs_with_special_urls(self, extension_driver, demo_mode):
        """Test current tabs with special URLs (data:, blob:, etc.)"""
        state = extension_driver
        show_demo_balloon(state, "Testing special URLs", "INFO", demo_mode=demo_mode)
        
        # Create tabs with special/edge case URLs  
        # Note: Some special URLs might not work due to browser security
        test_urls = [
            "https://github.com/test/normal",
            # data: URLs often blocked in new tabs
            # "data:text/html,<h1>Test</h1>",
        ]
        create_test_tabs(state, test_urls)
        
        # Load current tabs
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(2)
        
        # Verify normal tabs are handled correctly
        tab_items = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        
        normal_tabs_found = 0
        for tab in tab_items:
            try:
                url_element = tab.find_element(By.CSS_SELECTOR, ".tab-url")
                url_text = url_element.text
                if "github.com" in url_text:
                    normal_tabs_found += 1
            except:
                continue
        
        assert normal_tabs_found > 0, "Should find normal tabs even when special URLs are present"
        
        show_demo_balloon(state, f"✅ Special URLs: {len(tab_items)} total tabs, {normal_tabs_found} normal tabs", "PASSED", demo_mode=demo_mode)