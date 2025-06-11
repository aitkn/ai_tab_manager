#!/usr/bin/env python3
"""
Debug the search issue focusing on timing and tab loading
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def debug_search_timing():
    """Debug search issue with focus on timing"""
    
    chrome_options = Options()
    chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    try:
        print("🔍 Debugging search timing issue...")
        
        # Create test tabs first
        test_urls = [
            "https://github.com/user1/repo1",
            "https://github.com/user2/repo2",
            "https://stackoverflow.com/questions/test"
        ]
        
        print(f"📝 Creating {len(test_urls)} test tabs...")
        initial_handles = set(driver.window_handles)
        
        for url in test_urls:
            driver.execute_script(f"window.open('{url}', '_blank');")
            time.sleep(0.5)
        
        # Wait for all tabs to be created
        WebDriverWait(driver, 10).until(lambda d: len(d.window_handles) == len(initial_handles) + len(test_urls))
        
        # Let tabs load for a bit
        print("⏳ Waiting for tabs to load...")
        time.sleep(2)
        
        # Open extension
        extension_url = "chrome-extension://fnklipkenfpdakdficiofcdejbiajgeh/popup.html"
        driver.get(extension_url)
        time.sleep(1)
        
        # Click Current tab to load tabs
        print("🔄 Loading current tabs...")
        current_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-tab='categorize']"))
        )
        current_btn.click()
        
        # Wait longer for tabs to load and be processed
        print("⏳ Waiting for tab processing...")
        time.sleep(5)
        
        # Set domain grouping
        print("📊 Setting domain grouping...")
        driver.execute_script("""
            var select = document.getElementById('unifiedGroupingSelect');
            if (select) {
                select.value = 'domain';
                select.dispatchEvent(new Event('change', {bubbles: true}));
            }
        """)
        
        # Wait for grouping to be applied
        print("⏳ Waiting for grouping to be applied...")
        time.sleep(3)
        
        def analyze_state(label):
            print(f"\n📊 {label}")
            
            all_tabs = driver.find_elements(By.CSS_SELECTOR, ".tab-item")
            all_groups = driver.find_elements(By.CSS_SELECTOR, ".group-section")
            
            print(f"   Total tabs: {len(all_tabs)}, Total groups: {len(all_groups)}")
            
            # Check each group
            github_tabs_count = 0
            github_visible_count = 0
            
            for i, group in enumerate(all_groups):
                try:
                    header = group.find_element(By.CSS_SELECTOR, ".group-header, h3")
                    header_text = header.text.strip()
                    
                    tabs_in_group = group.find_elements(By.CSS_SELECTOR, ".tab-item")
                    visible_tabs = group.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
                    
                    print(f"   Group {i+1}: '{header_text}' ({len(tabs_in_group)} total, {len(visible_tabs)} visible)")
                    
                    # Check if this is GitHub group
                    if "github.com" in header_text.lower():
                        github_tabs_count = len(tabs_in_group)
                        github_visible_count = len(visible_tabs)
                        
                        print(f"      >>> This is the GitHub group <<<")
                        
                        # Check each tab in detail
                        for j, tab in enumerate(tabs_in_group):
                            try:
                                title_elem = tab.find_element(By.CSS_SELECTOR, ".tab-title")
                                url_elem = tab.find_element(By.CSS_SELECTOR, ".tab-url")
                                tab_classes = tab.get_attribute("class")
                                
                                title_text = title_elem.text.strip()
                                url_text = url_elem.text.strip()
                                is_hidden = "hidden" in tab_classes
                                
                                print(f"         Tab {j+1}: '{title_text}' ({'HIDDEN' if is_hidden else 'VISIBLE'})")
                                print(f"                  URL: '{url_text}'")
                                print(f"                  Classes: {tab_classes}")
                                
                                if title_text or url_text:
                                    searchable_text = f"{title_text} {url_text}".lower()
                                    matches_github = "github" in searchable_text
                                    print(f"                  Matches 'github': {matches_github}")
                                else:
                                    print(f"                  ⚠️ Tab has no title or URL!")
                                    
                            except Exception as e:
                                print(f"         Tab {j+1}: Error reading - {e}")
                    
                except Exception as e:
                    print(f"   Group {i+1}: Error reading - {e}")
            
            return github_tabs_count, github_visible_count
        
        # Analyze state before search
        github_total, github_visible = analyze_state("State BEFORE search")
        
        # Apply search
        print("\n🔍 Applying search for 'github'...")
        search_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "#unifiedSearchInput"))
        )
        search_input.clear()
        search_input.send_keys("github")
        
        # Trigger the input event and wait
        driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        
        print("⏳ Waiting for search to process...")
        time.sleep(2)
        
        # Analyze state after search
        github_total_after, github_visible_after = analyze_state("State AFTER search")
        
        # Summary
        print(f"\n📊 TIMING ANALYSIS SUMMARY:")
        print(f"   Before search: {github_total} GitHub tabs, {github_visible} visible")
        print(f"   After search:  {github_total_after} GitHub tabs, {github_visible_after} visible")
        
        if github_visible_after < 2:
            print(f"   ❌ BUG CONFIRMED: Expected 2 visible GitHub tabs, got {github_visible_after}")
            
            # Additional debugging - check if tabs are being filtered incorrectly
            print("\n🔍 Additional debugging...")
            
            # Try to find the exact selector the test uses
            github_group = None
            all_groups = driver.find_elements(By.CSS_SELECTOR, ".group-section")
            for group in all_groups:
                try:
                    header = group.find_element(By.CSS_SELECTOR, ".group-header, h3")
                    if "github.com" in header.text.lower():
                        github_group = group
                        break
                except:
                    pass
            
            if github_group:
                test_selector_tabs = github_group.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
                print(f"   Test selector (.tab-item:not(.hidden)) finds: {len(test_selector_tabs)} tabs")
                
                # Check what exactly is being filtered
                all_github_tabs = github_group.find_elements(By.CSS_SELECTOR, ".tab-item")
                hidden_github_tabs = github_group.find_elements(By.CSS_SELECTOR, ".tab-item.hidden")
                
                print(f"   All GitHub tabs: {len(all_github_tabs)}")
                print(f"   Hidden GitHub tabs: {len(hidden_github_tabs)}")
                print(f"   Visible (calculated): {len(all_github_tabs) - len(hidden_github_tabs)}")
                
                # Check each hidden tab to see why it's hidden
                for j, tab in enumerate(hidden_github_tabs):
                    try:
                        title_elem = tab.find_element(By.CSS_SELECTOR, ".tab-title")
                        url_elem = tab.find_element(By.CSS_SELECTOR, ".tab-url")
                        title_text = title_elem.text.strip()
                        url_text = url_elem.text.strip()
                        
                        print(f"   Hidden tab {j+1}: '{title_text}' - '{url_text}'")
                        
                        # Check if this SHOULD match github search
                        searchable = f"{title_text} {url_text}".lower()
                        should_match = "github" in searchable
                        print(f"      Should match 'github': {should_match} (searchable: '{searchable}')")
                        
                    except Exception as e:
                        print(f"   Hidden tab {j+1}: Error reading - {e}")
        else:
            print(f"   ✅ No bug found: {github_visible_after} GitHub tabs visible as expected")
        
    except Exception as e:
        print(f"❌ Error during debug: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Clean up
        try:
            current_handles = set(driver.window_handles)
            for handle in current_handles:
                try:
                    driver.switch_to.window(handle)
                    if any(url in driver.current_url for url in test_urls):
                        driver.close()
                except:
                    pass
        except:
            pass

if __name__ == "__main__":
    debug_search_timing()