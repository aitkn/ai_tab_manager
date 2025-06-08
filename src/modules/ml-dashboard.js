/*
 * AI Tab Manager - ML Dashboard
 * Handles Machine Learning dashboard UI and controls
 */

import { $id } from '../utils/dom-helpers.js';
import { state, updateState } from './state-manager.js';
import { showStatus } from './ui-manager.js';
import StorageService from '../services/StorageService.js';

/**
 * Initialize ML Dashboard
 */
export async function initializeMLDashboard() {
  console.log('Initializing ML dashboard');
  
  // Set up ML checkbox
  const useMLCheckbox = $id('useMLCheckbox');
  if (useMLCheckbox) {
    useMLCheckbox.checked = state.settings.useML !== false; // Default to true
    
    // Show/hide ML dashboard based on checkbox state
    const mlDashboard = $id('mlDashboard');
    if (mlDashboard) {
      mlDashboard.style.display = useMLCheckbox.checked ? 'block' : 'none';
    }
    
    // Add change listener
    useMLCheckbox.addEventListener('change', handleMLToggle);
  }
  
  // Set up training controls
  const trainModelBtn = $id('trainModelBtn');
  if (trainModelBtn) {
    trainModelBtn.addEventListener('click', handleTrainModel);
  }
  
  const resetModelBtn = $id('resetModelBtn');
  if (resetModelBtn) {
    resetModelBtn.addEventListener('click', handleResetModel);
  }
  
  // Load ML status if enabled
  if (state.settings.useML !== false) {
    await updateMLStatus();
  }
}

/**
 * Handle ML toggle
 */
async function handleMLToggle(event) {
  const enabled = event.target.checked;
  
  // Update settings
  state.settings.useML = enabled;
  updateState('settings', state.settings);
  await StorageService.saveSettings(state.settings);
  
  // Show/hide dashboard
  const mlDashboard = $id('mlDashboard');
  if (mlDashboard) {
    mlDashboard.style.display = enabled ? 'block' : 'none';
  }
  
  // Update status if enabled
  if (enabled) {
    await updateMLStatus();
  }
}

/**
 * Update ML status display
 */
async function updateMLStatus() {
  try {
    console.log('Updating ML status...');
    
    const statusContent = $id('mlStatusContent');
    if (!statusContent) {
      console.error('mlStatusContent element not found');
      return;
    }
    
    // Clear the loading message first
    statusContent.innerHTML = '<div style="color: var(--md-sys-color-on-surface-variant);">Checking ML status...</div>';
    
    // Get ML status
    let mlCategorizer, status;
    try {
      const { getMLCategorizer } = await import('../ml/categorization/ml-categorizer.js');
      mlCategorizer = await getMLCategorizer();
      status = await mlCategorizer.getStatus();
    } catch (mlError) {
      console.error('Error loading ML module:', mlError);
      // Show a more user-friendly message if ML modules are not available
      statusContent.innerHTML = `
        <div style="color: var(--md-sys-color-on-surface-variant);">
          <div style="margin-bottom: 4px;">ML module not available</div>
          <div style="font-size: 11px;">Machine learning features require additional setup.</div>
        </div>
      `;
      return;
    }
    
    statusContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span>TensorFlow.js:</span>
        <span style="font-weight: 500; color: var(--md-sys-color-primary)">
          Bundled (v4.17.0)
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span>Model exists:</span>
        <span style="font-weight: 500; color: ${status.modelExists ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)'}">
          ${status.modelExists ? 'Yes' : 'No'}
        </span>
      </div>
      ${status.modelExists && status.modelAccuracy ? `
        <div style="display: flex; justify-content: space-between;">
          <span>Model accuracy:</span>
          <span style="font-weight: 500; color: var(--md-sys-color-primary)">
            ${Math.round(status.modelAccuracy * 100)}%
          </span>
        </div>
      ` : ''}
      ${!status.modelExists ? `
        <div style="margin-top: 8px; color: var(--md-sys-color-on-surface-variant);">
          The model will be created after you categorize more tabs.
        </div>
      ` : ''}
    `;
    
    // Update trust weights
    const trustContent = $id('mlTrustContent');
    if (trustContent && status.trustWeights) {
      const weights = status.trustWeights;
      trustContent.innerHTML = `
        <div class="trust-weight-item" style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Rules:</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 100px; height: 8px; background: var(--md-sys-color-surface-container-highest); border-radius: 4px; overflow: hidden;">
              <div style="width: ${weights.rules * 100}%; height: 100%; background: var(--md-sys-color-primary);"></div>
            </div>
            <span style="font-weight: 500; min-width: 40px; text-align: right;">${Math.round(weights.rules * 100)}%</span>
          </div>
        </div>
        <div class="trust-weight-item" style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Model:</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 100px; height: 8px; background: var(--md-sys-color-surface-container-highest); border-radius: 4px; overflow: hidden;">
              <div style="width: ${weights.model * 100}%; height: 100%; background: var(--md-sys-color-secondary);"></div>
            </div>
            <span style="font-weight: 500; min-width: 40px; text-align: right;">${Math.round(weights.model * 100)}%</span>
          </div>
        </div>
        <div class="trust-weight-item" style="display: flex; justify-content: space-between;">
          <span>LLM:</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 100px; height: 8px; background: var(--md-sys-color-surface-container-highest); border-radius: 4px; overflow: hidden;">
              <div style="width: ${weights.llm * 100}%; height: 100%; background: var(--md-sys-color-tertiary);"></div>
            </div>
            <span style="font-weight: 500; min-width: 40px; text-align: right;">${Math.round(weights.llm * 100)}%</span>
          </div>
        </div>
      `;
    }
    
    // Update performance metrics
    const performanceContent = $id('mlPerformanceContent');
    if (performanceContent) {
      // Get performance tracker
      const { getPerformanceTracker } = await import('../ml/trust/performance-tracker.js');
      const tracker = getPerformanceTracker();
      const metrics = await tracker.getMetrics();
      
      if (metrics.rules || metrics.model || metrics.llm) {
        let html = '';
        
        ['rules', 'model', 'llm'].forEach(method => {
          const data = metrics[method];
          if (data && data.total > 0) {
            const accuracy = (data.correct / data.total * 100).toFixed(1);
            html += `
              <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                  <span style="text-transform: capitalize;">${method}:</span>
                  <span style="font-weight: 500;">${accuracy}% accurate</span>
                </div>
                <div style="font-size: 11px; color: var(--md-sys-color-on-surface-variant);">
                  ${data.correct}/${data.total} correct predictions
                </div>
              </div>
            `;
          }
        });
        
        performanceContent.innerHTML = html || '<div>No performance data yet</div>';
      } else {
        performanceContent.innerHTML = '<div>No performance data yet</div>';
      }
    }
    
    // Update feedback stats if available
    if (status.feedbackStats) {
      const insights = status.feedbackStats.correctionPatterns;
      if (insights && insights.length > 0) {
        // Could add a section to show common correction patterns
      }
    }
    
  } catch (error) {
    console.error('Error updating ML status:', error);
    
    // Show error state
    const statusContent = $id('mlStatusContent');
    if (statusContent) {
      statusContent.innerHTML = `
        <div style="color: var(--md-sys-color-on-surface-variant);">
          <div>ML features unavailable</div>
          <div style="font-size: 11px; margin-top: 4px;">${error.message || 'Check console for details'}</div>
        </div>
      `;
    }
  }
}

/**
 * Handle TensorFlow.js download
 */
async function handleDownloadTensorFlow() {
  const downloadBtn = $id('downloadTensorFlowBtn');
  const progressDiv = $id('downloadProgress');
  
  if (!downloadBtn || !progressDiv) return;
  
  // Show progress
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Downloading...';
  progressDiv.style.display = 'block';
  progressDiv.innerHTML = '<span class="text-muted" style="font-size: 11px;">Downloading TensorFlow.js...</span>';
  
  try {
    const { downloadTensorFlow } = await import('../ml/tensorflow-downloader.js');
    await downloadTensorFlow();
    
    progressDiv.innerHTML = '<span style="color: var(--md-sys-color-primary); font-size: 11px;">Download complete!</span>';
    showStatus('TensorFlow.js downloaded successfully', 'success');
    
    // Reload ML status after download
    setTimeout(() => {
      updateMLStatus();
    }, 1000);
    
  } catch (error) {
    console.error('Error downloading TensorFlow.js:', error);
    progressDiv.innerHTML = '<span style="color: var(--md-sys-color-error); font-size: 11px;">Download failed</span>';
    showStatus('Failed to download TensorFlow.js', 'error');
    
    // Re-enable button
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Download ML Library (~3MB)';
  }
}

/**
 * Handle train model button
 */
async function handleTrainModel() {
  const trainBtn = $id('trainModelBtn');
  const statusSpan = $id('trainingStatus');
  
  if (!trainBtn || !statusSpan) return;
  
  // Disable button and show status
  trainBtn.disabled = true;
  trainBtn.textContent = 'Training...';
  statusSpan.textContent = 'Starting training...';
  
  try {
    // Get model trainer
    const { getModelTrainer } = await import('../ml/training/trainer.js');
    const trainer = await getModelTrainer();
    
    // Check if we have enough data
    const trainingData = await trainer.prepareTrainingData();
    if (trainingData.length < 20) {
      statusSpan.textContent = `Need more data (${trainingData.length}/20 examples)`;
      showStatus('Need at least 20 categorized tabs to train the model', 'error');
      return;
    }
    
    // Train model
    statusSpan.textContent = 'Training model...';
    const result = await trainer.trainModel({
      onProgress: (progress) => {
        statusSpan.textContent = `Training: ${Math.round(progress.progress * 100)}%`;
      }
    });
    
    // Show success
    statusSpan.textContent = `Training complete! Accuracy: ${Math.round(result.accuracy * 100)}%`;
    showStatus('Model trained successfully', 'success');
    
    // Update dashboard
    await updateMLStatus();
    
  } catch (error) {
    console.error('Error training model:', error);
    statusSpan.textContent = 'Training failed';
    showStatus('Error training model', 'error');
  } finally {
    // Re-enable button
    trainBtn.disabled = false;
    trainBtn.textContent = 'Train Now';
    
    // Clear status after delay
    setTimeout(() => {
      statusSpan.textContent = '';
    }, 5000);
  }
}

/**
 * Handle reset model button
 */
async function handleResetModel() {
  if (!confirm('Are you sure you want to reset the ML model? This will delete all training data and learned patterns.')) {
    return;
  }
  
  const resetBtn = $id('resetModelBtn');
  const statusSpan = $id('trainingStatus');
  
  if (!resetBtn || !statusSpan) return;
  
  // Disable button
  resetBtn.disabled = true;
  statusSpan.textContent = 'Resetting model...';
  
  try {
    // Get ML database
    const { clearAllMLData } = await import('../ml/storage/ml-database.js');
    await clearAllMLData();
    
    // Reset trust weights
    const { getTrustManager } = await import('../ml/trust/trust-manager.js');
    const trustManager = getTrustManager();
    await trustManager.resetTrust();
    
    // Show success
    statusSpan.textContent = 'Model reset complete';
    showStatus('ML model has been reset', 'success');
    
    // Update dashboard
    await updateMLStatus();
    
  } catch (error) {
    console.error('Error resetting model:', error);
    statusSpan.textContent = 'Reset failed';
    showStatus('Error resetting model', 'error');
  } finally {
    // Re-enable button
    resetBtn.disabled = false;
    
    // Clear status after delay
    setTimeout(() => {
      statusSpan.textContent = '';
    }, 3000);
  }
}

// Export functions
export default {
  initializeMLDashboard,
  updateMLStatus
};