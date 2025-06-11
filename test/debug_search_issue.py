#!/usr/bin/env python3
"""
Debug the search issue where only 1 GitHub tab is showing instead of 2
"""

import time
import logging
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def setup_driver():
    """Setup Chrome with extension"""
    chrome_options = Options()
    chrome_options.add_extension('/home/proshkin/proj/chrome_tabs_extension')
    chrome_options.add_argument('--no-first-run')
    chrome_options.add_argument('--no-default-browser-check')
    chrome_options.add_argument('--disable-default-apps')
    chrome_options.add_argument('--disable-web-security')
    chrome_options.add_argument('--allow-running-insecure-content')
    
    service = Service()
    driver = webdriver.Chrome(service=service, options=chrome_options)
    driver.implicitly_wait(10)
    return driver

def wait_for_element(driver, selector, timeout=10):
    """Wait for element to be present"""
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
    )

def debug_search_issue():
    """Debug the specific search issue"""
    driver = None
    try:
        logger.info("🔍 Setting up Chrome with extension...")
        driver = setup_driver()
        
        # Create test tabs
        test_urls = [
            "https://github.com/user1/repo1",
            "https://github.com/user2/repo2",
            "https://stackoverflow.com/questions/test"
        ]
        
        logger.info(f"📝 Creating {len(test_urls)} test tabs...")
        original_handles = driver.window_handles
        
        for url in test_urls:
            driver.execute_script(f"window.open('{url}', '_blank');")
            time.sleep(0.5)
        
        # Wait for all tabs to be created
        WebDriverWait(driver, 10).until(lambda d: len(d.window_handles) == len(original_handles) + len(test_urls))
        logger.info(f"✅ Created {len(test_urls)} tabs")
        
        # Open extension in a tab
        extension_url = "chrome-extension://fnklipkenfpdakdficiofcdejbiajgeh/popup.html"
        driver.execute_script(f"window.open('{extension_url}', '_blank');")
        time.sleep(1)
        
        # Switch to extension tab
        for handle in driver.window_handles:
            driver.switch_to.window(handle)
            if driver.current_url.startswith('chrome-extension://'):
                break
        
        logger.info("🎯 Switched to extension tab")
        
        # Click Current tab to load tabs
        logger.info("🔄 Loading current tabs...")
        current_btn = wait_for_element(driver, "[data-tab='categorize']")
        current_btn.click()
        time.sleep(2)
        
        # Set domain grouping
        logger.info("📊 Setting domain grouping...")
        driver.execute_script("""
            var select = document.getElementById('unifiedGroupingSelect');
            if (select) {
                select.value = 'domain';
                select.dispatchEvent(new Event('change', {bubbles: true}));
            }
        """)
        time.sleep(2)
        
        # Check current state before search
        logger.info("🔍 Checking state before search...")
        all_tabs_before = driver.find_elements(By.CSS_SELECTOR, ".tab-item")
        groups_before = driver.find_elements(By.CSS_SELECTOR, ".group-section")
        logger.info(f"📊 Before search: {len(all_tabs_before)} tabs, {len(groups_before)} groups")
        
        # Log details of each group
        for i, group in enumerate(groups_before):
            try:
                header = group.find_element(By.CSS_SELECTOR, ".group-header, h3")
                tabs_in_group = group.find_elements(By.CSS_SELECTOR, ".tab-item")
                logger.info(f"   Group {i+1}: {header.text} ({len(tabs_in_group)} tabs)")
                
                for j, tab in enumerate(tabs_in_group):
                    title_elem = tab.find_element(By.CSS_SELECTOR, ".tab-title")
                    url_elem = tab.find_element(By.CSS_SELECTOR, ".tab-url")
                    logger.info(f"      Tab {j+1}: {title_elem.text} - {url_elem.text}")
            except Exception as e:
                logger.info(f"   Group {i+1}: Error reading group - {e}")
        
        # Apply search for "github"
        logger.info("🔍 Applying search for 'github'...")
        search_input = wait_for_element(driver, "#unifiedSearchInput")
        search_input.clear()
        search_input.send_keys("github")
        driver.execute_script("arguments[0].dispatchEvent(new Event('input', {bubbles: true}));", search_input)
        time.sleep(2)
        
        # Check state after search
        logger.info("📊 Checking state after search...")
        visible_tabs = driver.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
        hidden_tabs = driver.find_elements(By.CSS_SELECTOR, ".tab-item.hidden")
        visible_groups = driver.find_elements(By.CSS_SELECTOR, ".group-section:not(.group-hidden)")
        hidden_groups = driver.find_elements(By.CSS_SELECTOR, ".group-section.group-hidden")
        
        logger.info(f"📊 After search: {len(visible_tabs)} visible tabs, {len(hidden_tabs)} hidden tabs")
        logger.info(f"📊 Groups: {len(visible_groups)} visible, {len(hidden_groups)} hidden")
        
        # Find GitHub group specifically
        github_group = None
        for group in visible_groups:
            try:
                header = group.find_element(By.CSS_SELECTOR, ".group-header, h3")
                if "github.com" in header.text.lower():
                    github_group = group
                    logger.info(f"🎯 Found GitHub group: {header.text}")
                    break
            except Exception as e:
                logger.info(f"❌ Error checking group header: {e}")
        
        if github_group:
            # Count visible tabs in github group
            github_visible_tabs = github_group.find_elements(By.CSS_SELECTOR, ".tab-item:not(.hidden)")
            github_hidden_tabs = github_group.find_elements(By.CSS_SELECTOR, ".tab-item.hidden")
            
            logger.info(f"🔍 GitHub group has {len(github_visible_tabs)} visible tabs, {len(github_hidden_tabs)} hidden tabs")
            
            # Log each tab in the GitHub group
            all_github_tabs = github_group.find_elements(By.CSS_SELECTOR, ".tab-item")
            for i, tab in enumerate(all_github_tabs):
                try:
                    title_elem = tab.find_element(By.CSS_SELECTOR, ".tab-title")
                    url_elem = tab.find_element(By.CSS_SELECTOR, ".tab-url")
                    is_hidden = "hidden" in tab.get_attribute("class")
                    logger.info(f"   GitHub Tab {i+1}: {title_elem.text} - {url_elem.text} ({'HIDDEN' if is_hidden else 'VISIBLE'})")
                except Exception as e:
                    logger.info(f"   GitHub Tab {i+1}: Error reading tab - {e}")
            
            # Check why one might be hidden
            for i, tab in enumerate(all_github_tabs):
                try:
                    # Get all classes
                    classes = tab.get_attribute("class")
                    logger.info(f"   Tab {i+1} classes: {classes}")
                except Exception as e:
                    logger.info(f"   Tab {i+1}: Error getting classes - {e}")
        else:
            logger.info("❌ No GitHub group found!")
        
        logger.info("✅ Debug complete")
        
    except Exception as e:
        logger.error(f"❌ Error during debug: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if driver:
            time.sleep(2)  # Let user see results
            driver.quit()

if __name__ == "__main__":
    debug_search_issue()