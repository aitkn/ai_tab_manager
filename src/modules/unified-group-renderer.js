/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Unified Group Renderer - handles rendering of groups and categories for both Current and Saved tabs
 */

import { TAB_CATEGORIES, CATEGORY_NAMES, CSS_CLASSES, GROUPING_OPTIONS, LIMITS } from '../utils/constants.js';
import { createElement, classes } from '../utils/dom-helpers.js';
import { sortTabsInGroup, extractDateFromGroupName, smartConfirm } from '../utils/helpers.js';
import { createTabElement } from './unified-tab-renderer.js';
import { state } from './state-manager.js';
import { unifiedSearchService } from '../services/UnifiedSearchService.js';

/**
 * Group Render Strategy Interface
 * Defines the contract for different group rendering strategies
 */
class GroupRenderStrategy {
  /**
   * Create action buttons for the group/category
   * @param {Array} tabs - Tabs in the group
   * @param {string} groupName - Name of the group
   * @param {number|string} groupType - Category number or group type
   * @returns {DocumentFragment|HTMLElement}
   */
  createActionButtons(tabs, groupName, groupType) {
    throw new Error('createActionButtons must be implemented by subclass');
  }

  /**
   * Get CSS class modifiers for group element
   * @param {string} groupName - Name of the group
   * @param {number|string} groupType - Category number or group type
   * @returns {string}
   */
  getGroupModifierClasses(groupName, groupType) {
    return '';
  }

  /**
   * Get group ID prefix
   * @returns {string}
   */
  getGroupIdPrefix() {
    return '';
  }

  /**
   * Should show empty groups
   * @returns {boolean}
   */
  shouldShowEmptyGroups() {
    return true;
  }
}

/**
 * Current Tabs Group Renderer Strategy
 * Handles rendering for live browser tab groups
 */
export class CurrentGroupRenderStrategy extends GroupRenderStrategy {
  constructor(tabOperations) {
    super();
    this.tabOperations = tabOperations;
  }

  createActionButtons(tabs, groupName, groupType) {
    const renderer = UnifiedGroupRenderer;
    
    if (typeof groupType === 'number') {
      // Category section - Close All button
      const hasUncategorized = groupType === TAB_CATEGORIES.UNCATEGORIZED;
      const title = hasUncategorized ? 
        'Close all uncategorized tabs (WARNING: These tabs have not been saved)' : 
        'Close all tabs in this category';
      
      return renderer.prototype.createActionButton({
        className: renderer.BUTTON_CLASSES.CATEGORY_CLOSE,
        title: title,
        icon: renderer.SVG_ICONS.CLOSE,
        hasWarning: hasUncategorized,
        onClick: () => {
          if (hasUncategorized) {
            // Show warning for uncategorized tabs
            if (smartConfirm('Are you sure you want to close all uncategorized tabs? These tabs have not been saved.', { defaultAnswer: false })) {
              this.tabOperations.closeAllInCategory(groupType);
            }
          } else {
            this.tabOperations.closeAllInCategory(groupType);
          }
        }
      });
    } else {
      // Group section - Close All button
      const hasUncategorizedInGroup = tabs.some(tab => tab.category === TAB_CATEGORIES.UNCATEGORIZED);
      const title = hasUncategorizedInGroup ? 
        'Close all tabs in this group (WARNING: Includes uncategorized tabs)' : 
        'Close all tabs in this group';
      
      return renderer.prototype.createActionButton({
        className: renderer.BUTTON_CLASSES.GROUP_CLOSE,
        title: title,
        icon: renderer.SVG_ICONS.CLOSE,
        hasWarning: hasUncategorizedInGroup,
        onClick: () => {
          this.tabOperations.closeTabsInGroup(tabs);
        }
      });
    }
  }

  getGroupIdPrefix() {
    return 'category';
  }

  shouldShowEmptyGroups() {
    return false; // Don't show empty categories for current tabs
  }
}

/**
 * Saved Tabs Group Renderer Strategy
 * Handles rendering for saved tab groups from database
 */
export class SavedGroupRenderStrategy extends GroupRenderStrategy {
  constructor(tabOperations) {
    super();
    this.tabOperations = tabOperations;
  }

  createActionButtons(tabs, groupName, groupType) {
    const renderer = UnifiedGroupRenderer;
    const fragment = document.createDocumentFragment();

    if (typeof groupType === 'number') {
      // Category section - Open All and Delete All buttons
      const openAllBtn = renderer.prototype.createActionButton({
        className: renderer.BUTTON_CLASSES.CATEGORY_ACTION,
        title: `Open all ${tabs.length} tabs`,
        icon: renderer.SVG_ICONS.OPEN,
        onClick: () => {
          this.tabOperations.openSavedTabs(tabs);
        }
      });
      fragment.appendChild(openAllBtn);

      const deleteBtn = renderer.prototype.createActionButton({
        className: renderer.BUTTON_CLASSES.CATEGORY_ACTION + ' delete-btn',
        title: `Delete all ${tabs.length} tabs`,
        icon: renderer.SVG_ICONS.DELETE,
        onClick: () => {
          this.tabOperations.deleteTabsInCategory(tabs, CATEGORY_NAMES[groupType]);
        }
      });
      fragment.appendChild(deleteBtn);
    } else {
      // Group section - Open All and Delete All buttons
      const openAllBtn = renderer.prototype.createActionButton({
        className: renderer.BUTTON_CLASSES.GROUP_ACTION,
        title: 'Open all tabs in this group',
        icon: renderer.SVG_ICONS.OPEN,
        onClick: () => {
          this.tabOperations.openAllTabsInGroup(tabs);
        }
      });
      fragment.appendChild(openAllBtn);

      const deleteBtn = renderer.prototype.createActionButton({
        className: renderer.BUTTON_CLASSES.GROUP_ACTION + ' delete-btn',
        title: 'Delete all tabs in this group',
        icon: renderer.SVG_ICONS.DELETE,
        onClick: () => {
          this.tabOperations.deleteTabsInGroup(tabs, groupName);
        }
      });
      fragment.appendChild(deleteBtn);
    }

    return fragment;
  }

  getGroupIdPrefix() {
    return 'savedCategory';
  }

  shouldShowEmptyGroups() {
    return false; // Don't show empty categories for saved tabs
  }
}

/**
 * Unified Group Renderer
 * Main class that renders groups and categories using different strategies
 */
export class UnifiedGroupRenderer {
  constructor() {
    this.strategies = new Map();
  }

  /**
   * Create expandable tabs list with pagination
   * @param {Array} tabs - All tabs to display
   * @param {number|string} categoryOrGroupType - Category number or group type for tab creation
   * @param {string} type - Tab type ('current' or 'saved')
   * @returns {Promise<HTMLElement>} Tabs list element with expandable functionality
   */
  async createExpandableTabsList(tabs, categoryOrGroupType, type) {
    const tabsList = createElement('div', { className: CSS_CLASSES.TABS_LIST });

    // Filter tabs based on search query using unified search service
    unifiedSearchService.setSearchQuery(state.searchQuery || '');
    const visibleTabs = tabs.filter(tab => {
      return unifiedSearchService.matchesSearch(tab, false);
    });

    // Expandable group logic: show first 15 tabs, then add "Show more" button
    const INITIAL_TAB_COUNT = LIMITS.INITIAL_TAB_COUNT;
    let currentlyShown = 0;

    // Function to add a batch of tabs
    const addTabBatch = async (startIndex, batchSize) => {
      const endIndex = Math.min(startIndex + batchSize, visibleTabs.length);
      for (let i = startIndex; i < endIndex; i++) {
        const tab = visibleTabs[i];
        const tabElement = await createTabElement(tab, typeof categoryOrGroupType === 'number' ? categoryOrGroupType : tab.category, type === 'saved');
        tabsList.appendChild(tabElement);
      }
      return endIndex;
    };

    // Add initial batch of tabs
    if (visibleTabs.length > 0) {
      currentlyShown = await addTabBatch(0, INITIAL_TAB_COUNT);
    }

    // Helper function to create expand button (bind this context)
    const createExpandButton = () => {
      if (currentlyShown >= visibleTabs.length) return null;
      
      const remainingCount = visibleTabs.length - currentlyShown;
      const nextBatchSize = Math.min(remainingCount, INITIAL_TAB_COUNT);
      
      const expandButton = createElement('div', {
        className: 'expand-group-button',
        innerHTML: `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span>Show ${nextBatchSize} more tabs (${remainingCount} remaining)</span>
        `
      });

      // Add click handler separately to maintain proper 'this' context
      expandButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        // Remove expand button
        expandButton.remove();
        
        // Add next batch of tabs
        currentlyShown = await addTabBatch(currentlyShown, INITIAL_TAB_COUNT);
        
        // Add new expand button if there are still more tabs
        const newExpandButton = createExpandButton();
        if (newExpandButton) {
          tabsList.appendChild(newExpandButton);
        }
      });
      
      return expandButton;
    };

    // Create initial expand button if there are more tabs
    if (visibleTabs.length > INITIAL_TAB_COUNT) {
      const expandButton = createExpandButton();
      if (expandButton) {
        tabsList.appendChild(expandButton);
      }
    }

    return tabsList;
  }


  /**
   * Create section header (category or group)
   * @param {Object} options - Header options
   * @returns {HTMLElement} Header element
   */
  createSectionHeader({ groupId, groupName, tabs, sectionType, groupingType, strategy }) {
    const isCategory = sectionType === 'category';
    
    if (isCategory) {
      return this.createCategoryHeader(groupId, groupName, tabs, strategy);
    } else {
      return this.createGroupHeader(groupId, groupName, tabs, groupingType, strategy);
    }
  }

  /**
   * Create category header
   */
  createCategoryHeader(category, groupName, tabs, strategy) {
    // Create header using old-style layout (h2 + category-header-title)
    const header = createElement('h2', { 
      className: CSS_CLASSES.CATEGORY_HEADER + this.getCategoryModifierClass(category),
      style: { cursor: 'pointer' }
    });

    // Category title section (old style)
    const categoryTitle = createElement('div', { className: 'category-header-title' });

    // Category icon (using old style SVG with proper attributes)
    const categoryIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    categoryIcon.setAttribute('class', 'category-icon');
    categoryIcon.setAttribute('width', '18');
    categoryIcon.setAttribute('height', '18');
    categoryIcon.setAttribute('viewBox', '0 0 24 24');
    
    // Set category-specific attributes
    const iconAttribs = this.getOldCategoryIconAttributes(category);
    Object.entries(iconAttribs).forEach(([key, value]) => {
      categoryIcon.setAttribute(key, value);
    });
    
    // Set inner content
    categoryIcon.innerHTML = this.getOldCategoryIcon(category);

    // Category name and count (inline format like "Important (9)")
    const categoryNameSpan = createElement('span', { 
      className: 'category-name',
      textContent: groupName
    });

    const countSpan = createElement('span', { 
      className: 'count',
      textContent: tabs.length.toString()
    });

    // Build title content: icon + "Name (count)"
    categoryTitle.appendChild(categoryIcon);
    categoryTitle.appendChild(document.createTextNode(' '));
    categoryTitle.appendChild(categoryNameSpan);
    categoryTitle.appendChild(document.createTextNode(' ('));
    categoryTitle.appendChild(countSpan);
    categoryTitle.appendChild(document.createTextNode(')'));

    // Category header actions
    const headerActions = createElement('div', { className: 'category-header-actions' });

    // Add action buttons using strategy
    if (tabs.length > 0) {
      const actionButtons = strategy.createActionButtons(tabs, '', category);
      headerActions.appendChild(actionButtons);
    }

    header.appendChild(categoryTitle);
    header.appendChild(headerActions);
    
    return header;
  }

  /**
   * Create group header
   */
  createGroupHeader(groupName, displayName, tabs, groupingType, strategy) {
    const header = createElement('div', { className: 'group-header' });

    // Group title with icon
    const titleDiv = createElement('div', { className: 'group-title' });

    // Add appropriate icon based on grouping type
    let icon = '';
    if (groupingType === GROUPING_OPTIONS.DOMAIN) {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
    } else if (groupingType.includes('Date') || groupingType.includes('Week') || groupingType.includes('Month')) {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
    }

    titleDiv.innerHTML = icon + `<span>${displayName}</span>`;
    header.appendChild(titleDiv);

    // Create stats and actions container
    const headerRight = createElement('div', { className: 'header-right' });

    // Count tabs by category (use full tabs list, not search-filtered)
    const categoryCounts = { 
      [TAB_CATEGORIES.UNCATEGORIZED]: 0,
      [TAB_CATEGORIES.CAN_CLOSE]: 0, 
      [TAB_CATEGORIES.SAVE_LATER]: 0, 
      [TAB_CATEGORIES.IMPORTANT]: 0 
    };

    tabs.forEach(tab => {
      if (categoryCounts[tab.category] !== undefined) {
        categoryCounts[tab.category]++;
      }
    });

    // Stats
    const stats = createElement('div', { className: CSS_CLASSES.GROUP_STATS });

    // Show counts with icons for each category
    if (categoryCounts[TAB_CATEGORIES.UNCATEGORIZED] > 0) {
      const uncategorizedStat = createElement('span', {
        className: 'stat-item uncategorized',
        innerHTML: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12" y2="16"></line></svg> ${categoryCounts[TAB_CATEGORIES.UNCATEGORIZED]}`
      });
      stats.appendChild(uncategorizedStat);
    }

    if (categoryCounts[TAB_CATEGORIES.IMPORTANT] > 0) {
      const importantStat = createElement('span', {
        className: 'stat-item important',
        innerHTML: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ${categoryCounts[TAB_CATEGORIES.IMPORTANT]}`
      });
      stats.appendChild(importantStat);
    }

    if (categoryCounts[TAB_CATEGORIES.SAVE_LATER] > 0) {
      const saveForLaterStat = createElement('span', {
        className: 'stat-item somewhat',
        innerHTML: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg> ${categoryCounts[TAB_CATEGORIES.SAVE_LATER]}`
      });
      stats.appendChild(saveForLaterStat);
    }

    if (categoryCounts[TAB_CATEGORIES.CAN_CLOSE] > 0) {
      const canCloseStat = createElement('span', {
        className: 'stat-item not-important',
        innerHTML: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> ${categoryCounts[TAB_CATEGORIES.CAN_CLOSE]}`
      });
      stats.appendChild(canCloseStat);
    }

    // Total count (always use original tabs count, not filtered)
    const totalStat = createElement('span', {
      className: 'stat-item total',
      textContent: `Total: ${tabs.length}`
    });
    stats.appendChild(totalStat);

    headerRight.appendChild(stats);

    // Group actions
    const groupActions = createElement('div', { className: 'group-actions' });

    // Add action buttons using strategy
    const actionButtons = strategy.createActionButtons(tabs, groupName, groupingType);
    groupActions.appendChild(actionButtons);

    headerRight.appendChild(groupActions);
    header.appendChild(headerRight);
    
    return header;
  }

  /**
   * Add collapse/expand behavior with reset functionality
   */
  addCollapseExpandBehavior(section, header, tabs, options) {
    const { groupId, type, sectionType, groupingType } = options;
    const isCategory = sectionType === 'category';
    const collapseClass = isCategory ? CSS_CLASSES.CATEGORY_COLLAPSED : CSS_CLASSES.GROUP_COLLAPSED;
    
    header.style.cursor = 'pointer';
    
    // Use addEventListener instead of onclick to avoid conflicts
    header.addEventListener('click', async (e) => {
      console.log('🔄 Group/Category header clicked:', sectionType, isCategory ? groupId : groupingType);
      
      // Don't collapse if clicking on action buttons
      const actionSelector = isCategory ? '.category-header-actions' : '.group-actions';
      if (e.target.closest(actionSelector)) {
        console.log('🛑 Clicked on action buttons, ignoring collapse');
        return;
      }
      
      const isCurrentlyCollapsed = classes.has(section, collapseClass);
      console.log('📊 Current collapsed state:', isCurrentlyCollapsed, 'Class:', collapseClass);
      
      classes.toggle(section, collapseClass);
      
      const newCollapsedState = classes.has(section, collapseClass);
      console.log('📊 New collapsed state:', newCollapsedState);
      
      // If expanding (was collapsed, now expanding), reset the expandable tabs list
      if (isCurrentlyCollapsed && tabs.length > 15) {
        console.log('🔄 Resetting expandable tabs list for section with', tabs.length, 'tabs');
        const existingTabsList = section.querySelector('.tabs-list');
        if (existingTabsList) {
          // Create new tabs list
          const newTabsList = await this.createExpandableTabsList(
            tabs, 
            isCategory ? groupId : groupingType, 
            type
          );
          
          // Replace tabs list immediately
          existingTabsList.remove();
          section.appendChild(newTabsList);
          console.log('✅ Expandable tabs list reset');
        }
      }
    });
  }

  /**
   * Shared SVG icons for consistent formatting
   */
  static SVG_ICONS = {
    CLOSE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    OPEN: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>',
    DELETE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>'
  };

  /**
   * Shared button classes for consistent styling
   */
  static BUTTON_CLASSES = {
    CATEGORY_ACTION: 'icon-btn',           // Standard size for category actions (Open/Delete)
    GROUP_ACTION: 'icon-btn-small',       // Small size for group actions (Open/Delete)
    CATEGORY_CLOSE: 'category-close-btn', // Close button for category sections
    GROUP_CLOSE: 'group-close-btn'        // Close button for group sections
  };

  /**
   * Create a standardized action button
   * @param {Object} options - Button options
   * @param {string} options.className - CSS class name
   * @param {string} options.title - Button title/tooltip
   * @param {string} options.icon - SVG icon (use SVG_ICONS constants)
   * @param {Function} options.onClick - Click handler
   * @param {boolean} options.hasWarning - Whether to add warning styling
   * @returns {HTMLElement}
   */
  createActionButton({ className, title, icon, onClick, hasWarning = false }) {
    const finalClassName = className + (hasWarning ? ' has-uncategorized' : '');
    
    return createElement('button', {
      className: finalClassName,
      title: title,
      innerHTML: icon,
      onclick: (e) => {
        e.stopPropagation();
        onClick(e);
      }
    });
  }

  /**
   * Register a rendering strategy
   * @param {string} type - Strategy type ('current' or 'saved')
   * @param {GroupRenderStrategy} strategy - Strategy instance
   */
  registerStrategy(type, strategy) {
    this.strategies.set(type, strategy);
  }

  /**
   * Get strategy for tab type
   * @param {string} type - Strategy type ('current' or 'saved')
   * @returns {GroupRenderStrategy}
   */
  getStrategy(type) {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(`No strategy registered for type: ${type}`);
    }
    return strategy;
  }

  /**
   * Create a unified section (category or group) using the appropriate strategy
   * @param {Object} options - Section options
   * @param {number|string} options.groupId - Category number or group name
   * @param {Array} options.tabs - Tabs in this section
   * @param {string} options.type - Tab type ('current' or 'saved')
   * @param {string} options.sectionType - 'category' or 'group'
   * @param {string} [options.groupingType] - Type of grouping (for groups)
   * @returns {Promise<HTMLElement|null>}
   */
  async createSection({ groupId, tabs, type, sectionType, groupingType = null }) {
    // Check if we should show empty sections
    if (tabs.length === 0) {
      const strategy = this.getStrategy(type);
      if (!strategy.shouldShowEmptyGroups()) {
        return null;
      }
    }

    const strategy = this.getStrategy(type);
    const isCategory = sectionType === 'category';
    const category = isCategory ? groupId : null;
    const groupName = isCategory ? CATEGORY_NAMES[groupId] || `Category ${groupId}` : groupId;
    
    // Sort tabs if this is a group (categories don't need sorting)
    const sortedTabs = isCategory ? tabs : sortTabsInGroup(tabs, groupingType);

    // Create section element
    const sectionClass = isCategory ? CSS_CLASSES.CATEGORY_SECTION : CSS_CLASSES.GROUP_SECTION;
    const section = createElement('div', {
      className: sectionClass + ' ' + strategy.getGroupModifierClasses(groupName, isCategory ? category : groupingType),
      id: isCategory ? `${strategy.getGroupIdPrefix()}${category}` : undefined,
      dataset: isCategory ? { category: category } : undefined
    });

    // Create header
    const header = this.createSectionHeader({
      groupId,
      groupName,
      tabs: sortedTabs,
      sectionType,
      groupingType,
      strategy
    });

    section.appendChild(header);

    // Create expandable tabs list using common method
    const tabsList = await this.createExpandableTabsList(sortedTabs, isCategory ? category : groupingType, type);
    section.appendChild(tabsList);

    // Add collapse/expand functionality with reset
    this.addCollapseExpandBehavior(section, header, sortedTabs, { groupId, type, sectionType, groupingType });

    // Category-specific behaviors
    if (isCategory) {
      // Show/hide uncategorized section based on whether it has tabs
      if (category === TAB_CATEGORIES.UNCATEGORIZED) {
        const hasUncategorized = tabs.length > 0;
        section.style.display = hasUncategorized ? 'block' : 'none';
      }

      // Mark section as empty if no tabs
      if (tabs.length === 0) {
        classes.add(section, CSS_CLASSES.CATEGORY_EMPTY);
      } else {
        classes.remove(section, CSS_CLASSES.CATEGORY_EMPTY);
      }
    }

    return section;
  }

  /**
   * Create a category section (legacy method - calls unified createSection)
   * @param {number} category - Category number
   * @param {Array} tabs - Tabs in this category
   * @param {string} type - Tab type ('current' or 'saved')
   * @returns {Promise<HTMLElement|null>}
   */
  async createCategorySection(category, tabs, type) {
    return this.createSection({
      groupId: category,
      tabs,
      type,
      sectionType: 'category'
    });
  }

  /**
   * Create a group section (legacy method - calls unified createSection)
   * @param {string} groupName - Name of the group
   * @param {Array} tabs - Tabs in this group
   * @param {string} groupingType - Type of grouping
   * @param {string} type - Tab type ('current' or 'saved')
   * @returns {Promise<HTMLElement>}
   */
  async createGroupSection(groupName, tabs, groupingType, type) {
    return this.createSection({
      groupId: groupName,
      tabs,
      type,
      sectionType: 'group',
      groupingType
    });
  }

  /**
   * Get old-style category icon attributes (from original popup.html)
   * @param {number} category - Category number
   * @returns {Object} Icon attributes
   */
  getOldCategoryIconAttributes(category) {
    switch (category) {
      case TAB_CATEGORIES.IMPORTANT:
        return { fill: 'currentColor' };
      case TAB_CATEGORIES.SAVE_LATER:
      case TAB_CATEGORIES.CAN_CLOSE:
      case TAB_CATEGORIES.UNCATEGORIZED:
      default:
        return { 
          fill: 'none', 
          stroke: 'currentColor', 
          'stroke-width': '2', 
          'stroke-linecap': 'round', 
          'stroke-linejoin': 'round' 
        };
    }
  }

  /**
   * Get old-style category icon HTML (from original popup.html)
   * @param {number} category - Category number
   * @returns {string} Icon HTML (inner content only)
   */
  getOldCategoryIcon(category) {
    switch (category) {
      case TAB_CATEGORIES.IMPORTANT:
        return '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';
      case TAB_CATEGORIES.SAVE_LATER:
        return '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>';
      case TAB_CATEGORIES.CAN_CLOSE:
        return '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>';
      case TAB_CATEGORIES.UNCATEGORIZED:
        return '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12" y2="16"></line>';
      default:
        return '<circle cx="12" cy="12" r="10"></circle>';
    }
  }

  /**
   * Get category modifier CSS class
   * @param {number} category - Category number
   * @returns {string} CSS class modifier
   */
  getCategoryModifierClass(category) {
    switch (category) {
      case TAB_CATEGORIES.IMPORTANT:
        return ' important';
      case TAB_CATEGORIES.SAVE_LATER:
        return ' somewhat-important';
      case TAB_CATEGORIES.CAN_CLOSE:
        return ' not-important';
      default:
        return '';
    }
  }

  /**
   * Get category icon HTML
   * @param {number} category - Category number
   * @returns {string} Icon HTML
   */
  getCategoryIcon(category) {
    switch (category) {
      case TAB_CATEGORIES.IMPORTANT:
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>';
      case TAB_CATEGORIES.SAVE_LATER:
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>';
      case TAB_CATEGORIES.CAN_CLOSE:
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      case TAB_CATEGORIES.UNCATEGORIZED:
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6m11-5h-6m-6 0H1"></path></svg>';
      default:
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>';
    }
  }
}

// Create and export a singleton instance
export const unifiedGroupRenderer = new UnifiedGroupRenderer();

// Auto-register strategies with lazy loading of tab operations
let currentStrategy = null;
let savedStrategy = null;

/**
 * Get or create current group strategy
 */
async function getCurrentGroupStrategy() {
  if (!currentStrategy) {
    const tabOperations = await import('./tab-operations.js');
    currentStrategy = new CurrentGroupRenderStrategy(tabOperations.default);
    unifiedGroupRenderer.registerStrategy('current', currentStrategy);
  }
  return currentStrategy;
}

/**
 * Get or create saved group strategy  
 */
async function getSavedGroupStrategy() {
  if (!savedStrategy) {
    const tabOperations = await import('./tab-operations.js');
    savedStrategy = new SavedGroupRenderStrategy(tabOperations.default);
    unifiedGroupRenderer.registerStrategy('saved', savedStrategy);
  }
  return savedStrategy;
}

/**
 * Initialize strategies
 */
export async function initializeGroupRenderer() {
  await getCurrentGroupStrategy();
  await getSavedGroupStrategy();
}

/**
 * Create category section - main entry point
 * @param {number} category - Category number
 * @param {Array} tabs - Tabs in this category
 * @param {boolean} isFromSaved - Whether this is for saved tabs
 * @returns {Promise<HTMLElement|null>}
 */
export async function createCategorySection(category, tabs, isFromSaved = false) {
  // Ensure strategies are initialized
  await initializeGroupRenderer();
  
  const type = isFromSaved ? 'saved' : 'current';
  return unifiedGroupRenderer.createCategorySection(category, tabs, type);
}

/**
 * Create group section - main entry point
 * @param {string} groupName - Name of the group
 * @param {Array} tabs - Tabs in this group
 * @param {string} groupingType - Type of grouping
 * @param {boolean} isFromSaved - Whether this is for saved tabs
 * @returns {Promise<HTMLElement>}
 */
export async function createGroupSection(groupName, tabs, groupingType, isFromSaved = false) {
  // Ensure strategies are initialized
  await initializeGroupRenderer();
  
  const type = isFromSaved ? 'saved' : 'current';
  return unifiedGroupRenderer.createGroupSection(groupName, tabs, groupingType, type);
}

// Export for testing and advanced usage
export { GroupRenderStrategy };