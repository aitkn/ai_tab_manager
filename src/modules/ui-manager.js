/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * UI Manager - handles theme, navigation, status messages, and general UI state
 */

import { DOM_IDS, CSS_CLASSES, TAB_TYPES } from '../utils/constants.js';
import { $id, show, hide, classes } from '../utils/dom-helpers.js';
import StorageService from '../services/StorageService.js';
import { state, updateState, savePopupState } from './state-manager.js';

// Status message timeout
let statusTimeout = null;

// Version info for testing
console.log('UI Manager loaded - v2.2.0');

/**
 * Initialize theme system
 */
export function initializeTheme() {
  // Load saved theme or use system default
  StorageService.loadTheme().then(savedTheme => {
    applyTheme(savedTheme);
    updateThemeButtons(savedTheme);
  });
}

/**
 * Set and save theme
 * @param {string} theme - Theme name (system, light, dark)
 */
export function setTheme(theme) {
  console.log('setTheme called with:', theme);
  applyTheme(theme);
  updateThemeButtons(theme);
  StorageService.saveTheme(theme);
}

/**
 * Apply theme to document
 * @param {string} theme - Theme name
 */
function applyTheme(theme) {
  const body = document.body;
  
  if (theme === 'system') {
    body.removeAttribute('data-theme');
  } else {
    body.setAttribute('data-theme', theme);
  }
}

/**
 * Update theme button states
 * @param {string} activeTheme - Currently active theme
 */
function updateThemeButtons(activeTheme) {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    classes.toggle(btn, CSS_CLASSES.TAB_PANE_ACTIVE, btn.dataset.theme === activeTheme);
  });
}

/**
 * Initialize tab navigation system
 */
export function initializeTabNavigation() {
  // Add click listeners to tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchToTab(tabName);
    });
  });
}

/**
 * Switch to a specific tab
 * @param {string} tabName - Tab to switch to
 */
export async function switchToTab(tabName) {
  console.log('DEBUG: Switching to tab:', tabName, 'from:', state.activeTab);
  
  // Save current scroll position before switching
  const savedContent = document.getElementById('savedContent');
  if (savedContent && state.popupState.activeTab === 'saved') {
    const scrollPos = savedContent.scrollTop;
    console.log(`💾 UI: Saving scroll position for saved tab: ${scrollPos}px`);
    state.popupState.scrollPositions.saved = scrollPos;
    // Save immediately
    savePopupState();
  }
  
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const shouldBeActive = btn.dataset.tab === tabName;
    console.log('Tab button:', btn.dataset.tab, 'active:', shouldBeActive);
    
    if (shouldBeActive) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    const shouldBeActive = pane.id === `${tabName}Tab`;
    console.log('Tab pane:', pane.id, 'active:', shouldBeActive);
    
    if (shouldBeActive) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });
  
  // Clear status message when switching tabs (except saved which sets its own)
  if (tabName !== TAB_TYPES.SAVED) {
    clearStatus();
  }
  
  // Update active tab in state
  updateState('activeTab', tabName);
  state.popupState.activeTab = tabName;
  
  // Handle tab-specific actions
  if (tabName === TAB_TYPES.SAVED) {
    updateState('isViewingSaved', true);
    
    // Trigger saved tab content loading/restoration
    // This will handle scroll position restoration properly
    const { updateSavedTabContent } = await import('./content-manager.js');
    await updateSavedTabContent();
  } else {
    updateState('isViewingSaved', false);
    
    if (tabName === TAB_TYPES.SETTINGS) {
      hideApiKeyPrompt();
    } else if (tabName === TAB_TYPES.CATEGORIZE) {
      // When switching back to Current tab, refresh content to ensure accuracy
      const { markContentDirty, updateCurrentTabContent } = await import('./content-manager.js');
      markContentDirty('current');
      await updateCurrentTabContent(true); // Force refresh when switching to Current tab
    }
  }
  
  // Update unified toolbar visibility
  const { updateToolbarVisibility } = await import('./unified-toolbar.js');
  await updateToolbarVisibility(tabName);
}

/**
 * Show status message
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error, warning, loading)
 * @param {number} duration - Duration in ms (0 = permanent)
 */
export function showStatus(message, type = 'success', duration = 5000) {
  const statusEl = $id(DOM_IDS.STATUS);
  if (!statusEl) return;
  
  // Clear previous timeout
  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }
  
  // Remove all status classes
  statusEl.className = 'status';
  
  // Add new status class
  if (type) {
    classes.add(statusEl, type);
  }
  
  // Set message and show
  statusEl.textContent = message;
  show(statusEl);
  
  // Auto-hide after duration (unless 0)
  if (duration > 0) {
    statusTimeout = setTimeout(() => {
      clearStatus();
    }, duration);
  }
}

/**
 * Clear status message
 */
export function clearStatus() {
  const statusEl = $id(DOM_IDS.STATUS);
  if (!statusEl) return;
  
  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }
  
  statusEl.textContent = '';
  statusEl.className = 'status';
}

/**
 * Update badge on categorize tab
 */
export async function updateCategorizeBadge() {
  const badge = $id(DOM_IDS.CATEGORIZE_BADGE);
  if (!badge) return;
  
  // Get current tabs from background
  const { getCurrentTabs } = await import('./tab-data-source.js');
  const { categorizedTabs } = await getCurrentTabs();
  
  const totalCategorized = Object.values(categorizedTabs)
    .reduce((sum, tabs) => sum + (tabs ? tabs.length : 0), 0);
  
  if (totalCategorized > 0) {
    badge.textContent = totalCategorized;
    show(badge);
  } else {
    hide(badge);
  }
  
  // Also update categorize button state
  await updateLegacyCategorizeButtonState();
}

/**
 * Update old categorize button enable/disable state (legacy)
 */
export async function updateLegacyCategorizeButtonState() {
  const categorizeBtn = $id(DOM_IDS.CATEGORIZE_BTN);
  if (!categorizeBtn) return;
  
  // Get current tabs from background
  const { getCurrentTabs } = await import('./tab-data-source.js');
  const { categorizedTabs } = await getCurrentTabs();
  
  const uncategorizedCount = categorizedTabs && categorizedTabs[0] 
    ? categorizedTabs[0].length 
    : 0;
  
  const hasUncategorized = uncategorizedCount > 0;
  
  // Update button text to show count
  const buttonText = categorizeBtn.querySelector('text') || categorizeBtn.lastChild;
  if (buttonText && buttonText.nodeType === Node.TEXT_NODE) {
    buttonText.textContent = hasUncategorized 
      ? ` Categorize (${uncategorizedCount})`
      : ' Categorize';
  }
  
  categorizeBtn.disabled = !hasUncategorized;
  categorizeBtn.title = hasUncategorized ? 
    `Categorize ${uncategorizedCount} uncategorized tabs using AI` : 
    'No uncategorized tabs';
}

/**
 * Update badge on saved tab
 * @param {number} count - Number of saved tabs
 */
export function updateSavedBadge(count) {
  const badge = $id(DOM_IDS.SAVED_BADGE);
  if (!badge) return;
  
  if (count > 0) {
    badge.textContent = count;
    show(badge);
  } else {
    hide(badge);
  }
}

/**
 * Show API key prompt
 */
export function showApiKeyPrompt() {
  show($id(DOM_IDS.API_KEY_PROMPT));
}

/**
 * Hide API key prompt
 */
export function hideApiKeyPrompt() {
  hide($id(DOM_IDS.API_KEY_PROMPT));
}

/**
 * Download data as file
 * @param {string} content - File content
 * @param {string} filename - Filename to save as
 * @param {string} mimeType - MIME type
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate markdown for tabs
 * @param {Array} tabs - Tabs to generate markdown for
 * @param {string} categoryName - Category name
 * @returns {string} Markdown content
 */
export function generateMarkdown(tabs, categoryName) {
  let markdown = `# ${categoryName}\n\n`;
  
  tabs.forEach(tab => {
    const title = tab.title || 'Untitled';
    const url = tab.url;
    markdown += `- [${title}](${url})\n`;
  });
  
  return markdown;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showStatus('Copied to clipboard!', 'success', 3000);
  } catch (error) {
    console.error('Failed to copy:', error);
    showStatus('Failed to copy to clipboard', 'error');
  }
}

/**
 * Check if dark mode is active
 * @returns {boolean}
 */
export function isDarkMode() {
  const theme = document.body.getAttribute('data-theme');
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  
  // System theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Toggle element visibility
 * @param {string} elementId - Element ID
 * @param {boolean} show - Force show/hide
 */
export function toggleElement(elementId, show) {
  const element = $id(elementId);
  if (!element) return;
  
  if (show !== undefined) {
    show ? show(element) : hide(element);
  } else {
    element.style.display === 'none' ? show(element) : hide(element);
  }
}

// Export default object
export default {
  initializeTheme,
  setTheme,
  initializeTabNavigation,
  switchToTab,
  showStatus,
  clearStatus,
  updateCategorizeBadge,
  updateSavedBadge,
  showApiKeyPrompt,
  hideApiKeyPrompt,
  downloadFile,
  generateMarkdown,
  copyToClipboard,
  isDarkMode,
  toggleElement
};