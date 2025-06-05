/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Constants extracted from popup.js for better maintainability
 */

// Tab Categories
export const TAB_CATEGORIES = {
  CAN_CLOSE: 1,
  SAVE_LATER: 2,
  IMPORTANT: 3
};

export const CATEGORY_NAMES = {
  [TAB_CATEGORIES.CAN_CLOSE]: 'Can Be Closed',
  [TAB_CATEGORIES.SAVE_LATER]: 'Save for Later',
  [TAB_CATEGORIES.IMPORTANT]: 'Important'
};

// DOM Element IDs
export const DOM_IDS = {
  // Main containers
  TABS_CONTAINER: 'tabsContainer',
  SAVED_CONTENT: 'savedContent',
  SAVED_TABS_CONTAINER: 'savedTabsContainer',
  
  // Tab navigation
  CATEGORIZE_TAB: 'categorizeTab',
  SAVED_TAB: 'savedTab',
  SETTINGS_TAB: 'settingsTab',
  
  // Buttons
  CATEGORIZE_BTN: 'categorizeBtn',
  SAVE_AND_CLOSE_ALL_BTN: 'saveAndCloseAllBtn',
  EXPORT_CSV_BTN: 'exportCSVBtn',
  IMPORT_CSV_BTN: 'importCSVBtn',
  SAVE_API_KEY_BTN: 'saveApiKeyBtn',
  RESET_PROMPT_BTN: 'resetPromptBtn',
  OPEN_SETTINGS_BTN: 'openSettingsBtn',
  TOGGLE_ALL_GROUPS_BTN: 'toggleAllGroupsBtn',
  TOGGLE_CATEGORIZE_GROUPS_BTN: 'toggleCategorizeGroupsBtn',
  CLEAR_SEARCH_BTN: 'clearSearchBtn',
  CLEAR_SAVED_SEARCH_BTN: 'clearSavedSearchBtn',
  
  // Input elements
  SEARCH_INPUT: 'searchInput',
  SAVED_SEARCH_INPUT: 'savedSearchInput',
  API_KEY_INPUT: 'apiKeyInput',
  MAX_TABS_INPUT: 'maxTabsInput',
  PROMPT_TEXTAREA: 'promptTextarea',
  CSV_FILE_INPUT: 'csvFileInput',
  
  // Select elements
  GROUPING_SELECT: 'groupingSelect',
  SAVED_GROUPING_SELECT: 'savedGroupingSelect',
  PROVIDER_SELECT: 'providerSelect',
  MODEL_SELECT: 'modelSelect',
  
  // Other elements
  STATUS: 'status',
  API_KEY_PROMPT: 'apiKeyPrompt',
  SEARCH_CONTROLS: 'searchControls',
  SAVED_SEARCH_CONTROLS: 'savedSearchControls',
  CATEGORIZE_GROUPING_CONTROLS: 'categorizeGroupingControls',
  SAVED_GROUPING_CONTROLS: 'savedGroupingControls',
  CATEGORY_VIEW: 'categoryView',
  GROUPED_VIEW: 'groupedView',
  PROMPT_STATUS: 'promptStatus',
  CATEGORIZE_BADGE: 'categorizeBadge',
  SAVED_BADGE: 'savedBadge',
  
  // Category sections
  CATEGORY_1: 'category1',
  CATEGORY_2: 'category2',
  CATEGORY_3: 'category3'
};

// CSS Classes
export const CSS_CLASSES = {
  // Status classes
  STATUS_SUCCESS: 'success',
  STATUS_ERROR: 'error',
  STATUS_WARNING: 'warning',
  STATUS_LOADING: 'loading',
  
  // Tab states
  TAB_PANE_ACTIVE: 'active',
  TAB_BTN: 'tab-btn',
  TAB_ITEM: 'tab-item',
  TAB_ITEM_HIDDEN: 'hidden',
  TAB_ALREADY_SAVED: 'already-saved',
  
  // Category classes
  CATEGORY_SECTION: 'category-section',
  CATEGORY_HEADER: 'category-header',
  CATEGORY_IMPORTANT: 'important',
  CATEGORY_SOMEWHAT_IMPORTANT: 'somewhat-important',
  CATEGORY_NOT_IMPORTANT: 'not-important',
  CATEGORY_EMPTY: 'empty',
  CATEGORY_COLLAPSED: 'collapsed',
  
  // Group classes
  GROUP_SECTION: 'group-section',
  GROUP_STATS: 'group-stats',
  GROUP_COLLAPSED: 'collapsed',
  
  // Button classes
  PRIMARY_BTN: 'primary-btn',
  SECONDARY_BTN: 'secondary-btn',
  DANGER_BTN: 'danger-btn',
  ICON_BTN: 'icon-btn',
  ICON_BTN_SMALL: 'icon-btn-small',
  THEME_BTN: 'theme-btn',
  
  // Other
  TABS_LIST: 'tabs-list',
  SEARCH_INPUT: 'search-input',
  INLINE_ACTION_BTN: 'inline-action-btn'
};

// Display States
export const DISPLAY = {
  NONE: 'none',
  BLOCK: 'block',
  FLEX: 'flex'
};

// Event Types
export const EVENTS = {
  CLICK: 'click',
  CHANGE: 'change',
  INPUT: 'input',
  SCROLL: 'scroll',
  BLUR: 'blur',
  DOM_CONTENT_LOADED: 'DOMContentLoaded'
};

// Grouping Options
export const GROUPING_OPTIONS = {
  CATEGORY: 'category',
  DOMAIN: 'domain',
  SAVED_DATE: 'savedDate',
  SAVED_WEEK: 'savedWeek',
  SAVED_MONTH: 'savedMonth',
  LAST_ACCESSED_DATE: 'lastAccessedDate',
  LAST_ACCESSED_WEEK: 'lastAccessedWeek',
  LAST_ACCESSED_MONTH: 'lastAccessedMonth'
};

// Tab Types
export const TAB_TYPES = {
  CATEGORIZE: 'categorize',
  SAVED: 'saved',
  SETTINGS: 'settings'
};

// Numeric Constants
export const LIMITS = {
  MAX_TABS_DEFAULT: 50,
  MAX_TABS_LIMIT: 200,
  MIN_TABS_LIMIT: 1,
  SCROLL_RESTORE_DELAY: 100,
  SCROLL_RESTORE_RETRY_1: 500,
  SCROLL_RESTORE_RETRY_2: 1000,
  BATCH_DELAY_MS: 100
};

// External URLs
export const URLS = {
  FAVICON_API: 'https://www.google.com/s2/favicons?domain={domain}&sz=16',
  GITHUB_REPO: 'https://github.com/aitkn/ai_tab_manager'
};

// Storage Keys
export const STORAGE_KEYS = {
  POPUP_STATE: 'popupState',
  SETTINGS: 'settings',
  THEME: 'theme'
};

// Status Messages
export const STATUS_MESSAGES = {
  LOADING: 'Categorizing tabs...',
  SUCCESS_CATEGORIZED: 'Tabs categorized successfully!',
  SUCCESS_SAVED: 'tabs saved and closed successfully!',
  ERROR_NO_API_KEY: 'Please configure your LLM provider and API key in Settings',
  ERROR_CATEGORIZATION: 'Error categorizing tabs:',
  WARNING_NO_TABS: 'No tabs to save'
};