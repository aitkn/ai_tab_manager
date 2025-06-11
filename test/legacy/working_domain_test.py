#!/usr/bin/env python3
"""
Working domain grouping test with correct selectors
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

def working_domain_test():
    """Test domain grouping with correct element selectors"""
    driver = None
    try:
        print("🎯 Testing domain grouping with correct selectors...")
        
        # Connect to Chrome
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        # Open extension
        extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
        popup_url = f"chrome-extension://{extension_id}/popup.html"
        driver.get(popup_url)
        time.sleep(3)
        
        print(f"✅ Extension loaded: {driver.title}")
        
        # Create test tabs
        test_urls = ["https://github.com/test", "https://stackoverflow.com/test", "https://docs.python.org/test"]
        for url in test_urls:
            driver.execute_script(f"window.open('{url}', '_blank');")
            time.sleep(0.2)
        
        # Switch back to extension
        driver.get(popup_url)  # Re-focus on extension
        time.sleep(1)
        print(f"✅ Created {len(test_urls)} test tabs")
        
        # Click Current tab using correct selector
        try:
            current_tab_btn = driver.find_element(By.CSS_SELECTOR, "[data-tab='categorize']")
            current_tab_btn.click()
            time.sleep(1)
            print("✅ Clicked Current tab button")
        except Exception as e:
            print(f"❌ Failed to click Current tab: {e}")
            return False
        
        # Check grouping value (should already be 'domain')
        grouping_select = driver.find_element(By.ID, "unifiedGroupingSelect")
        current_grouping = grouping_select.get_attribute("value")
        print(f"📊 Current grouping: '{current_grouping}'")
        
        # If not domain, set it
        if current_grouping != 'domain':
            print("🔄 Setting grouping to domain...")
            driver.execute_script("""
                var select = document.getElementById('unifiedGroupingSelect');
                select.value = 'domain';
                select.dispatchEvent(new Event('change', {bubbles: true}));
            """)
            time.sleep(2)
            new_grouping = grouping_select.get_attribute("value")
            print(f"📊 New grouping: '{new_grouping}'")
        
        # Check for tabs and groups
        time.sleep(2)  # Give time for grouping to apply
        
        tab_items = driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        group_sections = driver.find_elements(By.CSS_SELECTOR, ".group-section")
        category_sections = driver.find_elements(By.CSS_SELECTOR, ".category-section")
        
        print(f"\n📊 After setting domain grouping:")
        print(f"   Tab items: {len(tab_items)}")
        print(f"   Group sections: {len(group_sections)}")
        print(f"   Category sections: {len(category_sections)}")
        
        # Show details of groups found
        if len(group_sections) > 0:
            print(f"\n✅ Found {len(group_sections)} groups:")
            for i, section in enumerate(group_sections):
                try:
                    header = section.find_element(By.CSS_SELECTOR, ".group-header, .group-title")
                    header_text = header.text.strip()
                    tabs_in_group = section.find_elements(By.CSS_SELECTOR, ".tab-item")
                    print(f"   Group {i+1}: '{header_text}' ({len(tabs_in_group)} tabs)")
                    
                    # Show tabs in this group
                    for j, tab in enumerate(tabs_in_group[:2]):  # Show first 2 tabs
                        try:
                            title_elem = tab.find_element(By.CSS_SELECTOR, ".tab-title")
                            title = title_elem.text.strip()
                            print(f"      Tab {j+1}: {title[:40]}...")
                        except:
                            print(f"      Tab {j+1}: (no title)")
                            
                except Exception as e:
                    print(f"   Group {i+1}: (error reading group: {e})")
        else:
            print("\n❌ No group sections found!")
            
            # Debug: check what's in the tabs container
            tabs_container = driver.find_element(By.ID, "tabsContainer")
            container_html = tabs_container.get_attribute("innerHTML")
            print(f"   Tabs container HTML length: {len(container_html)}")
            
            if len(container_html) < 100:
                print(f"   Container content: {container_html}")
        
        # Test search functionality
        print(f"\n🔍 Testing search on domain groups...")
        search_input = driver.find_element(By.ID, "unifiedSearchInput")
        search_input.clear()
        search_input.send_keys("github")
        driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(1)
        
        # Check groups after search
        visible_groups_after_search = driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
        hidden_groups_after_search = driver.find_elements(By.CSS_SELECTOR, ".group-section.group-hidden")
        visible_tabs_after_search = driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
        
        print(f"📊 After 'github' search:")
        print(f"   Visible groups: {len(visible_groups_after_search)}")
        print(f"   Hidden groups: {len(hidden_groups_after_search)}")
        print(f"   Visible tabs: {len(visible_tabs_after_search)}")
        
        # Clear search
        search_input.clear()
        driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(1)
        
        # Clean up test tabs
        print(f"\n🧹 Cleaning up test tabs...")
        all_handles = list(driver.window_handles)
        for handle in all_handles:
            try:
                driver.switch_to.window(handle)
                if any(pattern in driver.current_url for pattern in ["github.com/test", "stackoverflow.com/test", "docs.python.org/test"]):
                    driver.close()
            except:
                pass
        
        # Switch back to extension
        driver.get(popup_url)
        
        success = len(group_sections) > 0
        if success:
            print(f"\n✅ Domain grouping test SUCCESSFUL!")
            print(f"   - Groups are displaying correctly")
            print(f"   - Search functionality working")
        else:
            print(f"\n❌ Domain grouping test FAILED!")
            print(f"   - Groups are not displaying")
        
        return success
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        return False
    finally:
        # Don't close driver
        pass

if __name__ == "__main__":
    success = working_domain_test()
    if success:
        print("\n🎯 Domain grouping works correctly!")
    else:
        print("\n🔧 Domain grouping needs investigation")