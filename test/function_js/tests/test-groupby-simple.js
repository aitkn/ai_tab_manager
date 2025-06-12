#!/usr/bin/env node
/**
 * Simple test to verify markdown logging structure works
 */

const ExtensionTestRunner = require('../test-runner');
const chalk = require('chalk');

async function simpleTest(runner) {
    console.log(chalk.blue('   📋 Running simple test...'));
    
    // Add some assertions to test the logging
    runner.addAssertion(
        'Simple test should pass',
        'Test passed successfully',
        true
    );
    
    // Start a sub-test
    const subTest = runner.startSubTest('Sub-test Example');
    
    runner.addAssertion(
        'Sub-assertion 1 should work',
        'Sub-assertion 1 passed',
        true,
        'Sub-test Example'
    );
    
    runner.addAssertion(
        'Sub-assertion 2 should work',
        'Sub-assertion 2 passed',
        true,
        'Sub-test Example'
    );
    
    // Test a failure case
    runner.addAssertion(
        'This assertion should fail for testing',
        'This assertion failed as expected',
        false,
        'Sub-test Example'
    );
    
    return true;
}

async function main() {
    const runner = new ExtensionTestRunner({ logFile: 'simple-test-results.md' });
    
    if (await runner.connect()) {
        const tests = [
            { name: 'Simple Test', test: simpleTest }
        ];
        
        await runner.runTests(tests);
    }
    
    await runner.cleanup();
}

if (require.main === module) {
    main().catch(console.error);
}