#!/usr/bin/env python3
"""
Check what elements are actually available in the extension popup
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

def check_extension_elements():
    """Check available elements in extension popup"""
    driver = None
    try:
        print("🔍 Checking extension popup elements...")
        
        # Connect to Chrome
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        # Open extension
        extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
        popup_url = f"chrome-extension://{extension_id}/popup.html"
        driver.get(popup_url)
        time.sleep(5)  # Give more time for loading
        
        print(f"📍 Extension loaded: {driver.title}")
        print(f"📍 URL: {driver.current_url}")
        
        # Check for various tab-related elements
        tab_selectors = [
            "#currentTabBtn",
            "#categorizeTab", 
            "[data-tab='categorize']",
            ".tab-btn",
            "button",
            "[id*='current']",
            "[id*='tab']",
            "[class*='tab']"
        ]
        
        print(f"\n🔍 Looking for tab elements:")
        for selector in tab_selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"   ✅ {selector}: found {len(elements)} elements")
                    for i, el in enumerate(elements[:3]):  # Show first 3
                        try:
                            text = el.text.strip()
                            tag = el.tag_name
                            id_attr = el.get_attribute("id") or "(no id)"
                            class_attr = el.get_attribute("class") or "(no class)"
                            print(f"      Element {i+1}: <{tag}> id='{id_attr}' class='{class_attr}' text='{text[:30]}'")
                        except:
                            print(f"      Element {i+1}: (error reading attributes)")
                else:
                    print(f"   ❌ {selector}: not found")
            except Exception as e:
                print(f"   ❌ {selector}: error - {e}")
        
        # Check for grouping elements
        grouping_selectors = [
            "#unifiedGroupingSelect",
            "#groupingSelect",
            "select",
            "[id*='group']",
            "[id*='select']"
        ]
        
        print(f"\n🔍 Looking for grouping elements:")
        for selector in grouping_selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"   ✅ {selector}: found {len(elements)} elements")
                    for i, el in enumerate(elements[:2]):
                        try:
                            tag = el.tag_name
                            id_attr = el.get_attribute("id") or "(no id)"
                            value = el.get_attribute("value") or "(no value)"
                            print(f"      Element {i+1}: <{tag}> id='{id_attr}' value='{value}'")
                        except:
                            print(f"      Element {i+1}: (error reading attributes)")
                else:
                    print(f"   ❌ {selector}: not found")
            except Exception as e:
                print(f"   ❌ {selector}: error - {e}")
        
        # Check page structure
        print(f"\n📊 Page structure:")
        body = driver.find_element(By.TAG_NAME, "body")
        print(f"   Body classes: {body.get_attribute('class')}")
        
        # Look for main containers
        container_selectors = [".container", ".popup", ".main", "#app", ".app"]
        for selector in container_selectors:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            if elements:
                print(f"   Container {selector}: {len(elements)} found")
        
        # Check if page is fully loaded
        ready_state = driver.execute_script("return document.readyState")
        print(f"   Document ready state: {ready_state}")
        
        # Look for any error messages
        error_elements = driver.find_elements(By.CSS_SELECTOR, ".error, .warning, [class*='error']")
        if error_elements:
            print(f"   ⚠️ Found {len(error_elements)} potential error elements")
            for el in error_elements[:2]:
                print(f"      Error: {el.text[:50]}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    finally:
        # Don't close - just disconnect
        pass

if __name__ == "__main__":
    check_extension_elements()