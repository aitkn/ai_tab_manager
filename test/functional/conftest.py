#!/usr/bin/env python3
"""
Pytest configuration and fixtures for Chrome Extension functional tests
"""

import pytest
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By


class ExtensionTestState:
    """Tracks extension test state for proper cleanup"""
    def __init__(self):
        self.driver = None
        self.extension_handle = None
        self.initial_handles = set()
        self.remembered_tabs = []  # List of (handle, url, title)
        self.created_handles = set()
        self.extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
        self.popup_url = f"chrome-extension://{self.extension_id}/popup.html"


@pytest.fixture(scope="function")
def extension_driver():
    """
    Pytest fixture that provides a Chrome driver connected to extension
    with proper state tracking and cleanup
    """
    state = ExtensionTestState()
    
    try:
        # Connect to Chrome
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        service = Service(ChromeDriverManager().install())
        state.driver = webdriver.Chrome(service=service, options=chrome_options)
        
        # Remember initial state
        state.initial_handles = set(state.driver.window_handles)
        
        # Remember current tabs that might be replaced
        for handle in state.initial_handles:
            try:
                state.driver.switch_to.window(handle)
                url = state.driver.current_url
                title = state.driver.title
                state.remembered_tabs.append((handle, url, title))
            except:
                state.remembered_tabs.append((handle, "about:blank", "Unknown"))
        
        # Open extension using smart method
        extension_opened = _open_extension_smart(state)
        
        if not extension_opened:
            pytest.fail("Failed to open extension")
            
        yield state
        
    finally:
        # Cleanup: restore initial state
        _cleanup_test_state(state)


def _open_extension_smart(state):
    """Smart extension opening with tab restoration"""
    # Try to find existing extension tab first
    for handle in state.driver.window_handles:
        try:
            state.driver.switch_to.window(handle)
            if state.extension_id in state.driver.current_url:
                state.extension_handle = handle
                return True
        except:
            continue
    
    # No existing extension tab found, use smart replacement method
    # Find the current tab to replace
    current_handle = state.driver.current_window_handle
    remembered_url = state.driver.current_url
    remembered_title = state.driver.title
    
    print(f"DEBUG: Replacing tab {remembered_url} with extension")
    
    # Navigate current tab to extension (this always works)
    state.driver.get(state.popup_url)
    time.sleep(1)
    
    if state.extension_id in state.driver.current_url:
        state.extension_handle = state.driver.current_window_handle
        
        # Restore the replaced tab if it wasn't blank/extension
        should_restore = (remembered_url and 
                         remembered_url != "about:blank" and 
                         state.extension_id not in remembered_url and
                         "chrome-extension://" not in remembered_url)
        
        if should_restore:
            print(f"DEBUG: Attempting to restore {remembered_url}")
            try:
                # Try the more reliable method - always use about:blank first
                state.driver.execute_script("window.open('about:blank', '_blank');")
                time.sleep(0.5)
                
                # Find the new blank tab
                current_handles = set(state.driver.window_handles)
                new_handles = current_handles - state.initial_handles - {state.extension_handle}
                
                if new_handles:
                    new_handle = list(new_handles)[0]
                    state.driver.switch_to.window(new_handle)
                    
                    # Now navigate to the remembered URL
                    state.driver.get(remembered_url)
                    time.sleep(0.5)
                    
                    state.created_handles.add(new_handle)
                    print(f"DEBUG: Successfully restored {remembered_url}")
                    
                    # Switch back to extension
                    state.driver.switch_to.window(state.extension_handle)
                else:
                    print("DEBUG: Could not create new tab for restoration")
                
            except Exception as e:
                print(f"DEBUG: Could not restore tab {remembered_url}: {e}")
        
        return True
    
    print(f"DEBUG: Failed to load extension at {state.popup_url}")
    return False


def _cleanup_test_state(state):
    """Clean up test state and restore initial browser state"""
    if not state.driver:
        return
        
    try:
        # Close any test tabs we explicitly created
        for handle in state.created_handles.copy():
            try:
                state.driver.switch_to.window(handle)
                current_url = state.driver.current_url
                
                # Close test tabs 
                should_close = any(pattern in current_url.lower() for pattern in [
                    "github.com", "stackoverflow.com", "docs.python.org",
                    "example.com"
                ])
                
                if should_close:
                    state.driver.close()
                    state.created_handles.remove(handle)
            except:
                # If tab is already closed, remove from tracking
                state.created_handles.discard(handle)
        
        # Always close extension tab to prevent accumulation
        if state.extension_handle:
            try:
                state.driver.switch_to.window(state.extension_handle)
                if state.extension_id in state.driver.current_url:
                    state.driver.close()
                    print("DEBUG: Closed extension tab")
            except Exception as e:
                print(f"DEBUG: Error closing extension tab: {e}")
        
        # Switch to any remaining initial tab
        try:
            remaining_handles = [h for h in state.driver.window_handles if h in state.initial_handles]
            if remaining_handles:
                state.driver.switch_to.window(remaining_handles[0])
            else:
                # If no initial tabs remain, switch to any available tab
                available_handles = state.driver.window_handles
                if available_handles:
                    state.driver.switch_to.window(available_handles[0])
        except:
            pass
            
    except Exception as e:
        print(f"Cleanup warning: {e}")


@pytest.fixture(scope="function")
def demo_mode(request):
    """Fixture to enable demo mode with visual balloons"""
    return hasattr(request.config.option, 'demo') and request.config.option.demo


def pytest_addoption(parser):
    """Add custom command line options"""
    parser.addoption(
        "--demo", 
        action="store_true", 
        default=False, 
        help="Enable demo mode with visual balloons"
    )
    parser.addoption(
        "--extension-id",
        action="store",
        default="fnklipkenfpdakdficiofcdejbiajgeh",
        help="Chrome extension ID to test"
    )


@pytest.fixture(scope="session")
def extension_id(request):
    """Fixture providing extension ID"""
    return request.config.getoption("--extension-id")


# Helper functions for tests
def wait_for_element(driver, selector, timeout=5):
    """Wait for element to be present"""
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    
    wait = WebDriverWait(driver, timeout)
    return wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))


def create_test_tabs(state, urls):
    """Create test tabs and track them for cleanup"""
    created_handles = []
    initial_handles = set(state.driver.window_handles)
    
    # Use the same approach as in extension opening - create blank tabs first
    for url in urls:
        try:
            state.driver.execute_script("window.open('about:blank', '_blank');")
            time.sleep(0.5)
            
            # Find the new tab and navigate to URL
            current_handles = set(state.driver.window_handles)
            new_handles = current_handles - initial_handles - state.created_handles
            
            if new_handles:
                new_handle = list(new_handles)[0]
                state.driver.switch_to.window(new_handle)
                state.driver.get(url)
                time.sleep(0.5)
                state.created_handles.add(new_handle)
                created_handles.append(new_handle)
                initial_handles.add(new_handle)  # Update for next iteration
        except Exception as e:
            print(f"Warning: Could not create test tab for {url}: {e}")
    
    # Switch back to extension
    if state.extension_handle and state.extension_handle in state.driver.window_handles:
        state.driver.switch_to.window(state.extension_handle)
    
    return created_handles


def show_demo_balloon(state, message, status="INFO", duration=2.5, demo_mode=False):
    """Show demo balloon if in demo mode"""
    if not demo_mode:
        return
        
    colors = {
        "PASSED": "#4CAF50",
        "FAILED": "#F44336", 
        "INFO": "#2196F3",
        "WARNING": "#FF9800"
    }
    
    color = colors.get(status, "#2196F3")
    
    balloon_script = f"""
    const existingBalloons = document.querySelectorAll('.demo-test-balloon');
    existingBalloons.forEach(b => b.remove());
    
    const balloon = document.createElement('div');
    balloon.className = 'demo-test-balloon';
    balloon.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: {color}; color: white;
        padding: 15px 20px; border-radius: 8px;
        font-family: Arial, sans-serif; font-size: 14px; font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000;
        max-width: 300px; word-wrap: break-word;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = 'font-size: 12px; opacity: 0.9; margin-bottom: 5px;';
    header.textContent = '🧪 Test - {status}';
    
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `{message}`;
    
    balloon.appendChild(header);
    balloon.appendChild(messageDiv);
    document.body.appendChild(balloon);
    
    setTimeout(() => balloon.remove(), {duration * 1000});
    """
    
    try:
        state.driver.execute_script(balloon_script)
        print(f"🎈 DEMO [{status}]: {message}")
        time.sleep(duration)
    except Exception as e:
        print(f"Demo balloon error: {e}")