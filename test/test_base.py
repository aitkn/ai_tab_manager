#!/usr/bin/env python3
"""
Base Test Class for Chrome Extension Testing
Provides common functionality for all extension tests
"""

import os
import time
import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

class ExtensionTestBase:
    def __init__(self):
        self.driver = None
        self.extension_id = None
        self.results = []
        self.start_time = None
        
    def log_result(self, message, status):
        """Log test result with timestamp"""
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        result_entry = f"[{timestamp}] {status}: {message}"
        self.results.append(result_entry)
        print(result_entry)
    
    def setup_browser(self):
        """Setup Chrome browser with extension loaded"""
        try:
            # Get the project root directory (parent of test directory)
            test_dir = os.path.dirname(os.path.abspath(__file__))
            extension_dir = os.path.dirname(test_dir)
            
            # Setup Chrome options
            chrome_options = Options()
            chrome_options.add_experimental_option("detach", True)
            chrome_options.add_argument(f"--load-extension={extension_dir}")
            chrome_options.add_argument("--disable-extensions-except=" + extension_dir)
            chrome_options.add_argument("--disable-web-security")
            chrome_options.add_argument("--allow-running-insecure-content")
            chrome_options.add_argument("--disable-features=VizDisplayCompositor")
            # Fix extension blocking issues
            chrome_options.add_argument("--disable-extensions-file-access-check")
            chrome_options.add_argument("--enable-experimental-extension-apis")
            chrome_options.add_argument("--disable-default-apps")
            chrome_options.add_argument("--no-first-run")
            chrome_options.add_argument("--disable-background-mode")
            # Allow unpacked extensions
            chrome_options.add_experimental_option("useAutomationExtension", False)
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            
            # Initialize driver
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.driver.set_window_size(1200, 800)
            # Set timeouts to prevent hanging
            self.driver.implicitly_wait(10)
            self.driver.set_page_load_timeout(30)
            
            # Wait a moment for extension to load
            time.sleep(2)
            
            self.log_result("Successfully launched Chrome with extension", "PASSED")
            return True
            
        except Exception as e:
            self.log_result(f"Failed to setup browser: {e}", "FAILED")
            return False
    
    def find_extension_tab(self):
        """Find and switch to extension tab"""
        try:
            # Get all window handles
            all_windows = self.driver.window_handles
            
            for window in all_windows:
                self.driver.switch_to.window(window)
                current_url = self.driver.current_url
                
                if "chrome-extension://" in current_url and "popup.html" in current_url:
                    # Extract extension ID from URL
                    extension_id = current_url.split("://")[1].split("/")[0]
                    self.extension_id = extension_id
                    return True
            
            return False
            
        except Exception as e:
            self.log_result(f"Error finding extension tab: {e}", "FAILED")
            return False
    
    def open_extension(self):
        """Open extension in a new tab"""
        try:
            # Wait a bit for extension to load
            time.sleep(3)
            
            # First try to find existing extension tab
            if self.find_extension_tab():
                self.log_result("Found existing extension tab", "PASSED")
                return True
            
            # Try to open extension popup directly by creating a tab
            try:
                # Go to chrome://extensions to find our extension ID
                self.driver.get("chrome://extensions/")
                time.sleep(2)
                
                # Enable developer mode if needed
                try:
                    dev_mode_toggle = self.driver.find_element(By.CSS_SELECTOR, "#devMode")
                    if not dev_mode_toggle.is_selected():
                        dev_mode_toggle.click()
                        time.sleep(1)
                except:
                    pass
                
                # Look for our extension in the page
                try:
                    extension_cards = self.driver.find_elements(By.CSS_SELECTOR, "extensions-item")
                    for card in extension_cards:
                        # Check if this is our AI Tab Manager extension
                        if "AI Tab Manager" in card.text or "Tab Manager" in card.text:
                            # Try to get extension ID from the card
                            extension_id_element = card.find_element(By.CSS_SELECTOR, "#extension-id")
                            if extension_id_element:
                                self.extension_id = extension_id_element.text.strip()
                                break
                except:
                    pass
                
                # If we found extension ID, try to open popup
                if self.extension_id:
                    popup_url = f"chrome-extension://{self.extension_id}/popup.html"
                    self.driver.execute_script(f"window.open('{popup_url}', '_blank');")
                    time.sleep(2)
                    self.driver.switch_to.window(self.driver.window_handles[-1])
                    
                    if "chrome-extension://" in self.driver.current_url:
                        self.log_result(f"Successfully opened extension: {self.extension_id}", "PASSED")
                        return True
                
            except Exception as e:
                self.log_result(f"Error accessing chrome://extensions: {e}", "FAILED")
            
            # Final fallback - check all tabs again
            all_handles = self.driver.window_handles
            for handle in all_handles:
                self.driver.switch_to.window(handle)
                current_url = self.driver.current_url
                if "chrome-extension://" in current_url:
                    self.extension_id = current_url.split("://")[1].split("/")[0]
                    self.log_result(f"Found extension tab: {self.extension_id}", "PASSED")
                    return True
            
            self.log_result("❌ Extension not loaded. Please manually load the extension in chrome://extensions", "FAILED")
            self.log_result("💡 TIP: Enable Developer mode and click 'Load unpacked' to load the extension", "FAILED")
            return False
            
        except Exception as e:
            self.log_result(f"Error opening extension: {e}", "FAILED")
            return False
    
    def go_to_current_tabs(self):
        """Navigate to Current tabs section"""
        try:
            # Try multiple selectors for Current tab button
            current_tab_selectors = [
                "#categorizeTab",
                "[data-tab='categorize']",
                ".tab-current",
                "button:contains('Current')"
            ]
            
            for selector in current_tab_selectors:
                try:
                    if selector.startswith("button:contains"):
                        # Find by text content
                        buttons = self.driver.find_elements(By.TAG_NAME, "button")
                        for btn in buttons:
                            if "current" in btn.text.lower():
                                btn.click()
                                time.sleep(0.5)
                                self.log_result("Clicked Current tab button (text search)", "PASSED")
                                return True
                    else:
                        element = WebDriverWait(self.driver, 2).until(
                            EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                        )
                        element.click()
                        time.sleep(0.5)
                        self.log_result("Clicked Current tab button (fast path)", "PASSED")
                        return True
                except:
                    continue
            
            self.log_result("Could not find Current tab button", "FAILED")
            return False
            
        except Exception as e:
            self.log_result(f"Error navigating to Current tabs: {e}", "FAILED")
            return False
    
    def switch_back_to_extension(self):
        """Switch back to extension tab"""
        try:
            if self.extension_id:
                extension_url_pattern = f"chrome-extension://{self.extension_id}/popup.html"
                
                for handle in self.driver.window_handles:
                    self.driver.switch_to.window(handle)
                    if extension_url_pattern in self.driver.current_url:
                        self.log_result("Switched back to extension tab", "PASSED")
                        return True
            
            # Fallback: find any extension tab
            return self.find_extension_tab()
            
        except Exception as e:
            self.log_result(f"Error switching to extension: {e}", "FAILED")
            return False
    
    def save_report(self, test_name, overall_result):
        """Save test results to file"""
        try:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"test_results_{timestamp}.txt"
            
            passed_count = sum(1 for result in self.results if "PASSED:" in result)
            failed_count = sum(1 for result in self.results if "FAILED:" in result)
            
            with open(filename, 'w') as f:
                f.write("CHROME EXTENSION TEST REPORT\n")
                f.write("=" * 40 + "\n")
                f.write(f"Test Name: {test_name}\n")
                f.write(f"Overall Result: {overall_result}\n")
                f.write(f"Timestamp: {datetime.datetime.now()}\n")
                f.write(f"Passed: {passed_count}\n")
                f.write(f"Failed: {failed_count}\n\n")
                f.write("DETAILED RESULTS:\n")
                f.write("=" * 40 + "\n")
                
                for result in self.results:
                    f.write(result + "\n")
            
            print(f"📊 Report generated: {filename}")
            return filename
            
        except Exception as e:
            print(f"Error saving report: {e}")
            return None
    
    def cleanup(self):
        """Clean up resources"""
        try:
            if self.driver:
                # Try graceful quit first
                self.driver.quit()
                time.sleep(1)
        except:
            pass
        
        # Force kill any remaining Chrome processes
        try:
            import subprocess
            subprocess.run(["pkill", "-f", "chromedriver"], capture_output=True)
            subprocess.run(["pkill", "-f", "chrome"], capture_output=True)
        except:
            pass
    
    def run_basic_setup(self):
        """Run basic setup steps common to all tests"""
        setup_steps = [
            ("Setup browser with extension", self.setup_browser),
            ("Open extension", self.open_extension),
            ("Go to Current tabs", self.go_to_current_tabs)
        ]
        
        for step_name, step_func in setup_steps:
            print(f"\n🔄 Executing: {step_name}")
            if not step_func():
                return False
        
        return True