#!/usr/bin/env python3
"""
Debug version of Close All test to understand tab counting issue
"""

import pytest
import time
from selenium.webdriver.common.by import By
from functional.conftest import create_test_tabs, show_demo_balloon, wait_for_element, track_tabs_before_close_all

def test_debug_close_all(extension_driver, demo_mode):
    """Debug Close All tab counting issue"""
    state = extension_driver
    show_demo_balloon(state, "DEBUG: Testing Close All tab counting", "INFO", demo_mode=demo_mode)
    
    # Create test tabs
    test_urls = [
        "https://github.com/test/repo1",
        "https://stackoverflow.com/questions/test1",
        "https://google.com"
    ]
    create_test_tabs(state, test_urls)
    
    show_demo_balloon(state, f"✅ Created {len(test_urls)} test tabs", "PASSED", demo_mode=demo_mode)
    
    # Give extension time to detect new tabs
    time.sleep(3 if demo_mode else 2)
    
    show_demo_balloon(state, "Loading current tabs in extension...", "INFO", demo_mode=demo_mode)
    
    # Load current tabs
    current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
    current_btn.click()
    time.sleep(5 if demo_mode else 3)
    
    # Debug: Check what's on the page
    print("\n🔍 DEBUG: Page HTML structure:")
    try:
        body = state.driver.find_element(By.TAG_NAME, "body")
        print(f"Body classes: {body.get_attribute('class')}")
        
        # Check for containers
        containers = state.driver.find_elements(By.CSS_SELECTOR, "#tabsContainer, .tabs-container, #categorizeView, .category-view")
        print(f"Found {len(containers)} tab containers")
        for i, container in enumerate(containers):
            print(f"  Container {i+1}: {container.tag_name} id='{container.get_attribute('id')}' class='{container.get_attribute('class')}'")
        
        # Check for tab items with different selectors
        selectors_to_try = [
            ".tab-item",
            ".tab",
            "[data-tab-id]",
            ".category-section .tab-item",
            "#categorizeView .tab-item",
            ".tabs-list .tab-item"
        ]
        
        for selector in selectors_to_try:
            elements = state.driver.find_elements(By.CSS_SELECTOR, selector)
            print(f"  Selector '{selector}': {len(elements)} elements")
            if len(elements) > 0:
                for j, elem in enumerate(elements[:3]):  # Show first 3
                    try:
                        url_elem = elem.find_element(By.CSS_SELECTOR, ".tab-url")
                        url = url_elem.text if url_elem else "No URL"
                        print(f"    Element {j+1}: {url[:50]}")
                    except:
                        print(f"    Element {j+1}: Could not read URL")
        
        # Check for error messages or empty states
        error_selectors = [".error", ".no-tabs", ".loading", ".empty"]
        for selector in error_selectors:
            elements = state.driver.find_elements(By.CSS_SELECTOR, selector)
            if len(elements) > 0:
                for elem in elements:
                    print(f"  Status element '{selector}': {elem.text}")
        
        # Check if tabs are hidden
        hidden_tabs = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item.hidden")
        print(f"  Hidden tabs: {len(hidden_tabs)}")
        
        # Check current tab state
        active_tab = state.driver.find_element(By.CSS_SELECTOR, "[data-tab='categorize']")
        print(f"  Current tab active: {active_tab.get_attribute('class')}")
        
    except Exception as e:
        print(f"Error during debug inspection: {e}")
    
    # Standard tab count
    tab_items = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
    initial_count = len(tab_items)
    
    print(f"\n🔍 FINAL COUNT: Found {initial_count} .tab-item elements")
    
    show_demo_balloon(state, f"DEBUG: Found {initial_count} tab items in UI", "INFO", demo_mode=demo_mode)
    
    if initial_count == 0:
        show_demo_balloon(state, "❌ No tabs found - this is the issue!", "FAILED", demo_mode=demo_mode)
        pytest.fail("No tabs found in extension UI - debugging complete")
    else:
        show_demo_balloon(state, f"✅ Found {initial_count} tabs - would proceed with Close All", "PASSED", demo_mode=demo_mode)

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--demo"])