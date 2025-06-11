#!/usr/bin/env python3
"""
Detailed debug of the search issue using the existing test infrastructure
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def debug_search_detailed():
    """Debug the search issue in detail"""
    
    # Connect to running Chrome instance with extension
    chrome_options = Options()
    chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    try:
        print("🔍 Starting detailed search debug...")
        
        # Create test tabs
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
        print(f"✅ Created {len(test_urls)} tabs")
        
        # Open extension
        extension_url = "chrome-extension://fnklipkenfpdakdficiofcdejbiajgeh/popup.html"
        driver.get(extension_url)
        time.sleep(2)
        
        print("🎯 Extension loaded")
        
        # Click Current tab to load tabs
        print("🔄 Loading current tabs...")
        current_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-tab='categorize']"))
        )
        current_btn.click()
        time.sleep(3)  # Wait longer for tabs to load
        
        # Set domain grouping
        print("📊 Setting domain grouping...")
        driver.execute_script("""
            var select = document.getElementById('unifiedGroupingSelect');
            if (select) {
                console.log('Setting domain grouping...');
                select.value = 'domain';
                select.dispatchEvent(new Event('change', {bubbles: true}));
            } else {
                console.log('Grouping select not found!');
            }
        """)
        time.sleep(3)  # Wait longer for grouping to apply
        
        # Debug: Check current state before search
        print("🔍 Analyzing state before search...")
        
        # Count all tabs and groups
        all_tabs = driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        all_groups = driver.find_elements(By.CSS_SELECTOR, ".group-section")
        
        print(f"📊 Found {len(all_tabs)} total tabs in {len(all_groups)} groups")
        
        # Analyze each group in detail
        for i, group in enumerate(all_groups):
            try:
                header = group.find_element(By.CSS_SELECTOR, ".group-header, h3")
                header_text = header.text
                tabs_in_group = group.find_elements(By.CSS_SELECTOR, ".tab-item")
                
                print(f"   📁 Group {i+1}: {header_text} ({len(tabs_in_group)} tabs)")
                
                for j, tab in enumerate(tabs_in_group):
                    try:
                        title_elem = tab.find_element(By.CSS_SELECTOR, ".tab-title")
                        url_elem = tab.find_element(By.CSS_SELECTOR, ".tab-url")
                        tab_classes = tab.get_attribute("class")
                        
                        print(f"      🔗 Tab {j+1}: {title_elem.text}")
                        print(f"         URL: {url_elem.text}")
                        print(f"         Classes: {tab_classes}")
                        
                    except Exception as e:
                        print(f"      ❌ Tab {j+1}: Error reading tab - {e}")
                        
            except Exception as e:
                print(f"   ❌ Group {i+1}: Error reading group - {e}")
        
        # Apply search for "github"
        print("\n🔍 Applying search for 'github'...")
        search_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "#unifiedSearchInput"))
        )
        search_input.clear()
        search_input.send_keys("github")
        
        # Trigger the input event
        driver.execute_script("""
            var input = arguments[0];
            input.dispatchEvent(new Event('input', {bubbles: true}));
            console.log('Search input event triggered for: ' + input.value);
        """, search_input)
        
        time.sleep(2)  # Wait for search to process
        
        # Debug: Check state after search
        print("\n📊 Analyzing state after search...")
        
        # Re-find groups after search
        all_groups_after = driver.find_elements(By.CSS_SELECTOR, ".group-section")
        visible_groups = driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
        hidden_groups = driver.find_elements(By.CSS_SELECTOR, ".group-section.group-hidden")
        
        print(f"📊 After search: {len(all_groups_after)} total groups, {len(visible_groups)} visible, {len(hidden_groups)} hidden")
        
        # Analyze visible groups
        for i, group in enumerate(visible_groups):
            try:
                header = group.find_element(By.CSS_SELECTOR, ".group-header, h3")
                header_text = header.text
                
                all_tabs_in_group = group.find_elements(By.CSS_SELECTOR, ".tab-item")
                visible_tabs_in_group = group.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
                hidden_tabs_in_group = group.find_elements(By.CSS_SELECTOR, ".tab-item.hidden")
                
                print(f"   ✅ Visible Group {i+1}: {header_text}")
                print(f"      Total tabs: {len(all_tabs_in_group)}, Visible: {len(visible_tabs_in_group)}, Hidden: {len(hidden_tabs_in_group)}")
                
                # Check each tab in detail
                for j, tab in enumerate(all_tabs_in_group):
                    try:
                        title_elem = tab.find_element(By.CSS_SELECTOR, ".tab-title")
                        url_elem = tab.find_element(By.CSS_SELECTOR, ".tab-url")
                        tab_classes = tab.get_attribute("class")
                        is_hidden = "hidden" in tab_classes
                        
                        status = "HIDDEN" if is_hidden else "VISIBLE"
                        print(f"         🔗 Tab {j+1}: {title_elem.text} [{status}]")
                        print(f"            URL: {url_elem.text}")
                        print(f"            Classes: {tab_classes}")
                        
                        # Check why it might be hidden
                        if is_hidden:
                            # Get the actual text content for search matching
                            tab_text = f"{title_elem.text} {url_elem.text}".lower()
                            matches_github = "github" in tab_text
                            print(f"            Matches 'github': {matches_github}")
                            print(f"            Searchable text: {tab_text}")
                        
                    except Exception as e:
                        print(f"         ❌ Tab {j+1}: Error reading tab - {e}")
                        
            except Exception as e:
                print(f"   ❌ Visible Group {i+1}: Error reading group - {e}")
        
        # Also check hidden groups to see what's there
        print(f"\n🙈 Checking {len(hidden_groups)} hidden groups...")
        for i, group in enumerate(hidden_groups):
            try:
                header = group.find_element(By.CSS_SELECTOR, ".group-header, h3")
                header_text = header.text
                tabs_count = len(group.find_elements(By.CSS_SELECTOR, ".tab-item"))
                print(f"   🙈 Hidden Group {i+1}: {header_text} ({tabs_count} tabs)")
            except Exception as e:
                print(f"   ❌ Hidden Group {i+1}: Error reading group - {e}")
        
        # Final check: specifically look for github tabs
        print(f"\n🔍 Final GitHub tab analysis...")
        all_github_tabs = []
        
        for group in all_groups_after:
            try:
                header = group.find_element(By.CSS_SELECTOR, ".group-header, h3")
                if "github.com" in header.text.lower():
                    github_tabs = group.find_elements(By.CSS_SELECTOR, ".tab-item")
                    all_github_tabs.extend(github_tabs)
                    
                    print(f"   📁 Found GitHub group: {header.text}")
                    print(f"      Contains {len(github_tabs)} tabs")
                    
                    for j, tab in enumerate(github_tabs):
                        try:
                            title_elem = tab.find_element(By.CSS_SELECTOR, ".tab-title")
                            url_elem = tab.find_element(By.CSS_SELECTOR, ".tab-url")
                            tab_classes = tab.get_attribute("class")
                            is_hidden = "hidden" in tab_classes
                            
                            print(f"         Tab {j+1}: {title_elem.text} ({'HIDDEN' if is_hidden else 'VISIBLE'})")
                            print(f"                   {url_elem.text}")
                            
                        except Exception as e:
                            print(f"         Tab {j+1}: Error - {e}")
            except:
                pass
        
        print(f"\n📊 SUMMARY:")
        print(f"   - Expected 2 GitHub tabs to be visible after search")
        print(f"   - Found {len(all_github_tabs)} total GitHub tabs")
        visible_github = [t for t in all_github_tabs if "hidden" not in t.get_attribute("class")]
        print(f"   - {len(visible_github)} GitHub tabs are visible")
        
        if len(visible_github) < 2:
            print(f"   ❌ BUG CONFIRMED: Only {len(visible_github)} GitHub tabs visible, expected 2")
        else:
            print(f"   ✅ No bug found: {len(visible_github)} GitHub tabs visible as expected")
        
        print("\n✅ Debug complete - check output above for details")
        
    except Exception as e:
        print(f"❌ Error during debug: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Clean up test tabs
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
        
        print("🧹 Cleanup complete")

if __name__ == "__main__":
    debug_search_detailed()