/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Pure helper functions extracted from popup.js
 */

/**
 * Extract root domain from a full domain
 * @param {string} domain - Full domain (e.g., 'sub.example.co.uk')
 * @returns {string} Root domain (e.g., 'example.co.uk')
 */
export function getRootDomain(domain) {
  if (!domain) return 'unknown';
  
  // Handle special cases
  if (domain.startsWith('chrome://')) return 'chrome';
  if (domain.startsWith('file://')) return 'local-file';
  if (domain.startsWith('chrome-extension://')) return 'extension';
  
  // Remove www. prefix
  domain = domain.replace(/^www\./, '');
  
  // Handle special TLDs (could be expanded)
  const specialTLDs = ['co.uk', 'com.au', 'co.jp', 'co.in', 'com.br'];
  for (const tld of specialTLDs) {
    if (domain.endsWith(tld)) {
      const parts = domain.split('.');
      if (parts.length > 3) {
        return parts.slice(-3).join('.');
      }
      return domain;
    }
  }
  
  // Default: last two parts
  const parts = domain.split('.');
  if (parts.length > 2) {
    return parts.slice(-2).join('.');
  }
  return domain;
}

/**
 * Extract subdomain from a full domain
 * @param {string} fullDomain - Full domain
 * @param {string} rootDomain - Root domain
 * @returns {string} Subdomain or empty string
 */
export function getSubdomain(fullDomain, rootDomain) {
  if (fullDomain === rootDomain) return '';
  const subdomain = fullDomain.replace(`.${rootDomain}`, '');
  return subdomain === fullDomain ? '' : subdomain;
}

/**
 * Extract date from various group name formats
 * @param {string} groupName - Group name containing date info
 * @returns {Date} Parsed date or current date if parsing fails
 */
export function extractDateFromGroupName(groupName) {
  // Handle relative dates
  if (groupName === 'Today') {
    return new Date();
  }
  if (groupName === 'Yesterday') {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  }
  if (groupName === 'This Week') {
    return new Date(); // Current week
  }
  if (groupName === 'Last Week') {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date;
  }
  
  // Handle "X days ago" format
  const daysAgoMatch = groupName.match(/(\d+) days ago/);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1]);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }
  
  // Handle "Week of Mon DD" format
  const weekOfMatch = groupName.match(/Week of (\w+) (\d+)/);
  if (weekOfMatch) {
    const currentYear = new Date().getFullYear();
    const monthName = weekOfMatch[1];
    const day = parseInt(weekOfMatch[2]);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames.indexOf(monthName);
    if (month !== -1) {
      return new Date(currentYear, month, day);
    }
  }
  
  // Handle month names
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  for (let i = 0; i < monthNames.length; i++) {
    if (groupName.includes(monthNames[i])) {
      return new Date(new Date().getFullYear(), i, 1);
    }
  }
  
  // Default to current date
  return new Date();
}

/**
 * Sort tabs within a group based on grouping type
 * @param {Array} tabs - Array of tabs to sort
 * @param {string} groupingType - Type of grouping
 * @returns {Array} Sorted array of tabs
 */
export function sortTabsInGroup(tabs, groupingType) {
  return tabs.sort((a, b) => {
    switch (groupingType) {
      case 'category':
        // Keep original order for category grouping
        return 0;
        
      case 'domain':
        // Sort by subdomain, then by title
        const rootDomainA = getRootDomain(a.domain);
        const rootDomainB = getRootDomain(b.domain);
        const subdomainA = getSubdomain(a.domain, rootDomainA);
        const subdomainB = getSubdomain(b.domain, rootDomainB);
        
        if (subdomainA !== subdomainB) {
          return subdomainA.localeCompare(subdomainB);
        }
        return a.title.localeCompare(b.title);
        
      case 'savedDate':
      case 'savedWeek':
      case 'savedMonth':
        // Sort by saved date (newest first)
        return (b.savedAt || 0) - (a.savedAt || 0);
        
      case 'lastAccessedDate':
      case 'lastAccessedWeek':
      case 'lastAccessedMonth':
        // Sort by last accessed date (newest first)
        return (b.lastAccessed || b.savedAt || 0) - (a.lastAccessed || a.savedAt || 0);
        
      default:
        return 0;
    }
  });
}

/**
 * Get ISO week number for a date
 * @param {Date} date - Date to get week number for
 * @returns {number} ISO week number (1-53)
 */
export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Get the Monday of the week for a given date
 * @param {Date} date - Date to get week start for
 * @returns {Date} Monday of that week
 */
export function getWeekStartDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
}

/**
 * Fallback categorization when API is unavailable
 * @param {Array} tabs - Array of tabs to categorize
 * @returns {Object} Categorized tabs {1: [], 2: [], 3: []}
 */
export function fallbackCategorization(tabs) {
  const categorized = { 1: [], 2: [], 3: [] };
  
  const frequentDomains = CONFIG?.FREQUENT_DOMAINS || [
    'mail.google.com', 'gmail.com', 'x.com', 'twitter.com', 
    'youtube.com', 'google.com', 'facebook.com', 'instagram.com', 
    'linkedin.com', 'reddit.com', 'github.com'
  ];
  
  tabs.forEach(tab => {
    const url = tab.url.toLowerCase();
    const title = tab.title.toLowerCase();
    
    // Category 1: Can be closed
    if (url.includes('chrome://') || 
        url.includes('chrome-extension://') ||
        url === 'about:blank' ||
        title.includes('404') ||
        title.includes('error') ||
        title.includes('not found') ||
        url.includes('/login') ||
        url.includes('/signin') ||
        url.includes('/auth') ||
        frequentDomains.some(domain => url.includes(domain) && !url.includes('/status/'))) {
      categorized[1].push(tab);
    }
    // Category 3: Important
    else if (url.includes('claude.ai/chat/') ||
             url.includes('chatgpt.com/') ||
             url.includes('chat.openai.com/') ||
             url.includes('grok.com/chat/') ||
             url.includes('github.com/') && !url.endsWith('github.com/') ||
             url.includes('/docs/') ||
             url.includes('/documentation/') ||
             url.includes('/api/') ||
             title.includes('documentation')) {
      categorized[3].push(tab);
    }
    // Category 2: Save for later (default)
    else {
      categorized[2].push(tab);
    }
  });
  
  return categorized;
}

/**
 * Extract domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain or 'unknown'
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Format timestamp to readable date
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format timestamp to readable date and time
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

/**
 * Check if URL is valid
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'file:', 'chrome:', 'chrome-extension:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text with ellipsis if needed
 */
export function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Group array items by a key function
 * @param {Array} items - Items to group
 * @param {Function} keyFn - Function to get group key from item
 * @returns {Object} Grouped items
 */
export function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}