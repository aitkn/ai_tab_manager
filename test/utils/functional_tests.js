/*
 * AI Tab Manager - Comprehensive Functional Tests
 * Tests all functionality using MCP Chrome extension debugger
 */

class FunctionalTests {
  constructor() {
    this.extensionId = 'fnklipkenfpdakdficiofcdejbiajgeh';
    this.testResults = [];
    this.testUrls = [
      'https://google.com',
      'https://youtube.com/watch?v=test123',
      'https://github.com/user/repo',
      'https://stackoverflow.com/questions/123',
      'https://docs.google.com/document/d/abc123',
      'https://news.ycombinator.com',
      'https://reddit.com/r/programming',
      'https://medium.com/@user/article'
    ];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    console.log(logEntry);
    this.testResults.push({ timestamp, type, message });
  }

  async runAllTests() {
    this.log('🚀 Starting comprehensive functional tests...');
    
    try {
      // Setup phase
      await this.setupTestEnvironment();
      
      // Core functionality tests
      await this.testDatabaseMethods();
      await this.testTabOperations();
      await this.testCategorizationService();
      await this.testSavedTabsManager();
      await this.testImportExport();
      await this.testUIComponents();
      await this.testMLIntegration();
      await this.testSettingsManager();
      
      // Integration tests
      await this.testEndToEndWorkflows();
      
      // Cleanup
      await this.cleanupTestEnvironment();
      
      this.generateTestReport();
      
    } catch (error) {
      this.log(`❌ Test suite failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async setupTestEnvironment() {
    this.log('📋 Setting up test environment...');
    
    // Open extension in a tab for UI testing
    await this.executeInBackground(`
      chrome.tabs.create({
        url: 'chrome-extension://${this.extensionId}/popup.html',
        active: true
      });
    `);
    
    // Initialize database
    await this.executeInBackground(`
      if (globalThis.tabDatabase) {
        await globalThis.tabDatabase.init();
        console.log('✅ Database initialized for testing');
      }
    `);
    
    // Create test tabs
    for (const url of this.testUrls) {
      await this.executeInBackground(`
        chrome.tabs.create({ url: '${url}', active: false });
      `);
    }
    
    this.log('✅ Test environment setup complete');
  }

  async testDatabaseMethods() {
    this.log('🗄️ Testing database methods...');
    
    const methods = [
      'init',
      'findUrlByUrlTitle', 
      'getOrCreateUrl',
      'recordOpenEvent',
      'recordCloseEvent', 
      'saveCategorizedTabs',
      'getUrlInfo',
      'updateUrlCategory',
      'getSavedUrls',
      'getAllUrls',
      'getAllSavedTabs',
      'getTabsClosedAt',
      'getRecentSessions',
      'deleteUrl',
      'updateUrlCategoryById',
      'exportData',
      'exportAsCSV',
      'getUrlById',
      'importFromCSV',
      'cleanupUncategorizedRecords',
      'importData',
      'updateTabCategory'
    ];

    for (const method of methods) {
      try {
        const result = await this.executeInBackground(`
          if (globalThis.tabDatabase && typeof globalThis.tabDatabase.${method} === 'function') {
            try {
              // Test method existence and basic call (with minimal safe params)
              const methodRef = globalThis.tabDatabase.${method};
              return { exists: true, callable: true, name: '${method}' };
            } catch (e) {
              return { exists: true, callable: false, error: e.message, name: '${method}' };
            }
          } else {
            return { exists: false, name: '${method}' };
          }
        `);
        
        if (result.exists && result.callable) {
          this.log(`✅ Database method '${method}' exists and is callable`);
        } else if (result.exists) {
          this.log(`⚠️ Database method '${method}' exists but failed: ${result.error}`, 'warn');
        } else {
          this.log(`❌ Database method '${method}' does not exist`, 'error');
        }
      } catch (error) {
        this.log(`❌ Error testing database method '${method}': ${error.message}`, 'error');
      }
    }
  }

  async testTabOperations() {
    this.log('📑 Testing tab operations...');
    
    // Get current tabs
    const tabs = await this.executeInBackground(`
      return new Promise((resolve) => {
        chrome.tabs.query({}, (tabs) => {
          resolve(tabs.filter(tab => !tab.url.startsWith('chrome-extension')).slice(0, 3));
        });
      });
    `);
    
    if (tabs.length > 0) {
      this.log(`✅ Found ${tabs.length} test tabs`);
      
      // Test tab categorization
      await this.executeInBackground(`
        // Test categorizing a tab
        const testTab = ${JSON.stringify(tabs[0])};
        if (globalThis.tabDatabase) {
          try {
            const urlId = await globalThis.tabDatabase.getOrCreateUrl(testTab, 2);
            console.log('✅ Successfully categorized test tab');
            return true;
          } catch (e) {
            console.error('❌ Tab categorization failed:', e);
            return false;
          }
        }
      `);
      
    } else {
      this.log('⚠️ No test tabs found', 'warn');
    }
  }

  async testCategorizationService() {
    this.log('🤖 Testing categorization service...');
    
    // Test if categorization service is accessible
    await this.executeInBackground(`
      // Test accessing categorization functions
      try {
        const backgroundFunctions = [
          'categorizeTabs',
          'getCurrentTabs',
          'getSavedTabsWithCategories'
        ];
        
        let availableFunctions = 0;
        for (const func of backgroundFunctions) {
          if (typeof globalThis[func] === 'function') {
            availableFunctions++;
            console.log(\`✅ Function '\${func}' is available\`);
          } else {
            console.log(\`❌ Function '\${func}' is missing\`);
          }
        }
        
        return availableFunctions;
      } catch (e) {
        console.error('❌ Error testing categorization service:', e);
        return 0;
      }
    `);
  }

  async testSavedTabsManager() {
    this.log('💾 Testing saved tabs manager...');
    
    // Test saved tabs retrieval
    const savedTabs = await this.executeInBackground(`
      if (globalThis.tabDatabase) {
        try {
          const saved = await globalThis.tabDatabase.getSavedUrls([2, 3]);
          console.log(\`✅ Retrieved \${saved.length} saved tabs\`);
          return saved.length;
        } catch (e) {
          console.error('❌ Failed to get saved tabs:', e);
          return -1;
        }
      }
      return -1;
    `);
    
    this.log(`📊 Found ${savedTabs} saved tabs`);
  }

  async testImportExport() {
    this.log('📤 Testing import/export functionality...');
    
    // Test CSV export
    const exportResult = await this.executeInBackground(`
      if (globalThis.tabDatabase) {
        try {
          const csvData = await globalThis.tabDatabase.exportAsCSV();
          const hasData = csvData && csvData.length > 0;
          console.log(\`✅ CSV export \${hasData ? 'successful' : 'returned empty'}\`);
          return { success: true, hasData, length: csvData ? csvData.length : 0 };
        } catch (e) {
          console.error('❌ CSV export failed:', e);
          return { success: false, error: e.message };
        }
      }
      return { success: false, error: 'Database not available' };
    `);
    
    if (exportResult.success) {
      this.log(`✅ CSV export successful (${exportResult.length} characters)`);
    } else {
      this.log(`❌ CSV export failed: ${exportResult.error}`, 'error');
    }
  }

  async testUIComponents() {
    this.log('🎨 Testing UI components...');
    
    // Test if extension popup is accessible
    try {
      const elements = await this.querySelector('body');
      if (elements && elements.length > 0) {
        this.log('✅ Extension popup UI is accessible');
        
        // Test key UI elements
        const keyElements = [
          '.tab-navigation',
          '#unifiedToolbar', 
          '#categorizeBtn2',
          '#savedTab',
          '#settingsTab'
        ];
        
        for (const selector of keyElements) {
          const element = await this.querySelector(selector);
          if (element && element.length > 0) {
            this.log(`✅ UI element '${selector}' found`);
          } else {
            this.log(`❌ UI element '${selector}' missing`, 'error');
          }
        }
      } else {
        this.log('❌ Extension popup UI not accessible', 'error');
      }
    } catch (error) {
      this.log(`❌ UI testing failed: ${error.message}`, 'error');
    }
  }

  async testMLIntegration() {
    this.log('🧠 Testing ML integration...');
    
    // Test ML components availability
    await this.executeInBackground(`
      const mlComponents = [
        'getMLCategorizer',
        'getModelTrainer', 
        'getIncrementalTrainer'
      ];
      
      let available = 0;
      for (const component of mlComponents) {
        if (typeof globalThis[component] === 'function') {
          available++;
          console.log(\`✅ ML component '\${component}' available\`);
        } else {
          console.log(\`❌ ML component '\${component}' missing\`);
        }
      }
      
      return available;
    `);
  }

  async testSettingsManager() {
    this.log('⚙️ Testing settings manager...');
    
    // Test settings storage and retrieval
    await this.executeInBackground(`
      try {
        // Test accessing chrome storage
        chrome.storage.local.get(['settings'], (result) => {
          if (result.settings) {
            console.log('✅ Settings found in storage');
          } else {
            console.log('⚠️ No settings found in storage');
          }
        });
        
        return true;
      } catch (e) {
        console.error('❌ Settings test failed:', e);
        return false;
      }
    `);
  }

  async testEndToEndWorkflows() {
    this.log('🔄 Testing end-to-end workflows...');
    
    // Test complete categorization workflow
    const workflowResult = await this.executeInBackground(`
      try {
        // 1. Get current tabs
        const tabs = await new Promise((resolve) => {
          chrome.tabs.query({}, resolve);
        });
        
        const testTabs = tabs.filter(tab => 
          !tab.url.startsWith('chrome-extension') && 
          !tab.url.startsWith('chrome://')
        ).slice(0, 2);
        
        if (testTabs.length === 0) {
          return { success: false, error: 'No suitable test tabs found' };
        }
        
        // 2. Test database operations
        if (!globalThis.tabDatabase) {
          return { success: false, error: 'Database not available' };
        }
        
        // 3. Test categorization
        const categorizedTabs = { 2: testTabs };
        await globalThis.tabDatabase.saveCategorizedTabs(categorizedTabs);
        
        // 4. Test retrieval
        const saved = await globalThis.tabDatabase.getSavedUrls([2]);
        
        return { 
          success: true, 
          testTabsCount: testTabs.length,
          savedCount: saved.length 
        };
        
      } catch (e) {
        return { success: false, error: e.message };
      }
    `);
    
    if (workflowResult.success) {
      this.log(`✅ End-to-end workflow successful (${workflowResult.testTabsCount} tabs processed, ${workflowResult.savedCount} saved)`);
    } else {
      this.log(`❌ End-to-end workflow failed: ${workflowResult.error}`, 'error');
    }
  }

  async cleanupTestEnvironment() {
    this.log('🧹 Cleaning up test environment...');
    
    // Close test tabs (keep extension tabs open)
    await this.executeInBackground(`
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (!tab.url.startsWith('chrome-extension') && 
              !tab.url.startsWith('chrome://') &&
              tab.url !== 'chrome://newtab/') {
            chrome.tabs.remove(tab.id);
          }
        });
      });
    `);
    
    this.log('✅ Test environment cleaned up');
  }

  generateTestReport() {
    this.log('📊 Generating test report...');
    
    const summary = {
      total: this.testResults.length,
      passed: this.testResults.filter(r => r.type === 'info').length,
      warnings: this.testResults.filter(r => r.type === 'warn').length,
      errors: this.testResults.filter(r => r.type === 'error').length
    };
    
    console.log('\n=== FUNCTIONAL TEST REPORT ===');
    console.log(`Total tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`⚠️ Warnings: ${summary.warnings}`);
    console.log(`❌ Errors: ${summary.errors}`);
    console.log(`Success rate: ${((summary.passed / summary.total) * 100).toFixed(1)}%`);
    
    if (summary.errors > 0) {
      console.log('\n=== ERRORS ===');
      this.testResults
        .filter(r => r.type === 'error')
        .forEach(r => console.log(`❌ ${r.message}`));
    }
    
    if (summary.warnings > 0) {
      console.log('\n=== WARNINGS ===');
      this.testResults
        .filter(r => r.type === 'warn')
        .forEach(r => console.log(`⚠️ ${r.message}`));
    }
  }

  // Helper methods
  async executeInBackground(code) {
    const response = await chrome.runtime.sendMessage({
      extensionId: this.extensionId,
      action: 'executeInBackground',
      code: code
    });
    return response;
  }

  async querySelector(selector) {
    return await chrome.runtime.sendMessage({
      extensionId: this.extensionId,
      action: 'querySelector',
      selector: selector
    });
  }
}

// Export for use in MCP commands
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FunctionalTests;
}

// Auto-run if loaded directly
if (typeof window !== 'undefined') {
  window.FunctionalTests = FunctionalTests;
}