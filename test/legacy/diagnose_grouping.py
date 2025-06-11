#!/usr/bin/env python3
"""
Diagnostic test to understand why domain grouping shows 0 groups
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

def diagnose_grouping():
    """Diagnose domain grouping issue"""
    driver = None
    try:
        print("🔍 Diagnosing domain grouping issue...")
        
        # Connect to Chrome
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        # Record initial tabs before we create anything
        initial_handles = set(driver.window_handles)
        print(f"📊 Initial browser tabs: {len(initial_handles)}")
        
        # Open extension in a NEW tab (don't use existing tab)
        extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
        popup_url = f"chrome-extension://{extension_id}/popup.html"
        driver.execute_script(f"window.open('{popup_url}', '_blank');")
        time.sleep(2)
        
        # Switch to the extension tab
        extension_handle = None
        for handle in driver.window_handles:
            driver.switch_to.window(handle)
            if extension_id in driver.current_url:
                extension_handle = handle
                break
        
        if not extension_handle:
            print("❌ Could not find extension tab")
            return False
        
        print("✅ Extension opened in new tab")
        
        # Create test tabs
        test_urls = ["https://github.com/test", "https://stackoverflow.com/test"]
        for url in test_urls:
            driver.execute_script(f"window.open('{url}', '_blank');")
            time.sleep(0.3)
        
        # IMPORTANT: Switch back to extension tab
        driver.switch_to.window(extension_handle)
        print(f"✅ Created {len(test_urls)} test tabs and switched back to extension")
        
        # Go to Current tabs
        current_tab_btn = driver.find_element(By.ID, "currentTabBtn")
        current_tab_btn.click()
        time.sleep(1)
        print("✅ Switched to Current tab")
        
        # Check initial display mode
        print("\n📊 INITIAL STATE:")
        tabs_container = driver.find_element(By.CLASS_NAME, "tabs-container")
        print(f"   Container HTML length: {len(tabs_container.get_attribute('innerHTML'))}")
        
        # Check for different display elements
        category_sections = driver.find_elements(By.CSS_SELECTOR, ".category-section")
        group_sections = driver.find_elements(By.CSS_SELECTOR, ".group-section")
        tab_items = driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        
        print(f"   Category sections: {len(category_sections)}")
        print(f"   Group sections: {len(group_sections)}")
        print(f"   Tab items: {len(tab_items)}")
        
        # Check grouping select value
        grouping_select = driver.find_element(By.ID, "unifiedGroupingSelect")
        current_value = grouping_select.get_attribute("value")
        print(f"   Current grouping: '{current_value}'")
        
        # Set to domain grouping
        print("\n🔄 SWITCHING TO DOMAIN GROUPING:")
        driver.execute_script("""
            var select = document.getElementById('unifiedGroupingSelect');
            select.value = 'domain';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        """)
        time.sleep(2)
        
        # Check state after switching
        new_value = grouping_select.get_attribute("value")
        print(f"   New grouping value: '{new_value}'")
        
        # Re-check elements
        category_sections_after = driver.find_elements(By.CSS_SELECTOR, ".category-section")
        group_sections_after = driver.find_elements(By.CSS_SELECTOR, ".group-section")
        tab_items_after = driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        
        print(f"   Category sections after: {len(category_sections_after)}")
        print(f"   Group sections after: {len(group_sections_after)}")
        print(f"   Tab items after: {len(tab_items_after)}")
        
        # Check for any group headers
        group_headers = driver.find_elements(By.CSS_SELECTOR, ".group-header")
        group_titles = driver.find_elements(By.CSS_SELECTOR, ".group-title")
        print(f"   Group headers: {len(group_headers)}")
        print(f"   Group titles: {len(group_titles)}")
        
        # Check console logs (if available)
        try:
            logs = driver.get_log('browser')
            console_messages = [log['message'] for log in logs if 'TAB DISPLAY' in log.get('message', '')]
            if console_messages:
                print(f"\n📝 CONSOLE LOGS ({len(console_messages)} messages):")
                for msg in console_messages[-5:]:  # Show last 5
                    print(f"   {msg}")
        except:
            print("   (Console logs not available)")
        
        # Check if tabs container content changed
        new_container_html = tabs_container.get_attribute('innerHTML')
        print(f"\n📊 AFTER GROUPING CHANGE:")
        print(f"   Container HTML length: {len(new_container_html)}")
        
        # Look for specific elements that should be there
        if len(group_sections_after) == 0:
            print("❌ ISSUE: No group sections found after switching to domain grouping")
            
            # Check if there are any elements with 'group' in class name
            all_group_elements = driver.find_elements(By.CSS_SELECTOR, "[class*='group']")
            print(f"   Elements with 'group' in class: {len(all_group_elements)}")
            
            # Check page source for any 'Total:' text
            page_source = driver.page_source
            total_count = page_source.count("Total:")
            print(f"   'Total:' occurrences in page: {total_count}")
            
        else:
            print(f"✅ Found {len(group_sections_after)} group sections")
            for i, section in enumerate(group_sections_after[:3]):  # Show first 3
                try:
                    header_text = section.find_element(By.CSS_SELECTOR, ".group-header, .group-title").text
                    print(f"   Group {i+1}: {header_text[:50]}...")
                except:
                    print(f"   Group {i+1}: (no header text)")
        
        # Test search to see if it works
        print("\n🔍 TESTING SEARCH:")
        search_input = driver.find_element(By.ID, "unifiedSearchInput")
        search_input.send_keys("github")
        driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(1)
        
        # Check tabs after search
        visible_tabs_after_search = driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
        print(f"   Visible tabs after search: {len(visible_tabs_after_search)}")
        
        # Clean up test tabs but preserve original tabs
        print("\n🧹 Cleaning up...")
        current_handles = set(driver.window_handles)
        tabs_to_close = current_handles - initial_handles  # Only close new tabs
        
        for handle in tabs_to_close:
            try:
                driver.switch_to.window(handle)
                current_url = driver.current_url
                # Close test tabs and extension popup, but not original browser tabs
                if (any(pattern in current_url for pattern in ["github.com/test", "stackoverflow.com/test"]) or 
                    (extension_id in current_url and "popup.html" in current_url)):
                    print(f"🗑️  Closing: {current_url[:50]}...")
                    driver.close()
            except:
                pass
        
        print("✅ Cleanup complete - original tabs preserved")
        
        return True
        
    except Exception as e:
        print(f"❌ Diagnostic error: {e}")
        return False
    finally:
        # Don't close driver - just disconnect to preserve browser state
        pass

if __name__ == "__main__":
    success = diagnose_grouping()
    if success:
        print("\n🎯 Diagnostic complete!")
    else:
        print("\n❌ Diagnostic failed")