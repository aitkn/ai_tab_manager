#!/usr/bin/env node
/**
 * JavaScript test runner using Puppeteer for Chrome extension testing
 * Connects to existing Chrome instance to avoid WebDriver hanging issues
 */

const puppeteer = require('puppeteer-core');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

class ExtensionTestRunner {
    constructor(options = {}) {
        this.chromeDebugAddress = options.chromeDebugAddress || '172.25.48.1:9223';
        this.extensionId = options.extensionId || 'fnklipkenfpdakdficiofcdejbiajgeh';
        this.browser = null;
        this.page = null;
        this.backgroundPage = null;
        this.testResults = [];
        this.initialTabIds = new Set(); // Track tabs that existed before tests
        this.demoMode = options.demoMode || false; // Demo mode for visual feedback
        this.logFile = options.logFile || 'test-results.md'; // Log file path (markdown)
        this.logEntries = []; // Store log entries
        this.testStartTime = null; // Track overall test suite start time
        this.currentTest = null; // Track current test for sub-assertions
        this.assertions = []; // Track individual assertions
    }

    /**
     * Connect to existing Chrome instance
     */
    async connect() {
        console.log(chalk.blue('🔌 Connecting to Chrome at'), this.chromeDebugAddress);
        
        try {
            // First check if Chrome debug interface is accessible
            const http = require('http');
            const testConnection = await new Promise((resolve) => {
                const req = http.get(`http://${this.chromeDebugAddress}/json`, (res) => {
                    resolve(res.statusCode === 200);
                });
                req.on('error', () => resolve(false));
                req.setTimeout(5000, () => {
                    req.abort();
                    resolve(false);
                });
            });
            
            if (!testConnection) {
                throw new Error(`Chrome debug interface not accessible at ${this.chromeDebugAddress}`);
            }
            
            console.log(chalk.green('✅ Chrome debug interface accessible'));
            
            // Connect to existing Chrome instance with retry
            let lastError;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(chalk.blue(`   Attempt ${attempt}/3...`));
                    
                    this.browser = await puppeteer.connect({
                        browserURL: `http://${this.chromeDebugAddress}`,
                        defaultViewport: null,
                        ignoreHTTPSErrors: true
                    });
                    
                    console.log(chalk.green('✅ Connected to Chrome successfully'));
                    break;
                } catch (error) {
                    lastError = error;
                    console.log(chalk.yellow(`   Attempt ${attempt} failed: ${error.message}`));
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            
            if (!this.browser) {
                throw lastError;
            }
            
            // Get all pages/targets
            const targets = await this.browser.targets();
            console.log(chalk.blue(`📊 Found ${targets.length} total targets`));
            
            // List all targets for debugging
            targets.forEach((target, index) => {
                console.log(chalk.gray(`   Target ${index + 1}: ${target.type()} - ${target.url().substring(0, 80)}...`));
            });
            
            // Find extension background page
            const backgroundTarget = targets.find(target => 
                target.type() === 'background_page' && 
                target.url().includes(this.extensionId)
            );
            
            if (backgroundTarget) {
                this.backgroundPage = await backgroundTarget.page();
                console.log(chalk.green('✅ Connected to extension background page'));
            } else {
                console.log(chalk.yellow('⚠️  Extension background page not found'));
            }
            
            // Create or find extension popup page
            await this.setupExtensionPage();
            
            // Capture initial tab state to preserve browser state
            await this.captureInitialTabState();
            
            return true;
        } catch (error) {
            console.error(chalk.red('❌ Failed to connect to Chrome:'), error.message);
            if (error.stack) {
                console.error(chalk.red('   Stack:'), error.stack.split('\n')[1]);
            }
            return false;
        }
    }

    /**
     * Setup extension page for testing
     */
    async setupExtensionPage() {
        const extensionUrl = `chrome-extension://${this.extensionId}/popup.html`;
        
        try {
            // Always create a fresh extension page for proper initialization
            console.log(chalk.blue('🆕 Creating fresh extension page'));
            this.page = await this.browser.newPage();
            
            console.log(chalk.blue(`   Navigating to: ${extensionUrl}`));
            await this.page.goto(extensionUrl, { waitUntil: 'networkidle2', timeout: 10000 });
            
            await this.page.waitForTimeout(3000); // Wait longer for extension to fully initialize
            console.log(chalk.green('✅ Extension page created and loaded'));
            
            // Verify extension page is accessible
            const title = await this.page.title();
            console.log(chalk.blue(`📄 Extension page title: "${title}"`));
            
            // Bring extension page to front
            await this.page.bringToFront();
            
        } catch (error) {
            console.error(chalk.red('❌ Failed to setup extension page:'), error.message);
            throw error;
        }
    }

    /**
     * Create test tabs using Chrome tabs API
     */
    async createTestTabs(urls) {
        console.log(chalk.blue(`🔧 Creating ${urls.length} test tabs...`));
        
        const createdTabs = [];
        
        for (const url of urls) {
            try {
                // Use Chrome tabs API through extension context
                const tab = await this.page.evaluate(async (testUrl) => {
                    return new Promise((resolve) => {
                        chrome.tabs.create({ url: testUrl, active: false }, (tab) => {
                            if (chrome.runtime.lastError) {
                                resolve({ success: false, error: chrome.runtime.lastError.message });
                            } else {
                                resolve({ success: true, tab: tab });
                            }
                        });
                    });
                }, url);
                
                if (tab.success) {
                    createdTabs.push(tab.tab);
                    console.log(chalk.green(`   ✅ Created tab: ${url}`));
                } else {
                    console.log(chalk.red(`   ❌ Failed to create tab: ${url} - ${tab.error}`));
                }
                
                // Brief delay between tab creations
                await this.page.waitForTimeout(300);
            } catch (error) {
                console.log(chalk.red(`   ❌ Error creating tab ${url}:`, error.message));
            }
        }
        
        return createdTabs;
    }

    /**
     * Show demo balloon notification in extension popup
     */
    async showDemoBalloon(message, type = 'INFO', duration = 3000) {
        if (!this.demoMode) return;
        
        console.log(chalk.blue(`🎬 Demo: ${message}`));
        
        try {
            await this.page.evaluate((msg, balloonType, dur) => {
                // Create and show demo balloon in extension popup
                const balloon = document.createElement('div');
                balloon.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    color: white;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    z-index: 10000;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    max-width: 300px;
                    animation: slideIn 0.3s ease-out;
                `;
                
                // Set balloon color based on type
                switch (balloonType) {
                    case 'PASSED':
                        balloon.style.backgroundColor = '#10b981'; // Green
                        break;
                    case 'FAILED':
                        balloon.style.backgroundColor = '#ef4444'; // Red
                        break;
                    case 'INFO':
                    default:
                        balloon.style.backgroundColor = '#3b82f6'; // Blue
                        break;
                }
                
                balloon.textContent = msg;
                
                // Add CSS animation
                if (!document.getElementById('demo-balloon-styles')) {
                    const style = document.createElement('style');
                    style.id = 'demo-balloon-styles';
                    style.textContent = `
                        @keyframes slideIn {
                            from { transform: translateX(100%); opacity: 0; }
                            to { transform: translateX(0); opacity: 1; }
                        }
                        @keyframes slideOut {
                            from { transform: translateX(0); opacity: 1; }
                            to { transform: translateX(100%); opacity: 0; }
                        }
                    `;
                    document.head.appendChild(style);
                }
                
                document.body.appendChild(balloon);
                
                // Auto-remove after duration
                setTimeout(() => {
                    balloon.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => {
                        if (balloon.parentNode) {
                            balloon.parentNode.removeChild(balloon);
                        }
                    }, 300);
                }, dur);
                
            }, message, type, duration);
            
            // Wait for balloon to be visible
            await this.page.waitForTimeout(Math.min(duration + 500, 4000));
            
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Demo balloon failed: ${error.message}`));
        }
    }

    /**
     * Capture the initial tab state to preserve browser state
     */
    async captureInitialTabState() {
        console.log(chalk.gray('📋 Capturing initial browser state...'));
        
        const allTabs = await this.page.evaluate(() => {
            return new Promise((resolve) => {
                chrome.tabs.query({}, (tabs) => {
                    if (chrome.runtime.lastError) {
                        resolve([]);
                    } else {
                        resolve(tabs.map(tab => ({ id: tab.id, url: tab.url })));
                    }
                });
            });
        });
        
        // Store initial tab IDs to preserve them
        this.initialTabIds.clear();
        allTabs.forEach(tab => {
            this.initialTabIds.add(tab.id);
        });
        
        console.log(chalk.gray(`   Initial browser state: ${this.initialTabIds.size} tabs`));
    }

    /**
     * Close only test-created tabs to restore browser state
     */
    async closeAllTestTabs() {
        console.log(chalk.blue('🧹 Restoring initial browser state...'));
        
        const allTabs = await this.page.evaluate(() => {
            return new Promise((resolve) => {
                chrome.tabs.query({}, (tabs) => {
                    if (chrome.runtime.lastError) {
                        resolve([]);
                    } else {
                        resolve(tabs);
                    }
                });
            });
        });
        
        // Only close tabs that were created during testing (not present initially)
        const testCreatedTabIds = allTabs
            .filter(tab => !this.initialTabIds.has(tab.id)) // Only tabs not in initial state
            .filter(tab => !tab.url.includes(this.extensionId)) // Don't close extension tabs
            .map(tab => tab.id);
        
        if (testCreatedTabIds.length > 0) {
            console.log(chalk.blue(`   Closing ${testCreatedTabIds.length} test-created tabs...`));
            await this.closeTestTabs(testCreatedTabIds);
        } else {
            console.log(chalk.gray('   No test-created tabs to clean up'));
        }
        
        console.log(chalk.gray(`   Browser state restored: ${this.initialTabIds.size} initial tabs preserved`));
    }

    /**
     * Close test tabs
     */
    async closeTestTabs(tabIds) {
        console.log(chalk.blue(`🗑️  Closing ${tabIds.length} test tabs...`));
        
        for (const tabId of tabIds) {
            try {
                await this.page.evaluate(async (id) => {
                    return new Promise((resolve) => {
                        chrome.tabs.remove(id, () => {
                            resolve();
                        });
                    });
                }, tabId);
                
            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  Error closing tab ${tabId}:`, error.message));
            }
        }
        
        // Wait for tabs to be removed and UI to update
        await this.page.waitForTimeout(1000);
    }

    /**
     * Start a new test - creates test header
     */
    startTest(testName) {
        this.currentTest = {
            name: testName,
            startTime: Date.now(),
            subTests: [],
            assertions: []
        };
    }
    
    /**
     * Start a sub-test within current test
     */
    startSubTest(subTestName) {
        if (!this.currentTest) return;
        
        const subTest = {
            name: subTestName,
            startTime: Date.now(),
            assertions: []
        };
        
        this.currentTest.subTests.push(subTest);
        return subTest;
    }
    
    /**
     * Add assertion to current sub-test or test
     */
    addAssertion(expectation, reality, passed = true, subTestName = null) {
        const timestamp = new Date().toISOString();
        const duration = this.currentTest ? Date.now() - this.currentTest.startTime : 0;
        const statusIcon = passed ? 'V' : 'X';
        
        const assertion = {
            timestamp,
            duration,
            status: statusIcon,
            expectation,
            reality
        };
        
        if (subTestName && this.currentTest) {
            // Find the sub-test and add assertion to it
            const subTest = this.currentTest.subTests.find(st => st.name === subTestName);
            if (subTest) {
                subTest.assertions.push(assertion);
            }
        } else if (this.currentTest) {
            // Add to main test assertions
            this.currentTest.assertions.push(assertion);
        }
    }
    
    /**
     * Finish current test
     */
    finishTest(passed = true) {
        if (!this.currentTest) return;
        
        this.currentTest.duration = Date.now() - this.currentTest.startTime;
        this.currentTest.passed = passed;
        this.logEntries.push(this.currentTest);
        this.currentTest = null;
    }

    /**
     * Write test log to markdown file
     */
    async writeTestLog() {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const logDir = path.dirname(this.logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            let logContent = '';
            
            // Header
            logContent += `# Chrome Extension Test Results\n\n`;
            logContent += `**Generated:** ${new Date().toISOString()}\n`;
            logContent += `**Total Tests:** ${this.logEntries.length}\n\n`;
            logContent += `---\n\n`;
            
            // Individual test sections
            this.logEntries.forEach((test, testIndex) => {
                logContent += `## ${test.name}\n\n`;
                
                // Main test assertions
                if (test.assertions && test.assertions.length > 0) {
                    test.assertions.forEach(assertion => {
                        logContent += `| ${assertion.timestamp} | ${assertion.duration}ms | ${assertion.status} | ${assertion.expectation} | ${assertion.reality} |\n`;
                    });
                    logContent += `\n`;
                }
                
                // Sub-tests
                if (test.subTests && test.subTests.length > 0) {
                    test.subTests.forEach(subTest => {
                        logContent += `### ${subTest.name}\n\n`;
                        
                        if (subTest.assertions && subTest.assertions.length > 0) {
                            logContent += `| Timestamp | Duration | Status | Expectation | Reality |\n`;
                            logContent += `|-----------|----------|--------|-------------|---------|\n`;
                            
                            subTest.assertions.forEach(assertion => {
                                logContent += `| ${assertion.timestamp} | ${assertion.duration}ms | ${assertion.status} | ${assertion.expectation} | ${assertion.reality} |\n`;
                            });
                            logContent += `\n`;
                        }
                    });
                }
                
                logContent += `---\n\n`;
            });
            
            // Footer summary
            logContent += `## Summary\n\n`;
            
            const totalDuration = this.logEntries.reduce((sum, test) => sum + test.duration, 0);
            logContent += `**Total Duration:** ${totalDuration}ms\n\n`;
            
            // Test results summary
            logContent += `### Test Results\n\n`;
            logContent += `| Test Name | Duration | Status | Sub-Tests |\n`;
            logContent += `|-----------|----------|--------|-----------|\n`;
            
            let totalPassed = 0;
            let totalFailed = 0;
            
            this.logEntries.forEach(test => {
                const testStatus = test.passed ? 'V' : 'X';
                const subTestSummary = test.subTests ? 
                    test.subTests.map(st => {
                        const subPassed = st.assertions ? st.assertions.every(a => a.status === 'V') : true;
                        return subPassed ? 'V' : 'X';
                    }).join(' ') : '-';
                
                logContent += `| ${test.name} | ${test.duration}ms | ${testStatus} | ${subTestSummary} |\n`;
                
                if (test.passed) totalPassed++;
                else totalFailed++;
            });
            
            logContent += `\n`;
            logContent += `**Overall Results:** ${totalPassed} passed, ${totalFailed} failed\n`;
            
            fs.writeFileSync(this.logFile, logContent, 'utf8');
            console.log(chalk.blue(`📝 Test log written to: ${this.logFile}`));
            
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Failed to write test log: ${error.message}`));
        }
    }

    /**
     * Run a single test
     */
    async runTest(testFunction, testName) {
        console.log(chalk.blue(`\n🧪 Running test: ${testName}`));
        await this.showDemoBalloon(`🧪 Starting test: ${testName}`, 'INFO', 2000);
        
        // Start logging for this test
        this.startTest(testName);
        
        try {
            const result = await testFunction(this);
            
            this.testResults.push({
                name: testName,
                status: 'passed',
                duration: this.currentTest ? this.currentTest.duration : 0,
                error: null
            });
            
            // Finish test logging
            this.finishTest(true);
            
            console.log(chalk.green(`✅ ${testName} PASSED`), chalk.gray(`(${this.logEntries[this.logEntries.length - 1].duration}ms)`));
            await this.showDemoBalloon(`✅ ${testName} PASSED`, 'PASSED', 2000);
            return true;
        } catch (error) {
            // Add error assertion
            this.addAssertion('Test should pass without errors', `Test failed: ${error.message}`, false);
            
            this.testResults.push({
                name: testName,
                status: 'failed',
                duration: this.currentTest ? Date.now() - this.currentTest.startTime : 0,
                error: error.message
            });
            
            // Finish test logging as failed
            this.finishTest(false);
            
            console.log(chalk.red(`❌ ${testName} FAILED`), chalk.gray(`(${this.logEntries[this.logEntries.length - 1].duration}ms)`));
            console.log(chalk.red('   Error:'), error.message);
            await this.showDemoBalloon(`❌ ${testName} FAILED: ${error.message}`, 'FAILED', 3000);
            return false;
        }
    }

    /**
     * Run multiple tests
     */
    async runTests(tests) {
        this.testStartTime = Date.now();
        console.log(chalk.blue(`\n🚀 Running ${tests.length} tests...\n`));
        
        let passed = 0;
        let failed = 0;
        
        for (const { name, test } of tests) {
            const success = await this.runTest(test, name);
            if (success) {
                passed++;
            } else {
                failed++;
            }
        }
        
        // Print summary
        console.log(chalk.blue('\n📊 Test Summary'));
        console.log(chalk.blue('==============='));
        console.log(chalk.green(`✅ Passed: ${passed}`));
        console.log(failed > 0 ? chalk.red(`❌ Failed: ${failed}`) : chalk.gray(`❌ Failed: ${failed}`));
        
        const totalDuration = this.testResults.reduce((sum, result) => sum + result.duration, 0);
        console.log(chalk.gray(`⏱️  Total time: ${totalDuration}ms`));
        
        // Write detailed test log
        await this.writeTestLog();
        
        // Final cleanup: restore browser to initial state
        console.log('\n');
        await this.closeAllTestTabs();
        
        return { passed, failed, total: tests.length };
    }


    /**
     * Cleanup and disconnect
     */
    async cleanup() {
        console.log(chalk.blue('🧹 Cleaning up...'));
        
        // Close the extension tab to ensure fresh start next time
        if (this.page) {
            try {
                await this.showDemoBalloon('🗑️ Closing extension tab for fresh restart', 'INFO', 2000);
                
                // Get extension tab ID and close it immediately
                await this.page.evaluate(() => {
                    return new Promise((resolve) => {
                        chrome.tabs.getCurrent((tab) => {
                            if (chrome.runtime.lastError || !tab) {
                                resolve();
                            } else {
                                chrome.tabs.remove(tab.id, () => {
                                    // Tab will close immediately, resolve quickly
                                    resolve();
                                });
                            }
                        });
                    });
                });
                
                console.log(chalk.green('✅ Extension tab closed'));
                
            } catch (error) {
                // This error is expected when the tab closes itself
                if (error.message.includes('Target closed')) {
                    console.log(chalk.green('✅ Extension tab closed successfully'));
                } else {
                    console.log(chalk.yellow(`⚠️  Error closing extension tab: ${error.message}`));
                }
            }
        }
        
        // Disconnect from browser after closing tab
        if (this.browser) {
            await this.browser.disconnect();
            console.log(chalk.green('✅ Disconnected from Chrome'));
        }
    }
}

module.exports = ExtensionTestRunner;

// If run directly, execute example
if (require.main === module) {
    async function main() {
        const runner = new ExtensionTestRunner();
        
        if (await runner.connect()) {
            // Example test
            const tests = [
                {
                    name: 'connection_test',
                    test: async (runner) => {
                        const title = await runner.page.title();
                        if (!title.includes('AI Tab Manager')) {
                            throw new Error(`Expected extension title, got: ${title}`);
                        }
                    }
                }
            ];
            
            await runner.runTests(tests);
        }
        
        await runner.cleanup();
    }
    
    main().catch(console.error);
}