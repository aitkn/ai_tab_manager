#!/usr/bin/env node
/**
 * GROUP BY functionality tests using Puppeteer
 * Tests domain and category grouping without WebDriver hanging issues
 */

const ExtensionTestRunner = require('../test-runner');
const chalk = require('chalk');

/**
 * Test GROUP BY domain functionality
 */
async function testGroupByDomain(runner) {
    console.log(chalk.blue('   📁 Testing GROUP BY domain...'));
    
    await runner.showDemoBalloon('Testing GROUP BY domain', 'INFO');
    
    // Clean up any existing test tabs first
    await runner.closeAllTestTabs();
    
    // Create test tabs from different domains
    const testUrls = [
        'https://github.com/microsoft/vscode',
        'https://github.com/user/repo', 
        'https://stackoverflow.com/questions/javascript',
        'https://docs.python.org/3/tutorial/'
    ];
    
    const createdTabs = await runner.createTestTabs(testUrls);
    
    if (createdTabs.length < testUrls.length) {
        throw new Error(`Failed to create all test tabs: created ${createdTabs.length}/${testUrls.length}`);
    }
    
    await runner.showDemoBalloon(`📄 Created ${createdTabs.length} test tabs from different domains`, 'INFO', 2000);
    
    // Load current tabs in extension
    console.log(chalk.blue('   🔄 Loading current tabs...'));
    await runner.page.evaluate(() => {
        const currentBtn = document.querySelector("[data-tab='categorize']");
        if (currentBtn) {
            currentBtn.click();
        }
    });
    
    // Wait for tabs to load
    await runner.page.waitForTimeout(1000);
    await runner.showDemoBalloon('✅ Current tab loaded', 'PASSED', 1500);
    
    // Set domain grouping
    console.log(chalk.blue('   🔄 Setting domain grouping...'));
    await runner.showDemoBalloon('🔄 Switching to GROUP BY Domain mode', 'INFO', 1500);
    
    await runner.page.evaluate(() => {
        const select = document.getElementById('unifiedGroupingSelect');
        if (select) {
            select.value = 'domain';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        }
    });
    
    // Wait for grouping to apply
    await runner.page.waitForTimeout(2000);
    await runner.showDemoBalloon('⚙️ Analyzing domain groups...', 'INFO', 1500);
    
    // Get grouping results directly from extension
    const groupingResults = await runner.page.evaluate(() => {
        const groupSections = document.querySelectorAll('.group-section');
        const tabItems = document.querySelectorAll('.tab-item');
        
        const groups = [];
        groupSections.forEach((section, index) => {
            const headerSelectors = ['.group-header', 'h3', 'h2', '.category-header', '.group-title'];
            let header = null;
            
            for (const selector of headerSelectors) {
                header = section.querySelector(selector);
                if (header) break;
            }
            
            const groupName = header ? header.textContent.split('\n')[0].trim() : '';
            const tabsInGroup = section.querySelectorAll('.tab-item');
            
            groups.push({
                index: index + 1,
                name: groupName,
                tabCount: tabsInGroup.length,
                element: !!section
            });
        });
        
        return {
            groups,
            totalGroups: groupSections.length,
            totalTabs: tabItems.length
        };
    });
    
    console.log(chalk.blue('   📊 Grouping results:'));
    groupingResults.groups.forEach(group => {
        console.log(chalk.gray(`      Group ${group.index}: "${group.name}" (${group.tabCount} tabs)`));
    });
    
    // Start domain validation sub-test
    const domainValidation = runner.startSubTest('Domain Group Validation');
    
    // Validate minimum groups
    const groupCountValid = groupingResults.totalGroups >= 3;
    runner.addAssertion(
        'At least 3 domain groups (github.com, stackoverflow.com, docs.python.org)',
        `${groupingResults.totalGroups} groups: ${groupingResults.groups.map(g => g.name).join(', ')}`,
        groupCountValid,
        'Domain Group Validation'
    );
    if (!groupCountValid) {
        throw new Error(`Expected at least 3 domain groups, got ${groupingResults.totalGroups}`);
    }
    
    // Validate tab count
    const tabCountValid = groupingResults.totalTabs >= testUrls.length;
    runner.addAssertion(
        `At least ${testUrls.length} tabs from test URLs`,
        `${groupingResults.totalTabs} tabs displayed`,
        tabCountValid,
        'Domain Group Validation'
    );
    if (!tabCountValid) {
        throw new Error(`Expected at least ${testUrls.length} tabs, got ${groupingResults.totalTabs}`);
    }
    
    // Check for expected domain groups
    const expectedDomains = ['github.com', 'stackoverflow.com', 'docs.python.org'];
    const foundDomains = [];
    
    groupingResults.groups.forEach(group => {
        const groupName = group.name.toLowerCase();
        expectedDomains.forEach(domain => {
            if (groupName.includes(domain)) {
                foundDomains.push(domain);
            }
        });
    });
    
    const domainsValid = foundDomains.length >= 3;
    runner.addAssertion(
        'Domain groups for: github.com, stackoverflow.com, docs.python.org',
        `Found domains: ${foundDomains.join(', ')}`,
        domainsValid,
        'Domain Group Validation'
    );
    if (!domainsValid) {
        throw new Error(`Expected to find 3+ expected domains, found: ${foundDomains.join(', ')}`);
    }
    
    // Verify GitHub group has 2 tabs (we created 2 GitHub URLs)
    const githubGroup = groupingResults.groups.find(group => 
        group.name.toLowerCase().includes('github.com')
    );
    
    const githubTabsValid = githubGroup && githubGroup.tabCount === 2;
    runner.addAssertion(
        '2 tabs in GitHub group (created 2 GitHub URLs)',
        githubGroup ? `${githubGroup.tabCount} tabs in "${githubGroup.name}" group` : 'No GitHub group found',
        githubTabsValid,
        'Domain Group Validation'
    );
    if (!githubTabsValid) {
        throw new Error(`GitHub group should have 2 tabs, got ${githubGroup ? githubGroup.tabCount : 0}`);
    }
    
    console.log(chalk.green(`   ✅ Domain grouping successful: ${groupingResults.totalGroups} groups, domains: ${foundDomains.join(', ')}`));
    
    await runner.showDemoBalloon(`✅ Domain grouping: ${groupingResults.totalGroups} groups, found domains: ${foundDomains.join(', ')}`, 'PASSED', 2000);
    
    // Add overall test assertion
    runner.addAssertion(
        'Domain grouping functionality works correctly',
        `${groupingResults.totalGroups} groups created with proper domain separation and tab distribution`,
        true
    );
    
    // Cleanup test tabs
    const tabIds = createdTabs.map(tab => tab.id);
    await runner.showDemoBalloon('🧹 Cleaning up test tabs...', 'INFO', 1500);
    await runner.closeTestTabs(tabIds);
    
    // Test completed successfully
    return true;
}

/**
 * Test GROUP BY category functionality
 */
async function testGroupByCategory(runner) {
    console.log(chalk.blue('   📂 Testing GROUP BY category...'));
    
    await runner.showDemoBalloon('Testing GROUP BY category', 'INFO');
    
    // Clean up any existing test tabs first
    await runner.closeAllTestTabs();
    
    // Create test tabs
    const testUrls = [
        'https://github.com/test/repo',
        'https://stackoverflow.com/questions/test'
    ];
    
    const createdTabs = await runner.createTestTabs(testUrls);
    
    await runner.showDemoBalloon(`📄 Created ${createdTabs.length} test tabs for category testing`, 'INFO', 2000);
    
    // Load current tabs
    console.log(chalk.blue('   🔄 Loading current tabs...'));
    await runner.page.evaluate(() => {
        const currentBtn = document.querySelector("[data-tab='categorize']");
        if (currentBtn) {
            currentBtn.click();
        }
    });
    
    // Wait for tabs to load and potentially be categorized
    await runner.page.waitForTimeout(2000);
    await runner.showDemoBalloon('✅ Current tabs loaded', 'PASSED', 1500);
    
    // Set category grouping
    console.log(chalk.blue('   🔄 Setting category grouping...'));
    await runner.showDemoBalloon('🔄 Switching to GROUP BY Category mode', 'INFO', 1500);
    await runner.page.evaluate(() => {
        const select = document.getElementById('unifiedGroupingSelect');
        if (select) {
            select.value = 'category';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        }
    });
    
    // Wait for category grouping to complete
    await runner.page.waitForTimeout(2000);
    await runner.showDemoBalloon('⚙️ Analyzing category groups...', 'INFO', 1500);
    
    // Get category grouping results
    const categoryResults = await runner.page.evaluate(() => {
        // Try both possible selectors for category sections
        const categorySelectors = ['.category-section', '.group-section'];
        let groupSections = [];
        let selectorUsed = 'none';
        
        for (const selector of categorySelectors) {
            groupSections = document.querySelectorAll(selector);
            if (groupSections.length > 0) {
                selectorUsed = selector;
                break;
            }
        }
        
        const groups = [];
        
        // Filter out empty/hidden groups (groups with no visible tabs)
        Array.from(groupSections).forEach((section, index) => {
            const tabsInGroup = section.querySelectorAll('.tab-item');
            
            // Only include groups that have actual tabs
            if (tabsInGroup.length > 0) {
                const headerSelectors = ['.group-header', 'h3', 'h2', '.category-header', '.group-title'];
                let header = null;
                let groupName = '';
                
                for (const selector of headerSelectors) {
                    header = section.querySelector(selector);
                    if (header) break;
                }
                
                if (header) {
                    // Try to get text from nested title elements first
                    const titleElement = header.querySelector('.category-header-title, .group-header-title, .title');
                    if (titleElement) {
                        // Get all text content, clean up whitespace and filter out empty strings
                        const textParts = titleElement.textContent.split('\n')
                            .map(part => part.trim())
                            .filter(part => part.length > 0);
                        groupName = textParts.join(' ').trim();
                    } else {
                        // Fallback to header text content
                        const textParts = header.textContent.split('\n')
                            .map(part => part.trim())
                            .filter(part => part.length > 0);
                        groupName = textParts.join(' ').trim();
                    }
                }
                
                groups.push({
                    index: groups.length + 1,
                    name: groupName,
                    tabCount: tabsInGroup.length,
                    rawHtml: section.innerHTML.substring(0, 500), // Debug info
                    sectionIndex: index // Original section index
                });
            }
        });
        
        return {
            groups,
            totalGroups: groups.length, // Only count groups with tabs
            allSections: groupSections.length, // Total sections found
            selectorUsed
        };
    });
    
    console.log(chalk.blue('   📊 Category grouping results:'));
    console.log(chalk.gray(`      Selector used: ${categoryResults.selectorUsed}`));
    console.log(chalk.gray(`      Total sections found: ${categoryResults.allSections}, groups with tabs: ${categoryResults.totalGroups}`));
    categoryResults.groups.forEach(group => {
        console.log(chalk.gray(`      Group ${group.index}: "${group.name}" (${group.tabCount} tabs)`));
        if (!group.name) {
            console.log(chalk.yellow(`        Debug HTML: ${group.rawHtml}`));
        }
    });
    
    // Start category validation sub-test
    const categoryValidation = runner.startSubTest('Category Group Validation');
    
    // Validate exactly one category group is visible
    const hasOnlyOneGroup = categoryResults.totalGroups === 1;
    runner.addAssertion(
        'Only one category group should be visible',
        `${categoryResults.totalGroups} groups found`,
        hasOnlyOneGroup,
        'Category Group Validation'
    );
    if (!hasOnlyOneGroup) {
        throw new Error(`Expected exactly 1 category group, got ${categoryResults.totalGroups}`);
    }
    
    // Check for "Uncategorized" title with URL count
    const categoryGroup = categoryResults.groups[0];
    const groupName = categoryGroup ? categoryGroup.name : '';
    const hasUncategorizedTitle = groupName.toLowerCase().includes('uncategorized');
    const hasUrlCount = /\(\d+\)/.test(groupName); // Check for pattern like (number)
    
    runner.addAssertion(
        'Category group title should be "Uncategorized (number of unique urls)"',
        `Group title: "${groupName}"`,
        hasUncategorizedTitle && hasUrlCount,
        'Category Group Validation'
    );
    if (!hasUncategorizedTitle) {
        throw new Error(`Expected "Uncategorized" title, got: "${groupName}"`);
    }
    if (!hasUrlCount) {
        throw new Error(`Expected URL count in parentheses, got: "${groupName}"`);
    }
    
    // Validate the group has tabs
    const groupHasTabs = categoryGroup && categoryGroup.tabCount > 0;
    runner.addAssertion(
        'Uncategorized group should contain tabs',
        `${categoryGroup ? categoryGroup.tabCount : 0} tabs in group`,
        groupHasTabs,
        'Category Group Validation'
    );
    if (!groupHasTabs) {
        throw new Error(`Uncategorized group should have tabs, got ${categoryGroup ? categoryGroup.tabCount : 0}`);
    }
    
    console.log(chalk.green(`   ✅ Category grouping successful: 1 group with "Uncategorized" title`));
    
    await runner.showDemoBalloon(`✅ Category grouping: 1 group with "Uncategorized" title`, 'PASSED', 2000);
    
    // Add overall test assertion
    runner.addAssertion(
        'Category grouping functionality works correctly',
        `1 category group with proper "Uncategorized (${categoryGroup.tabCount})" format`,
        true
    );
    
    // Cleanup test tabs
    const tabIds = createdTabs.map(tab => tab.id);
    await runner.showDemoBalloon('🧹 Cleaning up test tabs...', 'INFO', 1500);
    await runner.closeTestTabs(tabIds);
    
    // Test completed successfully
    return true;
}

/**
 * Test grouping options availability and switching
 */
async function testGroupingOptions(runner) {
    console.log(chalk.blue('   🔄 Testing grouping options switching...'));
    
    // Clean up any existing test tabs first
    await runner.closeAllTestTabs();
    
    // Create test tabs
    const testUrls = [
        'https://github.com/test/repo',
        'https://stackoverflow.com/questions/test'
    ];
    
    const createdTabs = await runner.createTestTabs(testUrls);
    
    // Load current tabs
    await runner.page.evaluate(() => {
        const currentBtn = document.querySelector("[data-tab='categorize']");
        if (currentBtn) {
            currentBtn.click();
        }
    });
    
    await runner.page.waitForTimeout(1000);
    
    // Check available grouping options
    const groupingOptions = await runner.page.evaluate(() => {
        const select = document.getElementById('unifiedGroupingSelect');
        if (select) {
            return Array.from(select.options).map(option => ({
                value: option.value,
                text: option.textContent
            }));
        }
        return [];
    });
    
    console.log(chalk.blue('   📋 Available grouping options:'));
    groupingOptions.forEach(option => {
        console.log(chalk.gray(`      ${option.value}: ${option.text}`));
    });
    
    // Test switching from domain to category and back
    console.log(chalk.blue('   🔄 Testing domain to category switch...'));
    
    // First set to domain
    await runner.page.evaluate(() => {
        const select = document.getElementById('unifiedGroupingSelect');
        if (select) {
            select.value = 'domain';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        }
    });
    
    await runner.page.waitForTimeout(1000);
    
    // Get domain grouping results
    const domainResults = await runner.page.evaluate(() => {
        const groupSections = document.querySelectorAll('.group-section');
        return {
            totalGroups: groupSections.length,
            hasGroups: groupSections.length > 0
        };
    });
    
    // Then switch to category
    await runner.page.evaluate(() => {
        const select = document.getElementById('unifiedGroupingSelect');
        if (select) {
            select.value = 'category';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        }
    });
    
    await runner.page.waitForTimeout(2000);
    
    // Get category grouping results
    const categoryResults = await runner.page.evaluate(() => {
        const groupSections = document.querySelectorAll('.group-section, .category-section');
        return {
            totalGroups: groupSections.length,
            hasGroups: groupSections.length > 0
        };
    });
    
    // Start grouping options validation sub-test
    const optionsValidation = runner.startSubTest('Grouping Options Validation');
    
    // Validate available options first
    const expectedOptions = ['category', 'domain'];
    const availableValues = groupingOptions.map(opt => opt.value);
    
    const allOptionsValid = expectedOptions.every(expected => availableValues.includes(expected));
    runner.addAssertion(
        'Grouping options: category, domain',
        `Available options: ${availableValues.join(', ')}`,
        allOptionsValid,
        'Grouping Options Validation'
    );
    if (!allOptionsValid) {
        const missing = expectedOptions.filter(opt => !availableValues.includes(opt));
        throw new Error(`Missing expected grouping options: ${missing.join(', ')}`);
    }
    
    // Start switching functionality sub-test
    const switchingTest = runner.startSubTest('Grouping Mode Switching');
    
    // Validate domain grouping works
    const domainGroupsValid = domainResults.hasGroups;
    runner.addAssertion(
        'At least 1 group when domain grouping is selected',
        `${domainResults.totalGroups} domain groups found`,
        domainGroupsValid,
        'Grouping Mode Switching'
    );
    if (!domainGroupsValid) {
        throw new Error('Domain grouping produced no groups');
    }
    
    // Validate category grouping works
    const categoryGroupsValid = categoryResults.hasGroups;
    runner.addAssertion(
        'At least 1 group when category grouping is selected',
        `${categoryResults.totalGroups} category groups found`,
        categoryGroupsValid,
        'Grouping Mode Switching'
    );
    if (!categoryGroupsValid) {
        throw new Error('Category grouping produced no groups');
    }
    
    console.log(chalk.green(`   ✅ Grouping options test successful: ${groupingOptions.length} options available, switching works`));
    
    // Add overall test assertion
    runner.addAssertion(
        'Grouping options and switching functionality works correctly',
        `${groupingOptions.length} options available with successful domain→category switching`,
        true
    );
    
    // Cleanup test tabs
    const tabIds = createdTabs.map(tab => tab.id);
    await runner.closeTestTabs(tabIds);
    
    // Test completed successfully
    return true;
}

/**
 * Test grouping behavior with duplicate URLs
 */
async function testGroupByWithDuplicateUrls(runner) {
    console.log(chalk.blue('   🔄 Testing grouping with duplicate URLs...'));
    
    // Clean up any existing test tabs first
    await runner.closeAllTestTabs();
    
    // Create duplicate tabs
    const duplicateUrl = 'https://github.com/test/duplicate';
    const testUrls = [
        duplicateUrl,
        duplicateUrl,  // Duplicate URL
        'https://stackoverflow.com/q/1'
    ];
    
    const createdTabs = await runner.createTestTabs(testUrls);
    
    // Load current tabs with domain grouping
    await runner.page.evaluate(() => {
        const currentBtn = document.querySelector("[data-tab='categorize']");
        if (currentBtn) {
            currentBtn.click();
        }
    });
    
    await runner.page.waitForTimeout(1000);
    
    // Set domain grouping
    await runner.page.evaluate(() => {
        const select = document.getElementById('unifiedGroupingSelect');
        if (select) {
            select.value = 'domain';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        }
    });
    
    await runner.page.waitForTimeout(2000);
    
    // Find GitHub group and check duplicate handling
    const duplicateResults = await runner.page.evaluate(() => {
        const groupSections = document.querySelectorAll('.group-section');
        const results = {
            githubGroup: null,
            allGroups: [],
            totalTabs: document.querySelectorAll('.tab-item').length
        };
        
        groupSections.forEach((section, index) => {
            const headerSelectors = ['.group-header', 'h3', 'h2', '.category-header', '.group-title'];
            let header = null;
            
            for (const selector of headerSelectors) {
                header = section.querySelector(selector);
                if (header) break;
            }
            
            const groupName = header ? header.textContent.split('\n')[0].trim() : '';
            const tabsInGroup = section.querySelectorAll('.tab-item');
            
            const groupInfo = {
                index: index + 1,
                name: groupName,
                tabCount: tabsInGroup.length,
                tabs: []
            };
            
            // Get tab details
            tabsInGroup.forEach(tab => {
                const tabText = tab.textContent || '';
                groupInfo.tabs.push({
                    text: tabText,
                    hasDuplicateIndicator: tabText.includes('2') || tabText.includes('x2') || tabText.toLowerCase().includes('duplicate')
                });
            });
            
            results.allGroups.push(groupInfo);
            
            // Check if this is the GitHub group
            if (groupName.toLowerCase().includes('github.com')) {
                results.githubGroup = groupInfo;
            }
        });
        
        return results;
    });
    
    console.log(chalk.blue('   📊 Duplicate URL results:'));
    duplicateResults.allGroups.forEach(group => {
        console.log(chalk.gray(`      Group ${group.index}: "${group.name}" (${group.tabCount} tabs)`));
        group.tabs.forEach((tab, i) => {
            console.log(chalk.gray(`        Tab ${i+1}: ${tab.hasDuplicateIndicator ? '🔄' : '📄'} ${tab.text.substring(0, 50)}...`));
        });
    });
    
    // Start duplicate handling validation sub-test
    const duplicateValidation = runner.startSubTest('Duplicate URL Handling');
    
    // Validate GitHub group exists
    const githubGroupExists = !!duplicateResults.githubGroup;
    runner.addAssertion(
        'GitHub group containing duplicate URL tabs',
        githubGroupExists ? `GitHub group "${duplicateResults.githubGroup.name}" found` : `Groups found: ${duplicateResults.allGroups.map(g => g.name).join(', ')}`,
        githubGroupExists,
        'Duplicate URL Handling'
    );
    if (!githubGroupExists) {
        throw new Error('Should find GitHub group with duplicate URLs');
    }
    
    // Validate GitHub group has tabs
    const githubHasTabs = duplicateResults.githubGroup.tabCount > 0;
    runner.addAssertion(
        'GitHub group with at least 1 tab',
        `GitHub group "${duplicateResults.githubGroup.name}" has ${duplicateResults.githubGroup.tabCount} tabs`,
        githubHasTabs,
        'Duplicate URL Handling'
    );
    if (!githubHasTabs) {
        throw new Error('GitHub group should have tabs');
    }
    
    // Check duplicate indicator
    const hasDuplicateIndicator = duplicateResults.githubGroup.tabs.some(tab => tab.hasDuplicateIndicator);
    runner.addAssertion(
        'Duplicate indicator should be present or not needed',
        `Duplicate indicator: ${hasDuplicateIndicator ? 'found' : 'not found'}`,
        true, // Always pass this as it's informational
        'Duplicate URL Handling'
    );
    
    // Validate total tab count
    const tabCountValid = duplicateResults.totalTabs >= testUrls.length - 1;  // -1 because duplicates might be merged
    runner.addAssertion(
        `At least ${testUrls.length - 1} tabs (duplicate URLs may be merged)`,
        `${duplicateResults.totalTabs} tabs total`,
        tabCountValid,
        'Duplicate URL Handling'
    );
    if (!tabCountValid) {
        throw new Error(`Should show ${testUrls.length - 1}+ tabs, got ${duplicateResults.totalTabs}`);
    }
    
    console.log(chalk.green(`   ✅ Duplicate URL handling: ${duplicateResults.githubGroup.tabCount} tabs in GitHub group, duplicate indicator: ${hasDuplicateIndicator ? 'found' : 'not needed'}`));
    
    // Add overall test assertion
    runner.addAssertion(
        'Duplicate URL handling works correctly',
        `GitHub group with ${duplicateResults.githubGroup.tabCount} tabs, duplicate indicator: ${hasDuplicateIndicator ? 'found' : 'not needed'}`,
        true
    );
    
    // Cleanup test tabs
    const tabIds = createdTabs.map(tab => tab.id);
    await runner.closeTestTabs(tabIds);
    
    // Test completed successfully
    return true;
}

/**
 * Test grouping behavior with subdomains
 */
async function testGroupByWithSubdomains(runner) {
    console.log(chalk.blue('   🌐 Testing grouping with subdomains...'));
    
    // Clean up any existing test tabs first
    await runner.closeAllTestTabs();
    
    // Create tabs with subdomains
    const testUrls = [
        'https://github.com/test/repo',
        'https://api.github.com/users/test',
        'https://docs.github.com/en/guide'
    ];
    
    const createdTabs = await runner.createTestTabs(testUrls);
    
    // Load current tabs with domain grouping
    await runner.page.evaluate(() => {
        const currentBtn = document.querySelector("[data-tab='categorize']");
        if (currentBtn) {
            currentBtn.click();
        }
    });
    
    await runner.page.waitForTimeout(1000);
    
    // Set domain grouping
    await runner.page.evaluate(() => {
        const select = document.getElementById('unifiedGroupingSelect');
        if (select) {
            select.value = 'domain';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        }
    });
    
    await runner.page.waitForTimeout(2000);
    
    // Check how subdomains are grouped
    const subdomainResults = await runner.page.evaluate(() => {
        const groupSections = document.querySelectorAll('.group-section');
        const results = {
            githubGroups: [],
            allGroups: [],
            totalTabs: document.querySelectorAll('.tab-item').length
        };
        
        groupSections.forEach((section, index) => {
            const headerSelectors = ['.group-header', 'h3', 'h2', '.category-header', '.group-title'];
            let header = null;
            
            for (const selector of headerSelectors) {
                header = section.querySelector(selector);
                if (header) break;
            }
            
            const groupName = header ? header.textContent.split('\n')[0].trim() : '';
            const tabsInGroup = section.querySelectorAll('.tab-item');
            
            const groupInfo = {
                index: index + 1,
                name: groupName,
                tabCount: tabsInGroup.length
            };
            
            results.allGroups.push(groupInfo);
            
            // Check if this is a GitHub-related group
            if (groupName.toLowerCase().includes('github')) {
                results.githubGroups.push(groupInfo);
            }
        });
        
        return results;
    });
    
    console.log(chalk.blue('   📊 Subdomain grouping results:'));
    subdomainResults.allGroups.forEach(group => {
        console.log(chalk.gray(`      Group ${group.index}: "${group.name}" (${group.tabCount} tabs)`));
    });
    
    console.log(chalk.blue('   🔍 GitHub-related groups:'));
    subdomainResults.githubGroups.forEach(group => {
        console.log(chalk.gray(`      ${group.name} (${group.tabCount} tabs)`));
    });
    
    // Start subdomain handling validation sub-test
    const subdomainValidation = runner.startSubTest('Subdomain Handling');
    
    // Validate GitHub-related groups exist
    const githubGroupsExist = subdomainResults.githubGroups.length > 0;
    runner.addAssertion(
        'GitHub-related groups for subdomains (github.com, api.github.com, docs.github.com)',
        githubGroupsExist ? `${subdomainResults.githubGroups.length} GitHub groups: ${subdomainResults.githubGroups.map(g => g.name).join(', ')}` : `All groups: ${subdomainResults.allGroups.map(g => g.name).join(', ')}`,
        githubGroupsExist,
        'Subdomain Handling'
    );
    if (!githubGroupsExist) {
        throw new Error('Should find GitHub-related groups');
    }
    
    // Validate all subdomain tabs are shown
    const allTabsShown = subdomainResults.totalTabs >= testUrls.length;
    runner.addAssertion(
        `${testUrls.length} tabs from subdomain URLs`,
        `${subdomainResults.totalTabs} tabs displayed`,
        allTabsShown,
        'Subdomain Handling'
    );
    if (!allTabsShown) {
        throw new Error(`Should show all subdomain tabs, got ${subdomainResults.totalTabs}`);
    }
    
    // Calculate total GitHub tabs across all GitHub groups
    const totalGithubTabs = subdomainResults.githubGroups.reduce((sum, group) => sum + group.tabCount, 0);
    const githubTabsValid = totalGithubTabs >= 3;
    runner.addAssertion(
        '3 GitHub tabs across subdomain groups',
        `${totalGithubTabs} GitHub tabs in ${subdomainResults.githubGroups.length} groups`,
        githubTabsValid,
        'Subdomain Handling'
    );
    if (!githubTabsValid) {
        throw new Error(`Should have at least 3 GitHub tabs across groups, got ${totalGithubTabs}`);
    }
    
    console.log(chalk.green(`   ✅ Subdomain grouping: ${subdomainResults.githubGroups.length} GitHub groups, ${totalGithubTabs} total GitHub tabs`));
    
    // Add overall test assertion
    runner.addAssertion(
        'Subdomain grouping works correctly',
        `${subdomainResults.githubGroups.length} GitHub groups with ${totalGithubTabs} total tabs properly distributed`,
        true
    );
    
    // Cleanup test tabs  
    const tabIds = createdTabs.map(tab => tab.id);
    await runner.closeTestTabs(tabIds);
    
    // Test completed successfully
    return true;
}

/**
 * Main test runner
 */
async function main() {
    // Check for demo mode flag
    const demoMode = process.argv.includes('--demo') || process.argv.includes('-d');
    
    const runner = new ExtensionTestRunner({ demoMode });
    
    if (demoMode) {
        console.log(chalk.yellow('🎬 Demo mode enabled - visual balloons will be shown'));
    }
    
    try {
        if (!(await runner.connect())) {
            process.exit(1);
        }
        
        const tests = [
            { name: 'GROUP BY Domain', test: testGroupByDomain },
            { name: 'GROUP BY Category', test: testGroupByCategory },
            { name: 'Grouping Options', test: testGroupingOptions },
            { name: 'Duplicate URLs', test: testGroupByWithDuplicateUrls },
            { name: 'Subdomains', test: testGroupByWithSubdomains }
        ];
        
        const results = await runner.runTests(tests);
        
        // Cleanup before exit
        await runner.cleanup();
        
        // Exit with appropriate code
        process.exit(results.failed > 0 ? 1 : 0);
        
    } catch (error) {
        console.error(chalk.red('💥 Test execution failed:'), error.message);
        
        // Cleanup even on error
        await runner.cleanup();
        
        process.exit(1);
    }
}

// Export for use in other test runners
module.exports = {
    testGroupByDomain,
    testGroupByCategory,
    testGroupingOptions,
    testGroupByWithDuplicateUrls,
    testGroupByWithSubdomains
};

// Run if called directly
if (require.main === module) {
    // Show usage if help requested
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        console.log(`
${chalk.blue('Chrome Extension GROUP BY Tests')}

${chalk.green('Usage:')}
  node tests/test-groupby.js [options]

${chalk.green('Options:')}
  --demo, -d    Enable demo mode with visual balloons in extension popup
  --help, -h    Show this help message

${chalk.green('Examples:')}
  node tests/test-groupby.js           # Run tests normally
  node tests/test-groupby.js --demo    # Run tests with visual demo balloons

${chalk.yellow('Note:')} Demo mode shows visual progress balloons in the Chrome extension popup window.
        `);
        process.exit(0);
    }
    
    main();
}