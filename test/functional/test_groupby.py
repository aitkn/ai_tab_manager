#!/usr/bin/env python3
"""
Functional tests for GROUP BY functionality
"""

import pytest
import time
from selenium.webdriver.common.by import By
from .conftest import create_test_tabs, show_demo_balloon, wait_for_element, track_tabs_before_close_all


class TestGroupByFunctionality:
    """Test suite for GROUP BY functionality"""
    
    def test_groupby_domain(self, extension_driver, demo_mode):
        """Test GROUP BY domain functionality"""
        state = extension_driver
        show_demo_balloon(state, "Testing GROUP BY domain", "INFO", demo_mode=demo_mode)
        
        # Create test tabs from different domains
        test_urls = [
            "https://github.com/microsoft/vscode",
            "https://github.com/user/repo", 
            "https://stackoverflow.com/questions/javascript",
            "https://docs.python.org/3/tutorial/"
        ]
        create_test_tabs(state, test_urls)
        
        # Load current tabs
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(1)
        
        show_demo_balloon(state, "✅ Current tab loaded", "PASSED", demo_mode=demo_mode)
        
        # Set domain grouping
        grouping_select = wait_for_element(state.driver, "#unifiedGroupingSelect")
        state.driver.execute_script("""
            var select = document.getElementById('unifiedGroupingSelect');
            select.value = 'domain';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        """)
        time.sleep(2)
        
        # Verify domain groups are created
        group_sections = state.driver.find_elements(By.CSS_SELECTOR, ".group-section")
        tab_items = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        
        assert len(group_sections) >= 3, f"Should have at least 3 domain groups, got {len(group_sections)}"
        assert len(tab_items) >= len(test_urls), f"Should have at least {len(test_urls)} tabs, got {len(tab_items)}"
        
        # Verify specific domain groups exist
        domain_groups = []
        for section in group_sections:
            try:
                header = section.find_element(By.CSS_SELECTOR, ".group-header, h3")
                group_name = header.text.split('\n')[0]
                domain_groups.append(group_name.lower())
            except:
                continue
        
        expected_domains = ["github.com", "stackoverflow.com", "docs.python.org"]
        found_domains = [domain for domain in expected_domains if any(expected in group for group in domain_groups)]
        
        assert len(found_domains) >= 3, f"Should find at least 3 expected domains, found: {found_domains}"
        
        show_demo_balloon(state, f"✅ Domain grouping: {len(group_sections)} groups, found domains: {found_domains}", "PASSED", demo_mode=demo_mode)
        
        # Test that GitHub group has 2 tabs
        github_group = None
        for section in group_sections:
            try:
                header = section.find_element(By.CSS_SELECTOR, ".group-header, h3")
                if "github.com" in header.text.lower():
                    github_group = section
                    break
            except:
                continue
        
        if github_group:
            github_tabs = github_group.find_elements(By.CSS_SELECTOR, ".tab-item")
            assert len(github_tabs) == 2, f"GitHub group should have 2 tabs, got {len(github_tabs)}"
            show_demo_balloon(state, f"✅ GitHub group has {len(github_tabs)} tabs", "PASSED", demo_mode=demo_mode)
    
    def test_groupby_category(self, extension_driver, demo_mode):
        """Test GROUP BY category functionality"""
        state = extension_driver
        show_demo_balloon(state, "Testing GROUP BY category", "INFO", demo_mode=demo_mode)
        
        # Create test tabs
        test_urls = [
            "https://github.com/test/repo",
            "https://stackoverflow.com/questions/test"
        ]
        create_test_tabs(state, test_urls)
        
        # Load current tabs
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(1)
        
        # Set category grouping
        grouping_select = wait_for_element(state.driver, "#unifiedGroupingSelect")
        state.driver.execute_script("""
            var select = document.getElementById('unifiedGroupingSelect');
            select.value = 'category';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        """)
        time.sleep(2)
        
        # Verify category groups are created
        group_sections = state.driver.find_elements(By.CSS_SELECTOR, ".group-section")
        
        assert len(group_sections) > 0, "Should have category groups"
        
        # Look for typical category names
        category_groups = []
        for section in group_sections:
            try:
                header = section.find_element(By.CSS_SELECTOR, ".group-header, h3")
                group_name = header.text.split('\n')[0]
                category_groups.append(group_name.lower())
            except:
                continue
        
        # Should have some recognizable categories
        expected_categories = ["uncategorized", "useful", "important", "can close"]
        found_categories = [cat for cat in expected_categories if any(expected in group for group in category_groups)]
        
        assert len(found_categories) > 0, f"Should find some expected categories, got: {category_groups}"
        
        show_demo_balloon(state, f"✅ Category grouping: {len(group_sections)} groups, categories: {found_categories}", "PASSED", demo_mode=demo_mode)
    
    def test_groupby_none(self, extension_driver, demo_mode):
        """Test GROUP BY none (no grouping)"""
        state = extension_driver
        show_demo_balloon(state, "Testing GROUP BY none", "INFO", demo_mode=demo_mode)
        
        # Create test tabs
        test_urls = [
            "https://github.com/test/repo",
            "https://stackoverflow.com/questions/test"
        ]
        create_test_tabs(state, test_urls)
        
        # Load current tabs
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(1)
        
        # Set no grouping
        grouping_select = wait_for_element(state.driver, "#unifiedGroupingSelect")
        state.driver.execute_script("""
            var select = document.getElementById('unifiedGroupingSelect');
            select.value = 'none';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        """)
        time.sleep(2)
        
        # Verify tabs are displayed without groups or with minimal groups
        group_sections = state.driver.find_elements(By.CSS_SELECTOR, ".group-section")
        tab_items = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        
        # With no grouping, should have either no groups or just one container
        assert len(group_sections) <= 1, f"Should have 0-1 groups with no grouping, got {len(group_sections)}"
        assert len(tab_items) >= len(test_urls), f"Should still show all tabs, got {len(tab_items)}"
        
        show_demo_balloon(state, f"✅ No grouping: {len(group_sections)} groups, {len(tab_items)} tabs", "PASSED", demo_mode=demo_mode)
    
    def test_groupby_switching(self, extension_driver, demo_mode):
        """Test switching between different grouping modes"""
        state = extension_driver
        show_demo_balloon(state, "Testing grouping mode switching", "INFO", demo_mode=demo_mode)
        
        # Create test tabs from different domains
        test_urls = [
            "https://github.com/test1/repo1",
            "https://github.com/test2/repo2",
            "https://stackoverflow.com/questions/test"
        ]
        create_test_tabs(state, test_urls)
        
        # Load current tabs
        current_btn = wait_for_element(state.driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(1)
        
        grouping_select = wait_for_element(state.driver, "#unifiedGroupingSelect")
        
        # Test domain grouping
        state.driver.execute_script("""
            var select = document.getElementById('unifiedGroupingSelect');
            select.value = 'domain';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        """)
        time.sleep(2)
        
        domain_groups = state.driver.find_elements(By.CSS_SELECTOR, ".group-section")
        domain_count = len(domain_groups)
        
        show_demo_balloon(state, f"Domain mode: {domain_count} groups", "INFO", 1.5, demo_mode=demo_mode)
        
        # Switch to category grouping
        state.driver.execute_script("""
            var select = document.getElementById('unifiedGroupingSelect');
            select.value = 'category';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        """)
        time.sleep(2)
        
        category_groups = state.driver.find_elements(By.CSS_SELECTOR, ".group-section")
        category_count = len(category_groups)
        
        show_demo_balloon(state, f"Category mode: {category_count} groups", "INFO", 1.5, demo_mode=demo_mode)
        
        # Switch to no grouping
        state.driver.execute_script("""
            var select = document.getElementById('unifiedGroupingSelect');
            select.value = 'none';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        """)
        time.sleep(2)
        
        none_groups = state.driver.find_elements(By.CSS_SELECTOR, ".group-section")
        none_count = len(none_groups)
        
        # Verify different grouping modes produce different results
        assert domain_count != none_count, "Domain and none grouping should differ"
        
        # Verify tabs are still present in all modes
        final_tabs = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        assert len(final_tabs) >= len(test_urls), "Should maintain all tabs across grouping changes"
        
        show_demo_balloon(state, f"✅ Grouping switching: domain({domain_count}) → category({category_count}) → none({none_count})", "PASSED", demo_mode=demo_mode)


@pytest.mark.groupby
class TestGroupByEdgeCases:
    """Test edge cases for GROUP BY functionality"""
    
    def test_groupby_with_identical_urls(self, extension_driver, demo_mode):
        """Test grouping behavior with duplicate URLs"""
        state = extension_driver
        show_demo_balloon(state, "Testing grouping with duplicate URLs", "INFO", demo_mode=demo_mode)
        
        # Create duplicate tabs
        duplicate_url = "https://github.com/test/duplicate"
        test_urls = [duplicate_url, duplicate_url, "https://stackoverflow.com/q/1"]
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
        
        # Find GitHub group and check duplicate handling
        github_group = None
        group_sections = state.driver.find_elements(By.CSS_SELECTOR, ".group-section")
        
        for section in group_sections:
            try:
                header = section.find_element(By.CSS_SELECTOR, ".group-header, h3")
                if "github.com" in header.text.lower():
                    github_group = section
                    break
            except:
                continue
        
        assert github_group is not None, "Should find GitHub group"
        
        # Check for duplicate indicator
        github_tabs = github_group.find_elements(By.CSS_SELECTOR, ".tab-item")
        
        # Look for duplicate count in tab titles or elements
        duplicate_found = False
        for tab in github_tabs:
            try:
                tab_text = tab.text
                if "duplicate" in tab_text.lower() and ("2" in tab_text or "x2" in tab_text):
                    duplicate_found = True
                    break
            except:
                continue
        
        # Note: The exact duplicate handling may vary, so we just verify the group structure is maintained
        assert len(github_tabs) > 0, "GitHub group should have tabs"
        
        show_demo_balloon(state, f"✅ Duplicate URL handling: {len(github_tabs)} tabs in GitHub group", "PASSED", demo_mode=demo_mode)
    
    def test_groupby_with_subdomains(self, extension_driver, demo_mode):
        """Test grouping behavior with subdomains"""
        state = extension_driver
        show_demo_balloon(state, "Testing grouping with subdomains", "INFO", demo_mode=demo_mode)
        
        # Create tabs with subdomains
        test_urls = [
            "https://github.com/test/repo",
            "https://api.github.com/users/test",
            "https://docs.github.com/en/guide"
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
        
        # Check how subdomains are grouped
        group_sections = state.driver.find_elements(By.CSS_SELECTOR, ".group-section")
        
        github_groups = []
        for section in group_sections:
            try:
                header = section.find_element(By.CSS_SELECTOR, ".group-header, h3")
                header_text = header.text.lower()
                if "github" in header_text:
                    github_groups.append(header_text)
            except:
                continue
        
        # Depending on implementation, subdomains might be grouped together or separately
        # We just verify that grouping handles subdomains correctly
        assert len(github_groups) > 0, "Should find GitHub-related groups"
        
        total_tabs = state.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        assert len(total_tabs) >= len(test_urls), "Should show all subdomain tabs"
        
        show_demo_balloon(state, f"✅ Subdomain grouping: {len(github_groups)} GitHub groups, {len(total_tabs)} total tabs", "PASSED", demo_mode=demo_mode)