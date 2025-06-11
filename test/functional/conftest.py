#!/usr/bin/env python3
"""
Pytest configuration and fixtures for Chrome Extension functional tests
"""

import pytest
import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By


def get_chrome_debug_address():
    """Get Chrome remote debugging address from environment or default"""
    return os.environ.get('CHROME_DEBUG_ADDRESS', '127.0.0.1:9222')


def get_chrome_debug_url():
    """Get Chrome DevTools Protocol URL"""
    address = get_chrome_debug_address()
    return f'http://{address}'


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
        debug_address = get_chrome_debug_address()
        chrome_options.add_experimental_option("debuggerAddress", debug_address)
        
        # Fix chromedriver path issue - ensure we use the actual chromedriver executable
        chromedriver_path = ChromeDriverManager().install()
        if chromedriver_path.endswith('THIRD_PARTY_NOTICES.chromedriver'):
            # WebDriverManager bug - fix the path
            chromedriver_path = chromedriver_path.replace('THIRD_PARTY_NOTICES.chromedriver', 'chromedriver')
        
        service = Service(chromedriver_path)
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
                    
                    # CRITICAL: Update initial state to reflect the handle swap
                    # The original tab handle is now the extension, new handle has original URL
                    for i, (handle, url, title) in enumerate(state.initial_tab_states):
                        if handle == current_handle:  # This handle is now the extension
                            # Update to point to the new handle with original URL
                            state.initial_tab_states[i] = (new_handle, url, title)
                            print(f"DEBUG: Updated initial state: {handle} -> {new_handle} for {url}")
                            break
                    
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
        
        # Step 4: Check if we need to restore initial tabs before closing extension
        current_handles = set(state.driver.window_handles)
        if len(current_handles) <= 1 and state.extension_handle in current_handles:
            # Extension is the only tab - restore initial tabs first
            print(f"🔄 [{test_name}] Extension is only tab - restoring initial tabs before cleanup")
            _restore_exact_initial_state(state)
        
        # Step 5: Close extension tab (this may invalidate session)
        _close_extension_tab(state)
        
        # Step 6: Restore remaining initial state if needed
        if _session_still_valid(state):
            _restore_exact_initial_state(state)
        
        # Step 7: Only verify if we still have a valid session
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
        print(f"🔄 [{state.test_name}] Detected Close All test - managing tab restoration")
        
        # For Close All tests, we need to be careful about what to restore
        current_handles = set(state.driver.window_handles)
        
        # Find which initial tabs were closed (but exclude test tabs we created)
        missing_initial_tabs = []
        for handle, url, title in state.initial_tab_states:
            if handle not in current_handles and handle not in state.created_handles:
                # This is an initial tab that was closed by Close All (not a test tab)
                missing_initial_tabs.append((handle, url, title))
        
        # Check if any initial tabs were already restored by the test itself
        already_restored_urls = set()
        for handle in current_handles:
            try:
                state.driver.switch_to.window(handle)
                url = state.driver.current_url
                already_restored_urls.add(url)
            except:
                pass
        
        # Only restore tabs that haven't been restored yet
        tabs_to_restore = []
        for handle, url, title in missing_initial_tabs:
            if url not in already_restored_urls and url != "about:blank" and state.extension_id not in url:
                tabs_to_restore.append((handle, url, title))
        
        if tabs_to_restore:
            print(f"   Restoring {len(tabs_to_restore)} initial tabs closed by Close All")
            for handle, url, title in tabs_to_restore:
                try:
                    # Use CDP for more reliable tab creation
                    import requests
                    debug_url = get_chrome_debug_url()
                    response = requests.put(f'{debug_url}/json/new?url={url}', timeout=5)
                    if response.status_code == 200:
                        time.sleep(0.5)  # Wait for tab to be created and load
                        print(f"   Restored: {title[:30]}")
                    else:
                        # Fallback to window.open
                        state.driver.execute_script("window.open('about:blank', '_blank');")
                        time.sleep(0.3)
                        
                        new_handles = set(state.driver.window_handles) - current_handles
                        if new_handles:
                            new_handle = list(new_handles)[0]
                            state.driver.switch_to.window(new_handle)
                            state.driver.get(url)
                            current_handles.add(new_handle)
                            print(f"   Restored (fallback): {title[:30]}")
                except Exception as e:
                    print(f"   Failed to restore {title[:30]}: {e}")
        else:
            print(f"   All initial tabs already restored or not needed")
        
        # For Close All tests, don't try to close test tabs in the regular cleanup
        # since they were already closed by the Close All functionality
        # Clear the created_handles so regular cleanup doesn't try to close them again
        closed_by_close_all = state.created_handles.intersection(current_handles)
        if len(closed_by_close_all) < len(state.created_handles):
            print(f"   Test tabs were already closed by Close All - skipping regular test tab cleanup")
            state.created_handles.clear()  # Prevent double-cleanup


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
            current_handles = state.driver.window_handles
            if state.extension_handle in current_handles:
                # CRITICAL: Never close the browser by closing the last tab
                if len(current_handles) <= 1:
                    print(f"⚠️  [{state.test_name}] Not closing extension tab - it's the only tab (would close browser)")
                    return
                
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
                
                # Skip if this is now the extension tab (don't modify extension tab)
                if state.extension_id in current_url:
                    print(f"🔄 [{state.test_name}] Skipping extension tab restoration")
                    continue
                
                # Only restore if URL changed during test and it's not an extension URL
                if current_url != original_url and state.extension_id not in original_url:
                    state.driver.get(original_url)
                    print(f"🔄 [{state.test_name}] Restored tab to: {original_url[:50]}")
                    
            except Exception as e:
                print(f"⚠️  [{state.test_name}] Could not restore tab {handle}: {e}")


def _verify_final_state_matches_initial(state):
    """Verify that final browser state exactly matches initial state"""
    try:
        final_handles = set(state.driver.window_handles)
        test_name = state.test_name.lower()
        is_close_all_test = any(keyword in test_name for keyword in ['close_all', 'closeall', 'close all'])
        
        if is_close_all_test:
            # For Close All tests, verify URLs match rather than exact handles
            # since restoration may create new tabs with different handles
            expected_urls = {url for handle, url, title in state.initial_tab_states}
            actual_urls = set()
            
            for handle in final_handles:
                try:
                    state.driver.switch_to.window(handle)
                    url = state.driver.current_url
                    actual_urls.add(url)
                except:
                    pass
            
            missing_urls = expected_urls - actual_urls
            extra_urls = actual_urls - expected_urls
            
            # Remove extension URLs from comparison (they're expected to vary)
            missing_urls = {url for url in missing_urls if state.extension_id not in url}
            extra_urls = {url for url in extra_urls if state.extension_id not in url}
            
            url_issues = missing_urls or extra_urls
            count_mismatch = len(final_handles) != len(state.initial_handles)
            
            if url_issues or count_mismatch:
                print(f"❌ [{state.test_name}] Close All state verification FAILED:")
                if count_mismatch:
                    print(f"   Tab count: initial={len(state.initial_handles)}, final={len(final_handles)}")
                if missing_urls:
                    print(f"   Missing URLs: {list(missing_urls)}")
                if extra_urls:
                    print(f"   Extra URLs: {list(extra_urls)}")
                
                # Don't fail for minor URL differences in Close All tests
                if len(missing_urls) == 0 and len(extra_urls) == 0:
                    print(f"✅ [{state.test_name}] URLs match despite handle differences (acceptable for Close All)")
                else:
                    import pytest
                    pytest.fail(f"Close All state verification failed: {len(missing_urls)} missing URLs, {len(extra_urls)} extra URLs")
            else:
                print(f"✅ [{state.test_name}] Close All state verification PASSED: {len(final_handles)} tabs, all URLs match")
        else:
            # For regular tests, check exact handle match (more strict)
            missing_handles = state.initial_handles - final_handles
            extra_handles = final_handles - state.initial_handles
            
            # Check URLs of remaining tabs
            url_mismatches = []
            for handle, expected_url, expected_title in state.initial_tab_states:
                if handle in final_handles:
                    try:
                        state.driver.switch_to.window(handle)
                        actual_url = state.driver.current_url
                        if actual_url != expected_url:
                            url_mismatches.append(f"Tab {handle[:8]}: expected {expected_url[:50]}, got {actual_url[:50]}")
                    except:
                        url_mismatches.append(f"Tab {handle[:8]}: could not read URL")
            
            # Check count mismatch
            count_mismatch = len(final_handles) != len(state.initial_handles)
            
            # Report all issues
            has_issues = count_mismatch or missing_handles or extra_handles or url_mismatches
            
            if has_issues:
                print(f"❌ [{state.test_name}] State verification FAILED:")
                
                if count_mismatch:
                    print(f"   Tab count: initial={len(state.initial_handles)}, final={len(final_handles)}")
                
                if missing_handles:
                    print(f"   Missing {len(missing_handles)} tabs from initial state")
                    for i, (handle, url, title) in enumerate(state.initial_tab_states):
                        if handle in missing_handles:
                            print(f"     Missing: {title[:30]} - {url[:50]}")
                
                if extra_handles:
                    print(f"   Extra {len(extra_handles)} tabs not in initial state")
                    for handle in extra_handles:
                        try:
                            state.driver.switch_to.window(handle)
                            url = state.driver.current_url
                            title = state.driver.title
                            print(f"     Extra: {title[:30]} - {url[:50]}")
                        except:
                            print(f"     Extra: {handle[:8]} - could not read")
                
                if url_mismatches:
                    print(f"   URL mismatches in {len(url_mismatches)} tabs:")
                    for mismatch in url_mismatches:
                        print(f"     {mismatch}")
                
                # Only fail the test if there are significant issues
                import pytest
                pytest.fail(f"Browser state verification failed: {len(missing_handles)} missing, {len(extra_handles)} extra, {len(url_mismatches)} URL mismatches")
            else:
                print(f"✅ [{state.test_name}] State verification PASSED: {len(final_handles)} tabs, all URLs match")
        
        # Switch to first available tab for next test
        if final_handles:
            first_handle = list(final_handles)[0]
            state.driver.switch_to.window(first_handle)
            
    except Exception as e:
        print(f"⚠️  [{state.test_name}] Could not verify final state: {e}")
        import pytest
        pytest.fail(f"State verification error: {e}")


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
            # Use Chrome DevTools Protocol to create tab (more reliable than window.open)
            import requests
            import json
            
            before_handles = set(state.driver.window_handles)
            print(f"   Before creating {url}: {len(before_handles)} tabs")
            
            try:
                # Create new tab via Chrome DevTools Protocol (use PUT with URL as query param)
                debug_url = get_chrome_debug_url()
                response = requests.put(f'{debug_url}/json/new?url={url}',
                                       timeout=5)
                
                if response.status_code == 200:
                    time.sleep(0.5)  # Wait for tab to appear in WebDriver
                    
                    after_handles = set(state.driver.window_handles)
                    new_handles = after_handles - before_handles
                    print(f"   After CDP create: {len(after_handles)} tabs, new: {len(new_handles)}")
                    
                    if new_handles:
                        new_handle = list(new_handles)[0]
                        state.driver.switch_to.window(new_handle)
                        
                        # Check current URL and navigate if needed
                        current_url = state.driver.current_url
                        print(f"   Current URL after CDP: {current_url}")
                        
                        if current_url != url and current_url == "about:blank":
                            print(f"   Navigating to: {url}")
                            state.driver.get(url)
                            
                            # Wait for navigation to complete
                            from selenium.webdriver.support.ui import WebDriverWait
                            
                            try:
                                WebDriverWait(state.driver, 5).until(
                                    lambda driver: driver.current_url != "about:blank"
                                )
                                time.sleep(0.3)  # Small additional delay as suggested
                                final_url = state.driver.current_url
                                print(f"   ✅ Created and loaded tab: {final_url}")
                            except Exception as load_error:
                                print(f"   ⚠️  Tab created but load timeout for {url}: {load_error}")
                        else:
                            print(f"   ✅ Tab already at correct URL: {current_url}")
                        
                        state.created_handles.add(new_handle)
                        created_handles.append(new_handle)
                    else:
                        print(f"   ❌ CDP created tab but not detected in WebDriver for: {url}")
                else:
                    print(f"   ❌ CDP request failed for {url}: HTTP {response.status_code}")
                    
            except Exception as cdp_error:
                print(f"   ❌ CDP error for {url}: {cdp_error}")
                # Fallback to window.open approach
                try:
                    state.driver.execute_script("window.open('about:blank', '_blank');")
                    time.sleep(0.5)
                    after_handles = set(state.driver.window_handles)
                    new_handles = after_handles - before_handles
                    if new_handles:
                        new_handle = list(new_handles)[0]
                        state.driver.switch_to.window(new_handle)
                        state.driver.get(url)
                        time.sleep(1)
                        state.created_handles.add(new_handle)
                        created_handles.append(new_handle)
                        print(f"   ✅ Fallback created tab: {url}")
                    else:
                        print(f"   ❌ Both CDP and fallback failed for: {url}")
                except Exception as fallback_error:
                    print(f"   ❌ Fallback also failed for {url}: {fallback_error}")
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