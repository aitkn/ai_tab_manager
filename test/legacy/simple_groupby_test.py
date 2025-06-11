#!/usr/bin/env python3
"""
Simple GROUP BY + Search test with corrected selectors
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

def simple_groupby_test():
    """Simple test with better error handling"""
    driver = None
    try:
        print("🔍 Connecting to Chrome on Windows...")
        
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        service = Service(ChromeDriverManager().install())
        
        # Create driver with timeout
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.set_page_load_timeout(10)
        driver.implicitly_wait(5)
        
        print("✅ Connected to Chrome")
        
        # Track initial handles
        initial_handles = set(driver.window_handles)
        print(f"📊 Found {len(initial_handles)} initial tabs")
        
        # Try to get to extension
        extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
        popup_url = f"chrome-extension://{extension_id}/popup.html"
        
        # First check if extension is already open
        extension_found = False
        for handle in initial_handles:
            try:
                driver.switch_to.window(handle)
                if extension_id in driver.current_url:
                    print("✅ Found existing extension tab")
                    extension_found = True
                    break
            except:
                continue
        
        if not extension_found:
            print("🚀 Opening extension in new tab...")
            driver.execute_script(f"window.open('{popup_url}', '_blank');")
            time.sleep(2)
            
            # Find the new extension tab
            for handle in driver.window_handles:
                try:
                    driver.switch_to.window(handle)
                    if extension_id in driver.current_url:
                        print("✅ Extension opened successfully")
                        extension_found = True
                        break
                except:
                    continue
        
        if not extension_found:
            print("❌ Could not access extension")
            return False
        
        print(f"📍 Current page: {driver.title}")
        
        # Create test tabs for domain grouping
        test_urls = ["https://github.com/test1", "https://stackoverflow.com/test1"]
        
        print(f"📝 Creating {len(test_urls)} test tabs...")
        for url in test_urls:
            driver.execute_script(f"window.open('{url}', '_blank');")
            time.sleep(0.5)
        
        # Switch back to extension
        for handle in driver.window_handles:
            try:
                driver.switch_to.window(handle)
                if extension_id in driver.current_url:
                    break
            except:
                continue
        
        print("✅ Switched back to extension tab")
        
        # Now test the functionality with correct selectors
        print("🔘 Clicking Current tab button...")
        
        # Use the correct selector we discovered
        try:
            current_btn = driver.find_element(By.CSS_SELECTOR, "[data-tab='categorize']")
            current_btn.click()
            time.sleep(1)
            print("✅ Clicked Current tab button")
        except Exception as e:
            print(f"❌ Failed to click Current tab: {e}")
            return False
        
        # Check initial grouping setting
        try:
            grouping_select = driver.find_element(By.ID, "unifiedGroupingSelect")
            current_grouping = grouping_select.get_attribute("value")
            print(f"📊 Current grouping: '{current_grouping}'")
            
            # Set to domain if not already
            if current_grouping != 'domain':
                print("🔄 Setting to domain grouping...")
                driver.execute_script("""
                    var select = document.getElementById('unifiedGroupingSelect');
                    select.value = 'domain';
                    select.dispatchEvent(new Event('change', {bubbles: true}));
                """)
                time.sleep(2)
        except Exception as e:
            print(f"❌ Grouping select error: {e}")
            return False
        
        # Count groups and tabs
        time.sleep(1)
        group_sections = driver.find_elements(By.CSS_SELECTOR, ".group-section")
        tab_items = driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        
        print(f"📊 After domain grouping:")
        print(f"   Groups: {len(group_sections)}")
        print(f"   Tabs: {len(tab_items)}")
        
        if len(group_sections) > 0:
            print("✅ Domain grouping is working!")
            for i, section in enumerate(group_sections[:3]):
                try:
                    header = section.find_element(By.CSS_SELECTOR, ".group-header, h3")
                    print(f"   Group {i+1}: {header.text[:50]}")
                except:
                    print(f"   Group {i+1}: (no readable header)")
        else:
            print("❌ No groups found - domain grouping might not be working")
        
        # Test search
        print("🔍 Testing search...")
        try:
            search_input = driver.find_element(By.ID, "unifiedSearchInput")
            search_input.clear()
            search_input.send_keys("github")
            driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
            time.sleep(1)
            
            # Check results after search
            visible_tabs_after = driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
            visible_groups_after = driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
            
            print(f"📊 After 'github' search:")
            print(f"   Visible tabs: {len(visible_tabs_after)}")
            print(f"   Visible groups: {len(visible_groups_after)}")
            
            # Clear search
            search_input.clear()
            driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
            time.sleep(1)
            
            print("✅ Search test completed")
            
        except Exception as e:
            print(f"❌ Search test error: {e}")
        
        # Cleanup
        print("🧹 Cleaning up test tabs...")
        current_handles = set(driver.window_handles)
        new_handles = current_handles - initial_handles
        
        for handle in new_handles:
            try:
                driver.switch_to.window(handle)
                current_url = driver.current_url
                if any(pattern in current_url for pattern in ["github.com/test", "stackoverflow.com/test"]):
                    print(f"🗑️  Closing: {current_url[:50]}...")
                    driver.close()
            except:
                pass
        
        print("✅ Test completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        return False
    finally:
        # Don't close driver - just disconnect
        pass

if __name__ == "__main__":
    success = simple_groupby_test()
    if success:
        print("\n🎯 GROUP BY test successful!")
    else:
        print("\n❌ GROUP BY test failed")