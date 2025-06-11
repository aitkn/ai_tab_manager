#!/usr/bin/env python3
"""
Fixed debug - properly track extension tab without switching away
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

def fixed_debug():
    """Properly debug extension opening"""
    driver = None
    try:
        print("🔍 Fixed debug - proper tab management...")
        
        # Connect to Chrome
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        initial_handles = set(driver.window_handles)
        print(f"📊 Initial tabs: {len(initial_handles)}")
        
        # Open extension in current tab
        extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
        popup_url = f"chrome-extension://{extension_id}/popup.html"
        
        print(f"🚀 Opening extension: {popup_url}")
        current_handle = driver.current_window_handle
        driver.get(popup_url)
        time.sleep(3)
        
        # Check if we're on the extension tab NOW (without switching away)
        current_url = driver.current_url
        current_title = driver.title
        print(f"📍 Current tab after opening: {current_title} - {current_url}")
        
        if extension_id in current_url:
            print("✅ Extension successfully opened and we're on it!")
            
            # Test the extension functionality while we're on it
            try:
                # Try to find Current tab button
                current_tab_btn = driver.find_element(By.ID, "currentTabBtn")
                print("✅ Found Current tab button")
                
                current_tab_btn.click()
                time.sleep(1)
                print("✅ Clicked Current tab")
                
                # Check for grouping select
                grouping_select = driver.find_element(By.ID, "unifiedGroupingSelect")
                current_grouping = grouping_select.get_attribute("value")
                print(f"📊 Current grouping: {current_grouping}")
                
                # Check for tab elements
                tab_items = driver.find_elements(By.CSS_SELECTOR, ".tab-item")
                category_sections = driver.find_elements(By.CSS_SELECTOR, ".category-section")
                group_sections = driver.find_elements(By.CSS_SELECTOR, ".group-section")
                
                print(f"📊 Extension state:")
                print(f"   Tab items: {len(tab_items)}")
                print(f"   Category sections: {len(category_sections)}")
                print(f"   Group sections: {len(group_sections)}")
                
                # Now test switching to domain grouping
                print(f"\n🔄 Testing domain grouping switch...")
                driver.execute_script("""
                    var select = document.getElementById('unifiedGroupingSelect');
                    console.log('Before switch:', select.value);
                    select.value = 'domain';
                    select.dispatchEvent(new Event('change', {bubbles: true}));
                    console.log('After switch:', select.value);
                """)
                time.sleep(2)
                
                # Check state after switch
                new_grouping = grouping_select.get_attribute("value")
                print(f"📊 New grouping: {new_grouping}")
                
                # Check elements after switch
                tab_items_after = driver.find_elements(By.CSS_SELECTOR, ".tab-item")
                category_sections_after = driver.find_elements(By.CSS_SELECTOR, ".category-section")
                group_sections_after = driver.find_elements(By.CSS_SELECTOR, ".group-section")
                
                print(f"📊 After domain grouping:")
                print(f"   Tab items: {len(tab_items_after)}")
                print(f"   Category sections: {len(category_sections_after)}")
                print(f"   Group sections: {len(group_sections_after)}")
                
                if len(group_sections_after) > 0:
                    print("✅ Domain grouping working - groups found!")
                    for i, section in enumerate(group_sections_after[:3]):
                        try:
                            header = section.find_element(By.CSS_SELECTOR, ".group-header, .group-title")
                            print(f"   Group {i+1}: {header.text[:50]}")
                        except:
                            print(f"   Group {i+1}: (no header)")
                else:
                    print("❌ Domain grouping issue - no groups found")
                
            except Exception as e:
                print(f"❌ Extension functionality error: {e}")
            
            return True
        else:
            print(f"❌ Extension not opened correctly. Current URL: {current_url}")
            return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    finally:
        # Don't close anything - just disconnect
        pass

if __name__ == "__main__":
    success = fixed_debug()
    if success:
        print("\n🎯 Extension debugging successful!")
    else:
        print("\n❌ Extension debugging failed")