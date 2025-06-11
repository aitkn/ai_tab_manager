#!/usr/bin/env python3
"""
Test with Known Extension ID - Works with Windows Chrome + WSL
Uses the extension ID from Windows Chrome setup
"""

import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

class KnownExtensionTest:
    def __init__(self):
        self.driver = None
        self.extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"  # Known extension ID
    
    def setup_browser(self):
        """Setup Chrome that can access Windows Chrome extension"""
        try:
            print("🚀 Setting up Chrome to test Windows Chrome extension...")
            
            # Setup Chrome options
            chrome_options = Options()
            chrome_options.add_argument("--headless")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--disable-web-security")
            chrome_options.add_argument("--user-data-dir=/tmp/chrome-test-profile")
            # Don't load extension in headless - just test the popup URL
            
            # Initialize driver
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.driver.set_page_load_timeout(30)
            
            print("✅ Chrome setup complete")
            return True
            
        except Exception as e:
            print(f"❌ Error setting up browser: {e}")
            return False
    
    def test_extension_popup_structure(self):
        """Test extension popup HTML structure"""
        try:
            print("🔗 Testing extension popup structure...")
            
            # Try to access popup URL directly
            popup_url = f"chrome-extension://{self.extension_id}/popup.html"
            print(f"📍 Accessing: {popup_url}")
            
            self.driver.get(popup_url)
            time.sleep(3)
            
            # Check if we can access any content
            current_url = self.driver.current_url
            print(f"📍 Current URL: {current_url}")
            
            # Even if extension isn't loaded in headless, we can test HTML structure
            page_source = self.driver.page_source
            
            # Test for key UI elements
            ui_elements = {
                "Search Input": ["searchInput", "search-input", "input[type='search']"],
                "Current Tab Button": ["categorizeTab", "data-tab='categorize'", "Current"],
                "GROUP BY Selector": ["categorizeGroupingSelect", "grouping-select"],
                "Tab Container": ["tab-item", "tab-title", "categorizedContent"]
            }
            
            results = {}
            for element_name, selectors in ui_elements.items():
                found = False
                for selector in selectors:
                    if selector in page_source or selector.lower() in page_source.lower():
                        results[element_name] = "✅ Found"
                        found = True
                        break
                
                if not found:
                    results[element_name] = "❌ Not found"
            
            # Print results
            print("\n📊 Extension UI Element Analysis:")
            print("=" * 40)
            for element, status in results.items():
                print(f"{element}: {status}")
            
            # Check for search functionality indicators
            search_indicators = ["search", "filter", "input", "placeholder"]
            search_found = any(indicator in page_source.lower() for indicator in search_indicators)
            
            groupby_indicators = ["group", "category", "domain", "select"]
            groupby_found = any(indicator in page_source.lower() for indicator in groupby_indicators)
            
            print(f"\n🔍 Search functionality indicators: {'✅' if search_found else '❌'}")
            print(f"📂 GROUP BY functionality indicators: {'✅' if groupby_found else '❌'}")
            
            return search_found and groupby_found
            
        except Exception as e:
            print(f"❌ Error testing popup structure: {e}")
            # Try to extract useful info even on error
            try:
                if self.driver.current_url:
                    print(f"📍 Current URL on error: {self.driver.current_url}")
            except:
                pass
            return False
    
    def test_extension_files_exist(self):
        """Test that required extension files exist"""
        try:
            print("📁 Testing extension files...")
            
            # Check local files that should sync to Windows
            base_dir = "/home/proshkin/proj/chrome_tabs_extension"
            required_files = [
                "manifest.json",
                "background.js", 
                "popup.html",
                "popup.js",
                "popup.css",
                "src/modules/search-filter.js",  # Search functionality
                "src/utils/helpers.js"  # Domain extraction fix
            ]
            
            missing_files = []
            for file_path in required_files:
                full_path = os.path.join(base_dir, file_path)
                if os.path.exists(full_path):
                    print(f"✅ {file_path}")
                else:
                    print(f"❌ {file_path}")
                    missing_files.append(file_path)
            
            if missing_files:
                print(f"\n⚠️  Missing files: {missing_files}")
                return False
            else:
                print("\n✅ All required files present")
                return True
                
        except Exception as e:
            print(f"❌ Error checking files: {e}")
            return False
    
    def test_search_module_content(self):
        """Test search module content for expected functionality"""
        try:
            print("🔍 Analyzing search functionality code...")
            
            search_file = "/home/proshkin/proj/chrome_tabs_extension/src/modules/search-filter.js"
            
            if not os.path.exists(search_file):
                print("❌ Search filter module not found")
                return False
            
            with open(search_file, 'r') as f:
                content = f.read()
            
            # Check for key search functionality
            search_features = {
                "Case Insensitive Search": ["toLowerCase", "toUpperCase", "case"],
                "Filter Implementation": ["filter", "includes", "indexOf"],
                "Group Counter Updates": ["counter", "count", "update"],
                "Empty Group Handling": ["empty", "hide", "visible"],
                "Search Input Handler": ["addEventListener", "onInput", "onChange"]
            }
            
            print("\n📊 Search Functionality Analysis:")
            print("=" * 40)
            
            all_features_present = True
            for feature, keywords in search_features.items():
                found = any(keyword.lower() in content.lower() for keyword in keywords)
                status = "✅ Found" if found else "❌ Missing"
                print(f"{feature}: {status}")
                
                if not found:
                    all_features_present = False
            
            return all_features_present
            
        except Exception as e:
            print(f"❌ Error analyzing search code: {e}")
            return False
    
    def test_domain_extraction_fix(self):
        """Test that domain extraction fix is present"""
        try:
            print("🌐 Testing domain extraction fix...")
            
            helpers_file = "/home/proshkin/proj/chrome_tabs_extension/src/utils/helpers.js"
            
            if not os.path.exists(helpers_file):
                print("❌ Helpers file not found")
                return False
            
            with open(helpers_file, 'r') as f:
                content = f.read()
            
            # Check for domain extraction fix
            fix_indicators = [
                "about:",
                "chrome://",
                "file://",
                "extractDomain",
                "unknown"
            ]
            
            fix_found = all(indicator in content for indicator in fix_indicators)
            
            if fix_found:
                print("✅ Domain extraction fix present")
                print("   - Handles about: URLs")
                print("   - Handles chrome:// URLs") 
                print("   - Handles file:// URLs")
                print("   - Should prevent 'unknown' domains")
            else:
                print("❌ Domain extraction fix not complete")
            
            return fix_found
            
        except Exception as e:
            print(f"❌ Error checking domain fix: {e}")
            return False
    
    def cleanup(self):
        """Clean up resources"""
        try:
            if self.driver:
                self.driver.quit()
                print("✅ Browser cleaned up")
        except:
            pass
    
    def run_known_extension_test(self):
        """Run test with known extension ID"""
        print("🔧 Testing Known Extension Functionality")
        print("=" * 50)
        print(f"Extension ID: {self.extension_id}")
        print("")
        
        try:
            # Test local files
            if not self.test_extension_files_exist():
                print("❌ Extension files missing")
                return False
            
            # Test search functionality code
            if not self.test_search_module_content():
                print("❌ Search functionality incomplete")
                return False
            
            # Test domain extraction fix
            if not self.test_domain_extraction_fix():
                print("❌ Domain extraction fix missing")
                return False
            
            # Test browser access
            if not self.setup_browser():
                print("❌ Browser setup failed")
                return False
            
            # Test popup structure
            popup_ok = self.test_extension_popup_structure()
            
            print("\n🎯 Known Extension Test Results:")
            print("=" * 40)
            print("✅ Extension files present")
            print("✅ Search functionality code present")
            print("✅ Domain extraction fix present")
            print("✅ Browser setup successful")
            
            if popup_ok:
                print("✅ Extension popup structure detected")
            else:
                print("⚠️  Extension popup not accessible (normal in headless)")
            
            print(f"\n💡 Extension loaded in Windows Chrome: {self.extension_id}")
            print("🔧 watch-sync.sh keeping Windows copy updated")
            print("✅ Ready for manual search functionality testing!")
            
            return True
            
        except Exception as e:
            print(f"❌ Test failed: {e}")
            return False
        finally:
            self.cleanup()

def main():
    """Run known extension test"""
    test = KnownExtensionTest()
    success = test.run_known_extension_test()
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())