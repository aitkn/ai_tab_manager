/*
 * AI Tab Manager - Vocabulary Management
 * Manages token-to-ID mappings for neural network input
 */

import { ML_CONFIG } from '../model-config.js';
import { saveVocabulary, loadVocabulary } from '../storage/ml-database.js';
import { tokenizeURL, tokenizeTitle, isValidToken } from './tokenizer.js';

/**
 * Vocabulary class for managing token mappings
 */
export class Vocabulary {
  constructor(maxSize = ML_CONFIG.model.inputFeatures.vocabSize) {
    this.maxSize = maxSize;
    this.tokenToId = { 
      '<PAD>': 0,    // Padding token
      '<UNK>': 1,    // Unknown token
      '<URL>': 2,    // URL separator
      '<TITLE>': 3   // Title separator
    };
    this.idToToken = ['<PAD>', '<UNK>', '<URL>', '<TITLE>'];
    this.tokenCounts = {};
    this.finalized = false;
  }
  
  /**
   * Add tokens from a URL and title
   */
  addDocument(url, title) {
    if (this.finalized) {
      console.warn('Vocabulary is finalized, cannot add new tokens');
      return;
    }
    
    const urlTokens = tokenizeURL(url);
    const titleTokens = tokenizeTitle(title);
    
    // Count all tokens
    [...urlTokens, ...titleTokens].forEach(token => {
      if (isValidToken(token)) {
        this.tokenCounts[token] = (this.tokenCounts[token] || 0) + 1;
      }
    });
  }
  
  /**
   * Build vocabulary from token counts
   */
  buildVocabulary() {
    if (this.finalized) {
      console.warn('Vocabulary already finalized');
      return;
    }
    
    // Sort tokens by frequency
    const sortedTokens = Object.entries(this.tokenCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.maxSize - this.idToToken.length);
    
    // Add tokens to vocabulary
    sortedTokens.forEach(([token, count]) => {
      if (!this.tokenToId[token]) {
        const id = this.idToToken.length;
        this.tokenToId[token] = id;
        this.idToToken.push(token);
      }
    });
    
    this.finalized = true;
    console.log(`Vocabulary built with ${this.idToToken.length} tokens`);
  }
  
  /**
   * Encode a URL and title to token IDs
   */
  encode(url, title, maxUrlLength = null, maxTitleLength = null) {
    maxUrlLength = maxUrlLength || ML_CONFIG.model.inputFeatures.maxUrlLength;
    maxTitleLength = maxTitleLength || ML_CONFIG.model.inputFeatures.maxTitleLength;
    
    const urlTokens = tokenizeURL(url);
    const titleTokens = tokenizeTitle(title);
    
    // Convert tokens to IDs
    const urlIds = urlTokens
      .slice(0, maxUrlLength)
      .map(token => this.tokenToId[token] || 1); // 1 is <UNK>
    
    const titleIds = titleTokens
      .slice(0, maxTitleLength)
      .map(token => this.tokenToId[token] || 1);
    
    // Pad sequences
    while (urlIds.length < maxUrlLength) {
      urlIds.push(0); // 0 is <PAD>
    }
    
    while (titleIds.length < maxTitleLength) {
      titleIds.push(0);
    }
    
    return {
      url: urlIds,
      title: titleIds,
      combined: [...urlIds, ...titleIds]
    };
  }
  
  /**
   * Decode token IDs back to tokens
   */
  decode(ids) {
    return ids
      .filter(id => id !== 0) // Remove padding
      .map(id => this.idToToken[id] || '<UNK>');
  }
  
  /**
   * Get vocabulary size
   */
  size() {
    return this.idToToken.length;
  }
  
  /**
   * Save vocabulary to storage
   */
  async save() {
    await saveVocabulary({
      tokenToId: this.tokenToId,
      idToToken: this.idToToken,
      tokenCounts: this.tokenCounts,
      finalized: this.finalized,
      maxSize: this.maxSize
    });
  }
  
  /**
   * Load vocabulary from storage
   */
  static async load() {
    const data = await loadVocabulary();
    if (!data) return null;
    
    const vocab = new Vocabulary(data.metadata?.maxSize);
    vocab.tokenToId = data.tokenToId;
    vocab.idToToken = data.idToToken;
    vocab.tokenCounts = data.tokenCounts;
    vocab.finalized = true;
    
    return vocab;
  }
  
  /**
   * Get vocabulary statistics
   */
  getStats() {
    const tokenFreqs = Object.values(this.tokenCounts);
    const totalTokens = tokenFreqs.reduce((sum, count) => sum + count, 0);
    
    return {
      vocabSize: this.size(),
      uniqueTokens: Object.keys(this.tokenCounts).length,
      totalTokens: totalTokens,
      avgFrequency: totalTokens / this.size() || 0,
      maxFrequency: Math.max(...tokenFreqs, 0),
      minFrequency: Math.min(...tokenFreqs, 0),
      coverage: this.calculateCoverage()
    };
  }
  
  /**
   * Calculate vocabulary coverage
   */
  calculateCoverage() {
    if (!this.finalized) return 0;
    
    const vocabTokens = new Set(Object.keys(this.tokenToId));
    const allTokens = Object.keys(this.tokenCounts);
    const coveredTokens = allTokens.filter(t => vocabTokens.has(t));
    
    return coveredTokens.length / allTokens.length || 0;
  }
  
  /**
   * Get most common tokens
   */
  getMostCommon(n = 20) {
    return Object.entries(this.tokenCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([token, count]) => ({ token, count, id: this.tokenToId[token] }));
  }
  
  /**
   * Export vocabulary for analysis
   */
  export() {
    return {
      tokenToId: this.tokenToId,
      idToToken: this.idToToken,
      stats: this.getStats(),
      mostCommon: this.getMostCommon(50)
    };
  }
}

/**
 * Create or load vocabulary
 */
export async function getOrCreateVocabulary() {
  // Try to load existing vocabulary
  let vocab = await Vocabulary.load();
  
  if (!vocab) {
    console.log('Creating new vocabulary');
    vocab = new Vocabulary();
  }
  
  return vocab;
}

/**
 * Update vocabulary with new documents
 */
export async function updateVocabulary(documents) {
  const vocab = await getOrCreateVocabulary();
  
  if (!vocab.finalized) {
    documents.forEach(doc => {
      vocab.addDocument(doc.url, doc.title);
    });
    
    // Check if we have enough data to build vocabulary
    if (Object.keys(vocab.tokenCounts).length >= 100) {
      vocab.buildVocabulary();
      await vocab.save();
    }
  }
  
  return vocab;
}

export default {
  Vocabulary,
  getOrCreateVocabulary,
  updateVocabulary
};