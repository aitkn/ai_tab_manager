// Temporary validation to ensure extracted functions work correctly
// This can be deleted after verification

console.log('=== Validating Helper Functions ===');

// Test getRootDomain
const domainTests = [
  { input: 'sub.example.com', expected: 'example.com' },
  { input: 'www.example.com', expected: 'example.com' },
  { input: 'sub.example.co.uk', expected: 'example.co.uk' },
  { input: 'chrome://newtab', expected: 'chrome' },
  { input: 'file:///path/to/file', expected: 'local-file' }
];

console.log('Testing getRootDomain:');
domainTests.forEach(test => {
  const result = window.getRootDomain?.(test.input) || 'Not Available';
  console.log(`  ${test.input} → ${result} (expected: ${test.expected})`);
});

// Test date functions
console.log('\nTesting date functions:');
const testDate = new Date('2025-01-15'); // Wednesday
console.log(`  Week number of ${testDate.toDateString()}: ${window.getWeekNumber?.(testDate) || 'Not Available'}`);
console.log(`  Week start: ${window.getWeekStartDate?.(testDate)?.toDateString() || 'Not Available'}`);

// Test extractDateFromGroupName
const dateGroupTests = ['Today', 'Yesterday', '5 days ago', 'Week of Jan 15'];
console.log('\nTesting extractDateFromGroupName:');
dateGroupTests.forEach(test => {
  const result = window.extractDateFromGroupName?.(test) || 'Not Available';
  console.log(`  "${test}" → ${result instanceof Date ? result.toDateString() : result}`);
});

console.log('\n=== Validation Complete ===');