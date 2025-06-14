/*
 * AI Tab Manager - Copyright (c) 2025 AI Tech Knowledge LLC
 * Import/Export Module - handles CSV import and export functionality
 */

import { DOM_IDS, TAB_TYPES } from '../utils/constants.js';
import { $id } from '../utils/dom-helpers.js';
import { smartConfirm } from '../utils/helpers.js';
import { showStatus, switchToTab } from './ui-manager.js';
import { state } from './state-manager.js';
import { getUnifiedDatabase } from '../services/UnifiedDatabaseService.js';
import { showSavedTabsContent } from './saved-tabs-manager.js';
// Database is available as window.window.tabDatabase

/**
 * Export tabs to CSV file
 */
export async function exportToCSV() {
  try {
    showStatus('Exporting tabs to CSV...', 'loading');
    
    const csvContent = await window.tabDatabase.exportAsCSV();
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = `saved_tabs_${new Date().toISOString().split('T')[0]}.csv`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    
    URL.revokeObjectURL(url);
    
    showStatus('Tabs exported successfully', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showStatus('Failed to export tabs: ' + error.message, 'error');
  }
}

/**
 * Handle CSV import
 */
export async function handleCSVImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    showStatus('Reading CSV file...', 'loading');
    
    const csvContent = await readFileAsText(file);
    
    // Show import dialog to confirm
    const confirmed = await showImportDialog(csvContent);
    
    if (confirmed) {
      showStatus('Importing tabs...', 'loading');
      
      // Get current settings for categorization
      const importSettings = {
        apiKey: state.settings.apiKeys[state.settings.provider],
        provider: state.settings.provider,
        model: state.settings.model,
        customPrompt: state.settings.customPrompt,
        rules: state.settings.rules || [],
        useLLM: state.settings.useLLM !== false
      };
      
      const unifiedDB = await getUnifiedDatabase();
      const result = await unifiedDB.importFromCSV(csvContent, importSettings);
      
      // Build status message
      let statusMessage;
      const details = [];
      
      if (result.imported === 0 && result.duplicates > 0) {
        // All tabs were duplicates
        statusMessage = `No new tabs imported (all ${result.duplicates} were already saved)`;
      } else if (result.imported === 0) {
        // No valid tabs found
        statusMessage = 'No valid tabs found in CSV file';
      } else {
        // Normal import
        statusMessage = `Imported ${result.imported} tabs`;
        
        if (result.duplicates > 0) {
          details.push(`${result.duplicates} duplicates skipped`);
        }
        
        if (result.categorizedByRules > 0) {
          details.push(`${result.categorizedByRules} categorized by rules`);
        }
        
        if (result.categorized > 0) {
          details.push(`${result.categorized} categorized by AI`);
        }
        
        if (details.length > 0) {
          statusMessage += ` (${details.join(', ')})`;
        }
      }
      
      showStatus(statusMessage, result.imported > 0 ? 'success' : 'warning');
      
      // Store the import message to preserve it
      const importMessage = statusMessage;
      const importStatus = result.imported > 0 ? 'success' : 'warning';
      
      // Refresh saved tabs view if currently showing
      if (state.popupState.activeTab === TAB_TYPES.SAVED) {
        await showSavedTabsContent();
        // Restore the import status message after refresh
        showStatus(importMessage, importStatus);
      }
    }
  } catch (error) {
    console.error('Import error:', error);
    showStatus('Failed to import tabs: ' + error.message, 'error');
  }
  
  // Reset file input
  event.target.value = '';
}

/**
 * Read file as text
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Show import confirmation dialog
 */
async function showImportDialog(csvContent) {
  // Simple preview of the CSV
  const lines = csvContent.split('\n').filter(line => line.trim());
  const rowCount = lines.length - 1; // Minus header
  
  const message = `Import ${rowCount} rows from CSV?\n\n` +
    `Note: Tabs without categories will be:\n` +
    `1. First categorized using your configured rules\n` +
    `2. Then categorized using ${state.settings.useLLM ? state.settings.provider : 'rules only'} if needed`;
  
  return smartConfirm(message, { defaultAnswer: true });
}

/**
 * Initialize import/export functionality
 */
export function initializeImportExport() {
  // Set up export button
  const exportBtn = $id(DOM_IDS.EXPORT_CSV_BTN);
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToCSV);
  }
  
  // Set up import button
  const importBtn = $id(DOM_IDS.IMPORT_CSV_BTN);
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const fileInput = $id(DOM_IDS.CSV_FILE_INPUT);
      if (fileInput) {
        fileInput.click();
      }
    });
  }
  
  // Set up file input handler
  const fileInput = $id(DOM_IDS.CSV_FILE_INPUT);
  if (fileInput) {
    fileInput.addEventListener('change', handleCSVImport);
  }
}

// Export default object
export default {
  exportToCSV,
  handleCSVImport,
  initializeImportExport
};