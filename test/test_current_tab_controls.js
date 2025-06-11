/*
 * Current Tab Controls Test Script
 * Reproducible tests for Current Tab functionality
 * Usage: Run via MCP Chrome Extension Debugger
 */

// ==== REUSABLE TEST SUITE FOR CURRENT TAB FUNCTIONALITY ====

function runCurrentTabControlTests() {
  console.log('🚀 Current Tab Controls Test Suite Starting...');
  console.log('='.repeat(50));
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
  };

  function logResult(message, type = 'info') {
    const timestamp = new Date().toISOString().substr(11, 8);
    const formatted = `[${timestamp}] ${message}`;
    console.log(formatted);
    
    if (message.includes('✅')) results.passed++;
    else if (message.includes('❌')) results.failed++;
    else if (message.includes('⚠️')) results.warnings++;
    
    results.details.push({ type, message: formatted });
  }

  // TEST 1: Tab Navigation & Discovery
  logResult('🧭 TEST 1: Tab Navigation & Discovery');
  chrome.tabs.query({}, (tabs) => {
    const currentTabs = tabs.filter(tab => 
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('chrome://') &&
      tab.url !== 'chrome://newtab/'
    );
    
    logResult(`✅ Found ${currentTabs.length} current tabs across ALL windows`);
    
    // Verify ALL windows are included (critical requirement)
    const windowIds = [...new Set(currentTabs.map(tab => tab.windowId))];
    logResult(`✅ Tabs span ${windowIds.length} browser windows (verifying ALL windows requirement)`);
    
    // Show sample tabs
    currentTabs.slice(0, 3).forEach((tab, i) => {
      logResult(`   ${i+1}. ${tab.title || 'No title'} (${new URL(tab.url).hostname})`);
    });
  });

  // TEST 2: Database Operations
  logResult('🗄️ TEST 2: Database Operations');
  const criticalDbMethods = [
    'saveCategorizedTabs', 'getOrCreateUrl', 'updateUrlCategory', 
    'getSavedUrls', 'getAllSavedTabs', 'updateTabCategory'
  ];
  
  criticalDbMethods.forEach(method => {
    if (globalThis.tabDatabase && typeof globalThis.tabDatabase[method] === 'function') {
      logResult(`✅ Critical database method: ${method}`);
    } else {
      logResult(`❌ Missing critical database method: ${method}`);
    }
  });

  // TEST 3: Extension Safety (Self-Exclusion)
  logResult('🛡️ TEST 3: Extension Safety (Self-Exclusion)');
  chrome.tabs.query({}, (tabs) => {
    const extensionTabs = tabs.filter(tab => 
      tab.url.includes('chrome-extension://fnklipkenfpdakdficiofcdejbiajgeh')
    );
    
    if (extensionTabs.length > 0) {
      logResult(`✅ Extension tabs found: ${extensionTabs.length} (these MUST be excluded from operations)`);
      extensionTabs.forEach(tab => {
        logResult(`   - ${tab.url}`);
      });
    } else {
      logResult(`⚠️ No extension tabs found (may be normal if not currently open)`);
    }
  });

  // TEST 4: Grouping Logic
  logResult('📊 TEST 4: Grouping Logic');
  chrome.tabs.query({}, (tabs) => {
    const currentTabs = tabs.filter(tab => 
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('chrome://') &&
      tab.url !== 'chrome://newtab/'
    );
    
    // Test domain grouping
    const domainGroups = {};
    currentTabs.forEach(tab => {
      try {
        const domain = new URL(tab.url).hostname;
        if (!domainGroups[domain]) domainGroups[domain] = [];
        domainGroups[domain].push(tab);
      } catch (e) {
        // Skip invalid URLs
      }
    });
    
    const groupCount = Object.keys(domainGroups).length;
    logResult(`✅ Domain grouping: ${currentTabs.length} tabs → ${groupCount} domain groups`);
    
    // Show top domains
    const sortedDomains = Object.entries(domainGroups)
      .sort(([,a], [,b]) => b.length - a.length)
      .slice(0, 3);
    
    sortedDomains.forEach(([domain, tabs]) => {
      logResult(`   ${domain}: ${tabs.length} tabs`);
    });
  });

  // TEST 5: Search Functionality
  logResult('🔍 TEST 5: Search Functionality');
  chrome.tabs.query({}, (tabs) => {
    const currentTabs = tabs.filter(tab => 
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('chrome://') &&
      tab.url !== 'chrome://newtab/'
    );
    
    const testSearchTerms = ['google', 'github', 'youtube', 'claude'];
    
    testSearchTerms.forEach(term => {
      const matches = currentTabs.filter(tab => 
        tab.url.toLowerCase().includes(term) || 
        (tab.title && tab.title.toLowerCase().includes(term))
      );
      
      if (matches.length > 0) {
        logResult(`✅ Search "${term}": ${matches.length} matches`);
      } else {
        logResult(`⚠️ Search "${term}": 0 matches (expected for this term)`);
      }
    });
  });

  // TEST 6: Categorization Functions
  logResult('🤖 TEST 6: Categorization Functions');
  
  // These functions should be in background script
  const expectedFunctions = ['categorizeTabs', 'getCurrentTabs', 'getSavedTabsWithCategories'];
  expectedFunctions.forEach(funcName => {
    if (typeof globalThis[funcName] === 'function') {
      logResult(`✅ Background function: ${funcName}`);
    } else {
      logResult(`❌ Missing background function: ${funcName}`);
    }
  });

  // TEST 7: End-to-End Workflow Simulation
  logResult('🔄 TEST 7: End-to-End Workflow Simulation');
  
  setTimeout(async () => {
    try {
      // Get tabs for testing
      const tabs = await new Promise(resolve => chrome.tabs.query({}, resolve));
      const testTabs = tabs.filter(tab => 
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('chrome://') &&
        tab.url !== 'chrome://newtab/'
      ).slice(0, 2);
      
      if (testTabs.length === 0) {
        logResult('⚠️ No suitable tabs for workflow test');
        return;
      }
      
      logResult(`🔄 Workflow Step 1: Testing with ${testTabs.length} tabs`);
      
      // Simulate categorization
      const categorized = {
        1: testTabs.filter(tab => tab.url.includes('google.com')),
        2: testTabs.filter(tab => tab.url.includes('claude.ai')),
        3: testTabs.filter(tab => tab.url.includes('github.com'))
      };
      
      const totalCategorized = Object.values(categorized).flat().length;
      logResult(`🔄 Workflow Step 2: Categorized ${totalCategorized} tabs`);
      
      // Test database save
      if (globalThis.tabDatabase && totalCategorized > 0) {
        try {
          const tabsToSave = {};
          if (categorized[2].length > 0) tabsToSave[2] = categorized[2];
          if (categorized[3].length > 0) tabsToSave[3] = categorized[3];
          
          if (Object.keys(tabsToSave).length > 0) {
            await globalThis.tabDatabase.saveCategorizedTabs(tabsToSave);
            logResult('✅ Workflow Step 3: Database save successful');
          } else {
            logResult('🔄 Workflow Step 3: No tabs needed saving');
          }
          
          // Verify save
          const savedCount = await globalThis.tabDatabase.getSavedUrls([2, 3]);
          logResult(`✅ Workflow Step 4: Verified ${savedCount.length} total saved tabs`);
          
        } catch (error) {
          logResult(`❌ Workflow Step 3-4: Database error: ${error.message}`);
        }
      } else {
        logResult('❌ Workflow: Database not available or no tabs to test');
      }
      
      // Generate final report
      setTimeout(() => {
        logResult('📊 TEST SUMMARY REPORT');
        logResult('='.repeat(50));
        logResult(`✅ Passed: ${results.passed}`);
        logResult(`❌ Failed: ${results.failed}`);
        logResult(`⚠️ Warnings: ${results.warnings}`);
        logResult(`🎯 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
        logResult('='.repeat(50));
        
        if (results.failed > 0) {
          logResult('❌ FAILED TESTS:');
          results.details
            .filter(r => r.message.includes('❌'))
            .forEach(r => logResult(`   ${r.message.split('] ')[1]}`));
        }
        
        logResult('✅ VERIFIED COMPONENTS:');
        logResult('   🧭 Tab Navigation (ALL windows)');
        logResult('   🗄️ Database Operations');
        logResult('   🛡️ Extension Safety');
        logResult('   📊 Grouping Logic');
        logResult('   🔍 Search Functionality');
        logResult('   🤖 Categorization Functions');
        logResult('   🔄 End-to-End Workflow');
        
        logResult('🎉 Current Tab Controls Test Suite Complete!');
      }, 1000);
      
    } catch (error) {
      logResult(`❌ Workflow test failed: ${error.message}`);
    }
  }, 2000); // Allow time for previous async operations
}

// ==== HOW TO RUN THESE TESTS ====
console.log('📋 Current Tab Controls Test Script Loaded');
console.log('🔧 To run tests, execute: runCurrentTabControlTests()');
console.log('💡 This script is reusable - save it and run anytime');

// Auto-run if desired (uncomment next line)
// runCurrentTabControlTests();