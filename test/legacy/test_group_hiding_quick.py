#!/usr/bin/env python3
"""
Quick test to verify GROUP BY + search group hiding works correctly
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from test_base import ExtensionTestBase

class QuickGroupHidingTest(ExtensionTestBase):
    def __init__(self):
        super().__init__()
        self.test_name = "Quick Group Hiding Test"
        self.extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
    
    def setup_chrome(self):
        try:
            chrome_options = Options()
            chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            return True
        except Exception as e:
            print(f"Connection failed: {e}")
            return False
    
    def test_group_hiding(self):
        """Quick test of group hiding functionality"""
        try:
            print("🧪 Testing group hiding after search fixes...")
            
            # Step 1: Access extension
            popup_url = f"chrome-extension://{self.extension_id}/popup.html"
            self.driver.get(popup_url)
            time.sleep(2)
            print("✅ Extension loaded")
            
            # Step 2: Create a couple test tabs
            test_urls = ["https://github.com/test", "https://stackoverflow.com/test"]
            for url in test_urls:
                self.driver.execute_script(f"window.open('{url}', '_blank');")
                time.sleep(0.2)
            
            # Switch back to extension
            for handle in self.driver.window_handles:
                self.driver.switch_to.window(handle)
                if self.extension_id in self.driver.current_url:
                    break
            
            print(f"✅ Created {len(test_urls)} test tabs")
            
            # Step 3: Go to Current tabs and set Domain grouping
            current_tab_btn = self.driver.find_element(By.ID, "currentTabBtn")
            current_tab_btn.click()
            time.sleep(0.5)
            
            grouping_select = self.driver.find_element(By.ID, "unifiedGroupingSelect")
            self.driver.execute_script("arguments[0].value = 'domain'; arguments[0].dispatchEvent(new Event('change', {bubbles: true}));", grouping_select)
            time.sleep(0.5)
            print("✅ Set to Domain grouping")
            
            # Step 4: Count initial groups
            initial_groups = self.driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
            print(f"📊 Initial visible groups: {len(initial_groups)}")
            
            # Step 5: Perform search that should hide some groups
            search_input = self.driver.find_element(By.ID, "unifiedSearchInput")
            search_input.clear()
            search_input.send_keys("github")
            self.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
            time.sleep(0.5)
            print("✅ Performed 'github' search")
            
            # Step 6: Count groups after search
            visible_groups = self.driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
            hidden_groups = self.driver.find_elements(By.CSS_SELECTOR, ".group-section.group-hidden")
            
            print(f"📊 After search:")
            print(f"   - Visible groups: {len(visible_groups)}")
            print(f"   - Hidden groups: {len(hidden_groups)}")
            
            # Step 7: Check visible tab count
            visible_tabs = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
            print(f"   - Visible tabs: {len(visible_tabs)}")
            
            # Step 8: Clear search and verify restoration
            search_input.clear()
            self.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
            time.sleep(0.5)
            
            restored_groups = self.driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
            print(f"📊 After clearing search: {len(restored_groups)} visible groups")
            
            # Results
            print("\n🎯 Test Results:")
            if len(hidden_groups) > 0:
                print(f"✅ SUCCESS: {len(hidden_groups)} groups properly hidden during search")
            else:
                print("❌ ISSUE: No groups were hidden during search")
            
            if len(restored_groups) >= len(initial_groups):
                print("✅ SUCCESS: Groups properly restored after clearing search")
            else:
                print("❌ ISSUE: Groups not properly restored after clearing search")
            
            # Cleanup test tabs
            for handle in self.driver.window_handles:
                try:
                    self.driver.switch_to.window(handle)
                    if any(url in self.driver.current_url for url in ["github.com/test", "stackoverflow.com/test"]):
                        self.driver.close()
                except:
                    pass
            
            return len(hidden_groups) > 0
            
        except Exception as e:
            print(f"❌ Test error: {e}")
            return False

def main():
    test = QuickGroupHidingTest()
    try:
        if not test.setup_chrome():
            return 1
        
        success = test.test_group_hiding()
        return 0 if success else 1
    finally:
        test.cleanup()

if __name__ == "__main__":
    exit(main())