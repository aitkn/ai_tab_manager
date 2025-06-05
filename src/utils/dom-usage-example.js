// Example: How DOM helpers would simplify popup.js code

// ===== BEFORE (Current verbose code) =====
document.getElementById(DOM_IDS.TABS_CONTAINER).style.display = DISPLAY.BLOCK;
document.getElementById(DOM_IDS.SEARCH_CONTROLS).style.display = DISPLAY.FLEX;
document.getElementById(DOM_IDS.CATEGORIZE_GROUPING_CONTROLS).style.display = DISPLAY.FLEX;

const button = document.createElement('button');
button.className = 'inline-action-btn primary-btn';
button.title = 'Open all tabs in this group';
button.innerHTML = '<svg>...</svg> Open All';
button.addEventListener('click', () => openAllInGroup(groupName));

document.getElementById(DOM_IDS.CATEGORIZE_BTN).addEventListener(EVENTS.CLICK, handleCategorize);
document.getElementById(DOM_IDS.SAVE_AND_CLOSE_ALL_BTN).addEventListener(EVENTS.CLICK, saveAndCloseAll);

// ===== AFTER (With DOM helpers) =====
import { $id, show, createElement, on } from './utils/dom-helpers.js';

// Show multiple elements
show($id(DOM_IDS.TABS_CONTAINER));
show($id(DOM_IDS.SEARCH_CONTROLS), 'flex');
show($id(DOM_IDS.CATEGORIZE_GROUPING_CONTROLS), 'flex');

// Create element with properties
const button = createElement('button', {
  className: 'inline-action-btn primary-btn',
  title: 'Open all tabs in this group',
  innerHTML: '<svg>...</svg> Open All',
  onclick: () => openAllInGroup(groupName)
});

// Add event listeners
on($id(DOM_IDS.CATEGORIZE_BTN), EVENTS.CLICK, handleCategorize);
on($id(DOM_IDS.SAVE_AND_CLOSE_ALL_BTN), EVENTS.CLICK, saveAndCloseAll);

// ===== MORE EXAMPLES =====

// Batch show/hide operations
import { $, show, hide, classes } from './utils/dom-helpers.js';

// Hide all category sections
hide('.category-section.empty');

// Toggle classes
classes.toggle($id(DOM_IDS.CATEGORY_1), 'collapsed');

// Animate element
animate($id(DOM_IDS.STATUS), { opacity: 0 }, 300).then(() => {
  hide($id(DOM_IDS.STATUS));
});

// Wait for element
await waitForElement('#dynamicElement');

// jQuery-like chaining (we could add this too)
// $id(DOM_IDS.TABS_CONTAINER)
//   .show()
//   .addClass('active')
//   .on('click', handler);