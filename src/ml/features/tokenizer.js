/*
 * AI Tab Manager - Text Tokenizer
 * Tokenization for URLs and titles
 */

/**
 * Tokenize a URL into meaningful parts
 * @param {string} url - URL to tokenize
 * @returns {Array<string>} Array of tokens
 */
export function tokenizeURL(url) {
  try {
    const urlObj = new URL(url);
    const tokens = [];
    
    // Protocol (without colon)
    tokens.push(urlObj.protocol.replace(':', ''));
    
    // Hostname parts
    const hostParts = urlObj.hostname.split('.');
    tokens.push(...hostParts);
    
    // Path segments
    const pathSegments = urlObj.pathname
      .split(/[\/\-_\.]/)
      .filter(segment => segment.length > 1 && !/^\d+$/.test(segment)); // Filter out numbers and single chars
    tokens.push(...pathSegments);
    
    // Query parameter keys (not values for privacy)
    if (urlObj.search) {
      const params = new URLSearchParams(urlObj.search);
      for (const key of params.keys()) {
        tokens.push(key);
      }
    }
    
    // Clean and normalize tokens
    return tokens
      .map(token => token.toLowerCase())
      .filter(token => token.length > 0 && token !== 'www');
      
  } catch (error) {
    // Fallback for invalid URLs
    return url
      .toLowerCase()
      .split(/[^\w]+/)
      .filter(token => token.length > 1);
  }
}

/**
 * Tokenize a title into words
 * @param {string} title - Title to tokenize
 * @returns {Array<string>} Array of tokens
 */
export function tokenizeTitle(title) {
  if (!title) return [];
  
  // Remove special characters and split by whitespace
  const tokens = title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1);
  
  // Remove common stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
    'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
    'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'some',
    'any', 'few', 'more', 'most', 'other', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over',
    'under', 'again', 'then', 'once'
  ]);
  
  return tokens.filter(token => !stopWords.has(token));
}

/**
 * Extract n-grams from tokens
 * @param {Array<string>} tokens - Array of tokens
 * @param {number} n - Size of n-grams
 * @returns {Array<string>} Array of n-grams
 */
export function extractNGrams(tokens, n = 2) {
  const ngrams = [];
  
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join('_'));
  }
  
  return ngrams;
}

/**
 * Combine URL and title tokens with proper weighting
 * @param {Array<string>} urlTokens - URL tokens
 * @param {Array<string>} titleTokens - Title tokens
 * @returns {Array<string>} Combined tokens
 */
export function combineTokens(urlTokens, titleTokens) {
  // Give more weight to domain and title tokens
  const combined = [];
  
  // Domain tokens (first few URL tokens) get added twice
  combined.push(...urlTokens.slice(0, 3));
  combined.push(...urlTokens.slice(0, 3));
  
  // All URL tokens
  combined.push(...urlTokens);
  
  // Title tokens get added twice for importance
  combined.push(...titleTokens);
  combined.push(...titleTokens);
  
  return combined;
}

/**
 * Clean and normalize a token
 * @param {string} token - Token to clean
 * @returns {string} Cleaned token
 */
export function cleanToken(token) {
  return token
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Check if token is valid
 * @param {string} token - Token to check
 * @returns {boolean} True if valid
 */
export function isValidToken(token) {
  // Token should be:
  // - At least 2 characters
  // - Not all numbers
  // - Not a common file extension
  const invalidExtensions = new Set(['html', 'htm', 'php', 'asp', 'jsp', 'cgi']);
  
  return token.length >= 2 && 
         !/^\d+$/.test(token) && 
         !invalidExtensions.has(token);
}

/**
 * Extract special tokens that indicate importance
 * @param {string} url - URL string
 * @param {string} title - Title string
 * @returns {Object} Special token indicators
 */
export function extractSpecialTokens(url, title) {
  const combined = (url + ' ' + title).toLowerCase();
  
  return {
    hasLogin: /login|signin|auth/.test(combined),
    hasCheckout: /checkout|payment|order|cart/.test(combined),
    hasDocs: /docs?|documentation|guide|tutorial|manual/.test(combined),
    hasAPI: /api|endpoint|webhook/.test(combined),
    hasAdmin: /admin|dashboard|panel|console/.test(combined),
    hasSearch: /search|query|results/.test(combined),
    hasSettings: /settings|preferences|config/.test(combined),
    hasProfile: /profile|account|user/.test(combined),
    hasDownload: /download|export|save/.test(combined),
    hasUpload: /upload|import|attach/.test(combined)
  };
}

/**
 * Get token statistics
 * @param {Array<string>} tokens - Array of tokens
 * @returns {Object} Token statistics
 */
export function getTokenStats(tokens) {
  const stats = {
    count: tokens.length,
    uniqueCount: new Set(tokens).size,
    avgLength: tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length || 0,
    maxLength: Math.max(...tokens.map(t => t.length), 0),
    diversity: new Set(tokens).size / tokens.length || 0
  };
  
  return stats;
}

export default {
  tokenizeURL,
  tokenizeTitle,
  extractNGrams,
  combineTokens,
  cleanToken,
  isValidToken,
  extractSpecialTokens,
  getTokenStats
};