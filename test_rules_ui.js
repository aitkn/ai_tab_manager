/**
 * Test script for Rules UI functionality
 * Copy and paste this into the browser console when the extension popup is open
 * and on the Settings tab to test the three reported issues.
 */

function testRulesUI() {
  console.log('🧪 Starting Rules UI Test...');
  
  // Test 1: Check if rules are loading
  console.log('\n📋 Test 1: Rules Loading');
  console.log('='.repeat(30));
  
  // Check if we can access state
  if (typeof state !== 'undefined' && state.settings.rules) {
    console.log('✓ State accessible');
    console.log(`✓ Found ${state.settings.rules.length} rules in state`);
    
    // Sample first 3 rules
    console.log('Sample rules:', state.settings.rules.slice(0, 3));
  } else {
    console.log('❌ State not accessible or no rules found');
  }
  
  // Check if rules are displayed in UI
  const rulesLists = document.querySelectorAll('.rules-list');
  console.log(`✓ Found ${rulesLists.length} rule category containers`);
  
  let totalDisplayedRules = 0;
  rulesLists.forEach((list, index) => {
    const category = list.dataset.category;
    const rulesCount = list.children.length;
    totalDisplayedRules += rulesCount;
    console.log(`  Category ${category}: ${rulesCount} rules displayed`);
  });
  
  console.log(`✓ Total rules displayed: ${totalDisplayedRules}`);
  
  // Test 2: Check collapsible functionality
  console.log('\n🔽 Test 2: Collapsible Groups');
  console.log('='.repeat(30));
  
  const headers = document.querySelectorAll('.rule-category-header');
  console.log(`✓ Found ${headers.length} collapsible headers`);
  
  headers.forEach((header, index) => {
    const category = header.closest('.rule-category-section')?.dataset.category;
    const isCollapsed = header.dataset.collapsed === 'true';
    const wrapper = header.nextElementSibling;
    const wrapperVisible = wrapper && wrapper.style.display !== 'none';
    
    console.log(`  Header ${index + 1} (Category ${category}):`);
    console.log(`    - Collapsed state: ${isCollapsed}`);
    console.log(`    - Wrapper exists: ${!!wrapper}`);
    console.log(`    - Wrapper visible: ${wrapperVisible}`);
    console.log(`    - State consistent: ${isCollapsed !== wrapperVisible ? '✓' : '❌'}`);
  });
  
  // Test 3: Check add buttons appearance
  console.log('\n➕ Test 3: Add Button Styling');
  console.log('='.repeat(30));
  
  const addButtons = document.querySelectorAll('.add-rule-btn');
  console.log(`✓ Found ${addButtons.length} add buttons`);
  
  addButtons.forEach((btn, index) => {
    const category = btn.dataset.category;
    const computedStyle = window.getComputedStyle(btn);
    const borderRadius = computedStyle.borderRadius;
    const width = computedStyle.width;
    const height = computedStyle.height;
    
    console.log(`  Button ${index + 1} (Category ${category}):`);
    console.log(`    - Width: ${width}`);
    console.log(`    - Height: ${height}`);
    console.log(`    - Border radius: ${borderRadius}`);
    console.log(`    - Is round: ${width === height && borderRadius.includes('50%') ? '✓' : '❌'}`);
  });
  
  // Test 4: Interactive test - try clicking a header
  console.log('\n🖱️ Test 4: Interactive Test');
  console.log('='.repeat(30));
  
  if (headers.length > 0) {
    const firstHeader = headers[0];
    const category = firstHeader.closest('.rule-category-section')?.dataset.category;
    const initialState = firstHeader.dataset.collapsed === 'true';
    
    console.log(`Testing header click for category ${category}`);
    console.log(`Initial collapsed state: ${initialState}`);
    
    // Simulate click
    firstHeader.click();
    
    setTimeout(() => {
      const newState = firstHeader.dataset.collapsed === 'true';
      const wrapper = firstHeader.nextElementSibling;
      const wrapperVisible = wrapper && wrapper.style.display !== 'none';
      
      console.log(`After click:`);
      console.log(`  - New collapsed state: ${newState}`);
      console.log(`  - Wrapper visible: ${wrapperVisible}`);
      console.log(`  - State changed: ${initialState !== newState ? '✓' : '❌'}`);
      console.log(`  - UI updated correctly: ${newState !== wrapperVisible ? '✓' : '❌'}`);
      
      // Restore original state
      firstHeader.click();
      
      console.log('\n🏁 Test Complete!');
      console.log('='.repeat(30));
      console.log('If all checks show ✓, the issues are fixed!');
    }, 100);
  } else {
    console.log('❌ No headers found for interactive test');
  }
}

// Auto-run if in extension context
if (typeof chrome !== 'undefined' && chrome.extension) {
  // Wait a moment for everything to load
  setTimeout(testRulesUI, 1000);
} else {
  console.log('Paste testRulesUI() in the extension popup console to run tests');
}