// Paste this into the browser console to check current state
console.log('🔍 Current State Diagnostic');
console.log('==========================');

// Check if Important section is visible
const importantHeader = document.querySelector('[data-category="3"] .rule-category-header');
const importantWrapper = importantHeader?.nextElementSibling;
const isCollapsed = importantHeader?.dataset.collapsed === 'true';
const wrapperStyle = importantWrapper?.style.display;

console.log('Important Section:');
console.log('  Header found:', !!importantHeader);
console.log('  Wrapper found:', !!importantWrapper);
console.log('  Data collapsed:', isCollapsed);
console.log('  Wrapper display style:', wrapperStyle);
console.log('  Wrapper computed display:', window.getComputedStyle(importantWrapper)?.display);

// Check add button styling
const addButtons = document.querySelectorAll('.add-rule-btn');
console.log('\nAdd Buttons:');
addButtons.forEach((btn, i) => {
  const style = window.getComputedStyle(btn);
  console.log(`  Button ${i+1}:`);
  console.log(`    Width: ${style.width}`);
  console.log(`    Height: ${style.height}`);
  console.log(`    Border radius: ${style.borderRadius}`);
  console.log(`    Is round: ${style.width === style.height && style.borderRadius.includes('16px')}`);
});

// Check rules table content
const rulesLists = document.querySelectorAll('.rules-list');
console.log('\nRules Content:');
rulesLists.forEach((list, i) => {
  const category = list.dataset.category;
  const count = list.children.length;
  console.log(`  Category ${category}: ${count} rules visible`);
});

// Test click simulation on Important header
console.log('\n🧪 Testing Important header click...');
if (importantHeader) {
  const beforeState = importantHeader.dataset.collapsed;
  importantHeader.click();
  const afterState = importantHeader.dataset.collapsed;
  console.log(`  Before click: collapsed=${beforeState}`);
  console.log(`  After click: collapsed=${afterState}`);
  console.log(`  State changed: ${beforeState !== afterState ? '✅' : '❌'}`);
}