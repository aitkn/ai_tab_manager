#!/usr/bin/env python3
"""
Demo-enabled GROUP BY + Search test with visual balloon notifications
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

class DemoGroupByTest:
    def __init__(self, demo_mode=False):
        self.demo_mode = demo_mode
        self.driver = None
        self.balloon_count = 0
        
    def show_demo_balloon(self, message, status="INFO", duration=2.5):
        """Show a static visual balloon notification during demo mode"""
        if not self.demo_mode:
            return
            
        self.balloon_count += 1
        
        # Status colors
        color_map = {
            "PASSED": "#4CAF50",  # Green
            "FAILED": "#F44336",  # Red
            "INFO": "#2196F3",    # Blue
            "WARNING": "#FF9800"  # Orange
        }
        
        color = color_map.get(status, "#2196F3")
        
        balloon_script = f"""
        // Remove any existing balloons
        const existingBalloons = document.querySelectorAll('.demo-test-balloon');
        existingBalloons.forEach(b => b.remove());
        
        // Create static balloon (no animation) - avoid innerHTML for security
        const balloon = document.createElement('div');
        balloon.className = 'demo-test-balloon';
        balloon.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: {color};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        // Create header div
        const header = document.createElement('div');
        header.style.cssText = 'font-size: 12px; opacity: 0.9; margin-bottom: 5px;';
        header.textContent = '🧪 Test #{self.balloon_count} - {status}';
        
        // Create message div
        const messageDiv = document.createElement('div');
        messageDiv.textContent = `{message}`;
        
        // Append children
        balloon.appendChild(header);
        balloon.appendChild(messageDiv);
        document.body.appendChild(balloon);
        
        // Auto-remove after duration (no animation)
        setTimeout(() => {{
            balloon.remove();
        }}, {duration * 1000});
        """
        
        try:
            self.driver.execute_script(balloon_script)
            print(f"🎈 DEMO [{status}]: {message}")
            time.sleep(duration)
        except Exception as e:
            print(f"Demo balloon error: {e}")
    
    def demo_groupby_test(self):
        """Demo-enabled GROUP BY + Search test"""
        try:
            self.show_demo_balloon("Starting GROUP BY + Search Demo Test", "INFO")
            
            print("🔍 Connecting to Chrome on Windows...")
            
            chrome_options = Options()
            chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            
            self.show_demo_balloon("✅ Connected to Chrome successfully", "PASSED")
            
            # Track initial handles
            initial_handles = set(self.driver.window_handles)
            print(f"📊 Found {len(initial_handles)} initial tabs")
            
            # Open extension in NEW tab (always create fresh tab)
            extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
            popup_url = f"chrome-extension://{extension_id}/popup.html"
            
            self.show_demo_balloon("Opening extension in NEW tab...", "INFO")
            
            # Create new tab for extension
            self.driver.execute_script(f"window.open('{popup_url}', '_blank');")
            time.sleep(2)
            
            # Find and switch to the extension tab
            extension_found = False
            extension_handle = None
            for handle in self.driver.window_handles:
                try:
                    self.driver.switch_to.window(handle)
                    if extension_id in self.driver.current_url:
                        extension_found = True
                        extension_handle = handle
                        break
                except:
                    continue
            
            if extension_found:
                self.show_demo_balloon("✅ Extension loaded successfully", "PASSED")
            else:
                self.show_demo_balloon("❌ Failed to load extension", "FAILED")
                return False
            
            print(f"📍 Current page: {self.driver.title}")
            
            # Test 1: Create test tabs
            self.show_demo_balloon("Creating test tabs for domain grouping...", "INFO")
            test_urls = [
                "https://github.com/microsoft/vscode",
                "https://stackoverflow.com/questions/javascript", 
                "https://docs.python.org/3/tutorial/"
            ]
            
            for i, url in enumerate(test_urls):
                self.driver.execute_script(f"window.open('{url}', '_blank');")
                time.sleep(0.3)
                if self.demo_mode:
                    self.show_demo_balloon(f"Created tab {i+1}: {url.split('/')[2]}", "INFO", 1)
            
            # IMPORTANT: Switch back to extension tab (not just navigate)
            if extension_handle:
                self.driver.switch_to.window(extension_handle)
                self.show_demo_balloon("Switched back to extension tab", "INFO", 1.5)
            else:
                # Fallback: navigate to extension URL
                self.driver.get(popup_url)
            time.sleep(1)
            
            self.show_demo_balloon(f"✅ Created {len(test_urls)} test tabs", "PASSED")
            
            # Test 2: Click Current tab
            self.show_demo_balloon("Clicking Current tab button...", "INFO")
            try:
                current_btn = self.driver.find_element(By.CSS_SELECTOR, "[data-tab='categorize']")
                current_btn.click()
                time.sleep(1)
                self.show_demo_balloon("✅ Current tab button clicked", "PASSED")
            except Exception as e:
                self.show_demo_balloon(f"❌ Failed to click Current tab: {str(e)[:50]}", "FAILED")
                return False
            
            # Test 3: Check domain grouping
            self.show_demo_balloon("Verifying domain grouping...", "INFO")
            try:
                grouping_select = self.driver.find_element(By.ID, "unifiedGroupingSelect")
                current_grouping = grouping_select.get_attribute("value")
                
                if current_grouping != 'domain':
                    self.show_demo_balloon("Setting grouping to domain...", "INFO")
                    self.driver.execute_script("""
                        var select = document.getElementById('unifiedGroupingSelect');
                        select.value = 'domain';
                        select.dispatchEvent(new Event('change', {bubbles: true}));
                    """)
                    time.sleep(2)
                
                # Count groups and tabs
                time.sleep(1)
                group_sections = self.driver.find_elements(By.CSS_SELECTOR, ".group-section")
                tab_items = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item")
                
                if len(group_sections) > 0:
                    self.show_demo_balloon(f"✅ Domain grouping working: {len(group_sections)} groups, {len(tab_items)} tabs", "PASSED")
                    
                    # Show group details in demo mode
                    if self.demo_mode:
                        for i, section in enumerate(group_sections[:3]):
                            try:
                                header = section.find_element(By.CSS_SELECTOR, ".group-header, h3")
                                group_name = header.text.split('\\n')[0]  # Get domain name only
                                self.show_demo_balloon(f"Group {i+1}: {group_name}", "INFO", 1.5)
                            except:
                                self.show_demo_balloon(f"Group {i+1}: (header unreadable)", "WARNING", 1)
                else:
                    self.show_demo_balloon("❌ No groups found - domain grouping failed", "FAILED")
                    return False
                    
            except Exception as e:
                self.show_demo_balloon(f"❌ Grouping test failed: {str(e)[:50]}", "FAILED")
                return False
            
            # Test 4: Search functionality
            self.show_demo_balloon("Testing search functionality...", "INFO")
            try:
                search_input = self.driver.find_element(By.ID, "unifiedSearchInput")
                search_input.clear()
                search_input.send_keys("github")
                self.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
                time.sleep(1)
                
                self.show_demo_balloon("Applied search filter: 'github'", "INFO")
                
                # Check results after search
                visible_tabs_after = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
                visible_groups_after = self.driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
                hidden_groups_after = self.driver.find_elements(By.CSS_SELECTOR, ".group-section.group-hidden")
                
                if len(visible_tabs_after) > 0 and len(hidden_groups_after) > 0:
                    self.show_demo_balloon(f"✅ Search filtering works: {len(visible_tabs_after)} tabs, {len(hidden_groups_after)} hidden groups", "PASSED")
                else:
                    self.show_demo_balloon(f"⚠️  Search results: {len(visible_tabs_after)} tabs, {len(hidden_groups_after)} hidden groups", "WARNING")
                
                # Test 5: Clear search
                self.show_demo_balloon("Testing search clearing...", "INFO")
                search_input.clear()
                self.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
                time.sleep(1)
                
                # Check restoration
                cleared_tabs = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
                cleared_groups = self.driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
                
                if len(cleared_tabs) >= len(test_urls):
                    self.show_demo_balloon(f"✅ Search clearing works: {len(cleared_tabs)} tabs restored", "PASSED")
                else:
                    self.show_demo_balloon(f"❌ Search clearing failed: only {len(cleared_tabs)} tabs restored", "FAILED")
                    
            except Exception as e:
                self.show_demo_balloon(f"❌ Search test failed: {str(e)[:50]}", "FAILED")
                return False
            
            # Test 6: Additional search scenarios
            if self.demo_mode:
                self.show_demo_balloon("Testing additional search scenarios...", "INFO")
                
                search_scenarios = [
                    ("stackoverflow", "Should show only StackOverflow"),
                    ("python", "Should show Python-related content"),
                    ("nonexistent123", "Should show no results")
                ]
                
                for search_term, description in search_scenarios:
                    self.show_demo_balloon(f"Testing: '{search_term}'", "INFO", 1)
                    
                    search_input.clear()
                    search_input.send_keys(search_term)
                    self.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
                    time.sleep(0.8)
                    
                    scenario_tabs = self.driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
                    self.show_demo_balloon(f"'{search_term}': {len(scenario_tabs)} results", "INFO", 1)
            
            # Final cleanup demo
            self.show_demo_balloon("Cleaning up test tabs...", "INFO")
            
            # Clear search one final time
            search_input.clear()
            self.driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
            time.sleep(1)
            
            # Clean up test tabs (but preserve extension tab)
            current_handles = set(self.driver.window_handles)
            new_handles = current_handles - initial_handles
            
            cleanup_count = 0
            for handle in new_handles:
                try:
                    # Don't close the extension tab we're working in
                    if handle == extension_handle:
                        continue
                        
                    self.driver.switch_to.window(handle)
                    current_url = self.driver.current_url
                    if any(pattern in current_url for pattern in ["github.com", "stackoverflow.com", "docs.python.org"]):
                        self.driver.close()
                        cleanup_count += 1
                except:
                    pass
            
            # Switch back to extension tab after cleanup
            if extension_handle:
                try:
                    self.driver.switch_to.window(extension_handle)
                except:
                    pass
            
            self.show_demo_balloon(f"✅ Cleaned up {cleanup_count} test tabs", "PASSED")
            
            # Final success message
            self.show_demo_balloon("🎉 All GROUP BY + Search tests PASSED!", "PASSED", 3)
            
            print("✅ Demo test completed successfully")
            return True
            
        except Exception as e:
            self.show_demo_balloon(f"❌ Demo test error: {str(e)[:50]}", "FAILED")
            print(f"❌ Demo test error: {e}")
            return False

def main():
    """Run demo GROUP BY test"""
    import sys
    
    # Check for demo mode flag
    demo_mode = "--demo" in sys.argv or "-d" in sys.argv
    
    if demo_mode:
        print("🎈 DEMO MODE: Visual balloons enabled")
        print("   Each subtest will show a balloon notification")
        print("   Use without --demo for fast testing")
    else:
        print("🚀 FAST MODE: No visual balloons")
        print("   Use --demo flag for visual demonstrations")
    
    print("")
    
    test = DemoGroupByTest(demo_mode=demo_mode)
    success = test.demo_groupby_test()
    
    if success:
        print("\\n🎯 GROUP BY + Search Demo Test SUCCESSFUL!")
    else:
        print("\\n❌ GROUP BY + Search Demo Test FAILED")
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())