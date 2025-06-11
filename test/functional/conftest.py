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
        self.initial_tab_states = []  # List of (handle, url, title) for exact restoration
        self.created_handles = set()
        self.closed_tabs_by_test = []  # For tests that close tabs (like "Close All")
        self.extension_id = "fnklipkenfpdakdficiofcdejbiajgeh"
        self.popup_url = f"chrome-extension://{self.extension_id}/popup.html"
        self.initial_console_logs = []
        self.test_name = ""


@pytest.fixture(scope="function")
def extension_driver(request):
    """
    Pytest fixture that provides a Chrome driver connected to extension
    with proper state tracking and cleanup
    """
    state = ExtensionTestState()
    state.test_name = request.node.name
    
    try:
        # Connect to Chrome
        chrome_options = Options()
        chrome_options.add_experimental_option("debuggerAddress", "172.25.48.1:9223")
        service = Service(ChromeDriverManager().install())
        state.driver = webdriver.Chrome(service=service, options=chrome_options)
        
        # Record EXACT initial browser state
        state.initial_handles = set(state.driver.window_handles)
        
        print(f"\n🔍 [{state.test_name}] Recording initial browser state...")
        for handle in state.initial_handles:
            try:
                state.driver.switch_to.window(handle)
                url = state.driver.current_url
                title = state.driver.title
                state.initial_tab_states.append((handle, url, title))
                print(f"   Initial tab: {title[:30]} - {url[:50]}")
            except Exception as e:
                state.initial_tab_states.append((handle, "about:blank", f"Error: {e}"))
                print(f"   Initial tab: ERROR reading - {e}")
        
        # Record initial console logs to filter out pre-existing errors
        _record_initial_console_logs(state)
        
        # Open extension using smart method
        extension_opened = _open_extension_smart(state)
        
        if not extension_opened:
            pytest.fail("Failed to open extension")
            
        print(f"✅ [{state.test_name}] Setup complete - extension loaded")
        yield state
        
    finally:
        # Cleanup: restore EXACT initial state and check logs
        _cleanup_and_verify_state(state)


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


def _record_initial_console_logs(state):
    """Record initial console logs to filter out pre-existing errors"""
    try:
        # Get logs from all available log types
        log_types = state.driver.log_types
        state.initial_console_logs = []
        
        for log_type in ['browser', 'driver', 'performance']:
            if log_type in log_types:
                try:
                    logs = state.driver.get_log(log_type)
                    state.initial_console_logs.extend(logs)
                except:
                    pass
        
        print(f"📝 [{state.test_name}] Recorded {len(state.initial_console_logs)} initial log entries")
    except Exception as e:
        print(f"⚠️  [{state.test_name}] Could not record initial logs: {e}")


def _cleanup_and_verify_state(state):
    """Clean up test state and restore EXACT initial browser state"""
    if not state.driver:
        return
        
    test_name = state.test_name
    print(f"\n🧹 [{test_name}] Starting comprehensive cleanup...")
    
    try:
        # Step 1: Check for console errors during test (before we change anything)
        _check_console_errors(state)
        
        # Step 2: Handle special cases (Close All tests)
        _handle_special_test_cleanup(state)
        
        # Step 3: Close any test tabs we explicitly created
        _close_created_test_tabs(state)
        
        # Step 4: Restore initial state BEFORE closing extension tab
        _restore_exact_initial_state(state)
        
        # Step 5: Close extension tab (this may invalidate session)
        _close_extension_tab(state)
        
        # Step 6: Only verify if we still have a valid session
        if _session_still_valid(state):
            _verify_final_state_matches_initial(state)
        else:
            print(f"✅ [{test_name}] Session ended after extension tab closure (expected)")
        
        print(f"✅ [{test_name}] Cleanup completed successfully")
        
    except Exception as e:
        print(f"❌ [{test_name}] Cleanup error: {e}")
        # Try basic cleanup as fallback
        try:
            if state.extension_handle and state.extension_handle in state.driver.window_handles:
                state.driver.switch_to.window(state.extension_handle)
                if state.extension_id in state.driver.current_url:
                    state.driver.close()
        except:
            pass


def _session_still_valid(state):
    """Check if WebDriver session is still valid"""
    try:
        _ = state.driver.window_handles
        return True
    except:
        return False


def _check_console_errors(state):
    """Check for new console errors that occurred during the test"""
    try:
        log_types = state.driver.log_types
        new_errors = []
        
        for log_type in ['browser', 'driver', 'performance']:
            if log_type in log_types:
                try:
                    current_logs = state.driver.get_log(log_type)
                    # Filter out logs that existed before the test
                    initial_log_messages = {log['message'] for log in state.initial_console_logs}
                    
                    for log in current_logs:
                        if (log['level'] in ['SEVERE', 'WARNING'] and 
                            log['message'] not in initial_log_messages and
                            'chrome-extension://' in log['message']):  # Focus on extension errors
                            new_errors.append(f"[{log['level']}] {log['message']}")
                except:
                    pass
        
        if new_errors:
            print(f"⚠️  [{state.test_name}] Console errors detected during test:")
            for error in new_errors[:5]:  # Show first 5 errors
                print(f"   {error[:100]}")
            if len(new_errors) > 5:
                print(f"   ... and {len(new_errors) - 5} more errors")
        else:
            print(f"✅ [{state.test_name}] No new console errors detected")
            
    except Exception as e:
        print(f"⚠️  [{state.test_name}] Could not check console errors: {e}")


def _handle_special_test_cleanup(state):
    """Handle special cases like Close All tests that close tabs"""
    test_name = state.test_name.lower()
    
    if any(keyword in test_name for keyword in ['close_all', 'closeall', 'close all']):
        print(f"🔄 [{state.test_name}] Detected Close All test - will restore closed tabs")
        
        # For Close All tests, we need to restore tabs that were closed by the test
        current_handles = set(state.driver.window_handles)
        missing_handles = state.initial_handles - current_handles
        
        if missing_handles:
            print(f"   Restoring {len(missing_handles)} tabs closed by Close All")
            for handle, url, title in state.initial_tab_states:
                if handle in missing_handles and url != "about:blank":
                    try:
                        # Recreate the closed tab
                        state.driver.execute_script("window.open('about:blank', '_blank');")
                        time.sleep(0.3)
                        
                        new_handles = set(state.driver.window_handles) - current_handles
                        if new_handles:
                            new_handle = list(new_handles)[0]
                            state.driver.switch_to.window(new_handle)
                            state.driver.get(url)
                            current_handles.add(new_handle)
                            print(f"   Restored: {title[:30]}")
                    except Exception as e:
                        print(f"   Failed to restore {title[:30]}: {e}")


def _close_created_test_tabs(state):
    """Close tabs explicitly created during testing"""
    closed_count = 0
    for handle in state.created_handles.copy():
        try:
            if handle in state.driver.window_handles:
                state.driver.switch_to.window(handle)
                state.driver.close()
                closed_count += 1
        except:
            pass
        state.created_handles.discard(handle)
    
    if closed_count > 0:
        print(f"🗑️  [{state.test_name}] Closed {closed_count} test tabs")


def _close_extension_tab(state):
    """Close extension tab - ALWAYS close it since we open it fresh for each test"""
    if state.extension_handle:
        try:
            if state.extension_handle in state.driver.window_handles:
                state.driver.switch_to.window(state.extension_handle)
                current_url = state.driver.current_url
                print(f"DEBUG: Extension tab URL: {current_url}")
                
                if state.extension_id in current_url:
                    state.driver.close()
                    print(f"🔌 [{state.test_name}] Closed extension tab")
                else:
                    print(f"⚠️  [{state.test_name}] Extension tab URL unexpected: {current_url}")
            else:
                print(f"⚠️  [{state.test_name}] Extension handle not in current handles")
        except Exception as e:
            print(f"⚠️  [{state.test_name}] Error closing extension tab: {e}")
    else:
        print(f"⚠️  [{state.test_name}] No extension handle to close")


def _restore_exact_initial_state(state):
    """Restore each initial tab to its exact original state"""
    current_handles = set(state.driver.window_handles)
    
    for handle, original_url, original_title in state.initial_tab_states:
        if handle in current_handles:
            try:
                state.driver.switch_to.window(handle)
                current_url = state.driver.current_url
                
                # Only restore if URL changed during test
                if current_url != original_url and state.extension_id not in original_url:
                    state.driver.get(original_url)
                    print(f"🔄 [{state.test_name}] Restored tab to: {original_url[:50]}")
                    
            except Exception as e:
                print(f"⚠️  [{state.test_name}] Could not restore tab {handle}: {e}")


def _verify_final_state_matches_initial(state):
    """Verify that final browser state exactly matches initial state"""
    try:
        final_handles = set(state.driver.window_handles)
        
        # Check handle count
        if len(final_handles) != len(state.initial_handles):
            print(f"⚠️  [{state.test_name}] Tab count mismatch: initial={len(state.initial_handles)}, final={len(final_handles)}")
            
            # Show which tabs are missing/extra
            missing = state.initial_handles - final_handles
            extra = final_handles - state.initial_handles
            
            if missing:
                print(f"   Missing {len(missing)} tabs from initial state")
            if extra:
                print(f"   Extra {len(extra)} tabs not in initial state")
        else:
            print(f"✅ [{state.test_name}] Tab count matches: {len(final_handles)} tabs")
        
        # Switch to first available tab for next test
        if final_handles:
            first_handle = list(final_handles)[0]
            state.driver.switch_to.window(first_handle)
            
    except Exception as e:
        print(f"⚠️  [{state.test_name}] Could not verify final state: {e}")


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


def track_tabs_before_close_all(state):
    """Call this before testing Close All functionality to track tabs that will be closed"""
    current_handles = set(state.driver.window_handles)
    state.closed_tabs_by_test = []
    
    for handle in current_handles:
        if handle != state.extension_handle:  # Don't track extension tab
            try:
                state.driver.switch_to.window(handle)
                url = state.driver.current_url
                title = state.driver.title
                state.closed_tabs_by_test.append((handle, url, title))
            except:
                pass
    
    print(f"📋 [{state.test_name}] Tracking {len(state.closed_tabs_by_test)} tabs before Close All")


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