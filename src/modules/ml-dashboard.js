/*
 * AI Tab Manager - ML Dashboard
 * Handles Machine Learning dashboard UI and controls
 */

import { $id } from '../utils/dom-helpers.js';
import { state, updateState } from './state-manager.js';
import { smartConfirm } from '../utils/helpers.js';
import { showStatus } from './ui-manager.js';
import { getBackendInfo, switchBackend } from '../ml/tensorflow-loader.js';
import StorageService from '../services/StorageService.js';

/**
 * Initialize ML Dashboard
 */
export async function initializeMLDashboard() {
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
  
  // Always load ML status (it will show appropriate state)
  await updateMLStatus();
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
  
  // Update status regardless of enabled state
  await updateMLStatus();
}

/**
 * Update ML status display
 */
async function updateMLStatus() {
  try {
    const statusContent = $id('mlStatusContent');
    if (!statusContent) {
      return;
    }
    
    // Clear ALL existing content immediately (including any loading message)
    statusContent.innerHTML = '';
    
    // Check if ML is disabled
    if (state.settings.useML === false) {
      statusContent.innerHTML = `
        <div style="color: var(--md-sys-color-on-surface-variant);">
          <div style="margin-bottom: 4px;">ML features disabled</div>
          <div style="font-size: 11px;">Enable ML categorization to see status and metrics.</div>
        </div>
      `;
      return;
    }
    
    // Get ML status
    let mlCategorizer, status;
    try {
      const { getMLCategorizer } = await import('../ml/categorization/ml-categorizer.js');
      mlCategorizer = await getMLCategorizer();
      status = await mlCategorizer.getStatus();
    } catch (mlError) {
      // Show a more user-friendly message if ML modules are not available
      const isCSPError = mlError.message && mlError.message.includes('unsafe-eval');
      statusContent.innerHTML = `
        <div style="color: var(--md-sys-color-on-surface-variant);">
          <div style="margin-bottom: 4px;">ML features not available</div>
          <div style="font-size: 11px;">
            ${isCSPError 
              ? 'TensorFlow.js CSP-compliant modules failed to load. ML features are disabled.' 
              : 'Machine learning capabilities are being loaded. If this persists, ML features may not be available.'
            }
          </div>
        </div>
      `;
      return;
    }
    
    // Get backend information
    const backendInfo = getBackendInfo();
    
    statusContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span>Backend:</span>
        <span style="font-weight: 500; color: ${backendInfo.isGPU ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)'}">
          ${backendInfo.isGPU ? '🚀 GPU (WebGL)' : '💻 CPU'} ${backendInfo.backend ? `(${backendInfo.backend})` : ''}
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span>Available:</span>
        <span style="font-weight: 500; color: var(--md-sys-color-on-surface-variant); font-size: 11px;">
          ${backendInfo.available.join(', ') || 'None'}
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span>Model exists:</span>
        <span style="font-weight: 500; color: ${status.modelExists ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)'}">
          ${status.modelExists ? 'Yes' : 'No'}
        </span>
      </div>
      ${status.modelExists && status.modelAccuracy ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Model accuracy:</span>
          <span style="font-weight: 500; color: var(--md-sys-color-primary)">
            ${Math.round(status.modelAccuracy * 100)}%
          </span>
        </div>
      ` : ''}
      ${backendInfo.memory ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>GPU Memory:</span>
          <span style="font-weight: 500; color: var(--md-sys-color-on-surface-variant); font-size: 11px;">
            ${Math.round(backendInfo.memory.numBytes / 1024 / 1024)}MB
          </span>
        </div>
      ` : ''}
      ${!status.modelExists ? `
        <div style="margin-top: 8px; color: var(--md-sys-color-on-surface-variant);">
          The model will be created after you categorize more tabs.
        </div>
      ` : ''}
      ${backendInfo.available.length > 1 ? `
        <div style="margin-top: 8px;">
          <button id="switchBackendBtn" style="font-size: 11px; padding: 4px 8px;">
            Switch to ${backendInfo.isGPU ? 'CPU' : 'GPU'}
          </button>
        </div>
      ` : ''}
    `;
    
    // Add event listeners for GPU controls if they exist
    setTimeout(() => {
      const switchBackendBtn = $id('switchBackendBtn');
      
      if (switchBackendBtn) {
        switchBackendBtn.addEventListener('click', handleSwitchBackend);
      }
    }, 100); // Small delay to ensure DOM is updated
    
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
    
    // Update training button text based on model existence
    const trainBtn = $id('trainModelBtn');
    if (trainBtn) {
      if (status.modelExists) {
        trainBtn.textContent = 'Continue Training';
        trainBtn.title = 'Continue training the existing model with additional epochs';
      } else {
        trainBtn.textContent = 'Train New Model';
        trainBtn.title = 'Create and train a new model from scratch';
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
    // Get epochs from settings
    const epochs = state.settings.mlEpochs || 10;
    
    // Get model trainer
    const { ModelTrainer } = await import('../ml/training/trainer.js');
    const trainer = new ModelTrainer();
    await trainer.initialize();
    
    // Prepare training data directly from saved tabs
    statusSpan.textContent = 'Loading training data from saved tabs...';
    const trainingData = await trainer.prepareTrainingData();
    
    if (trainingData.length < 20) {
      // Get saved tabs count for better error message
      const savedTabs = await window.tabDatabase.getAllSavedTabs();
      const categorizedSavedTabs = savedTabs.filter(tab => tab.category && tab.category > 0);
      
      // If we have saved tabs but no training data, sync them
      if (categorizedSavedTabs.length >= 20 && trainingData.length === 0) {
        statusSpan.textContent = 'Syncing existing saved tabs to ML database...';
        try {
          const { getUnifiedDatabase } = await import('../services/UnifiedDatabaseService.js');
          const unifiedDB = await getUnifiedDatabase();
          await unifiedDB.syncExistingSavedTabs();
          
          // Try training again after sync
          statusSpan.textContent = 'Retrying training after sync...';
          const newTrainingData = await trainer.prepareTrainingData();
          if (newTrainingData.length >= 20) {
            // Continue with training using the newly synced data
            statusSpan.textContent = 'Training model...';
            const result = await trainer.trainWithData(newTrainingData, {
              epochs: epochs,
              onProgress: (progress) => {
                statusSpan.textContent = `Training: ${Math.round(progress.progress * 100)}% (${epochs} epochs)`;
              }
            });
            
            statusSpan.textContent = `Training complete! Accuracy: ${Math.round(result.accuracy * 100)}%`;
            showStatus('Model trained successfully after data sync', 'success');
            await updateMLStatus();
            return;
          }
        } catch (syncError) {
          console.error('Error syncing existing saved tabs:', syncError);
        }
      }
      
      statusSpan.textContent = `Need more data (${categorizedSavedTabs.length}/20 categorized saved tabs)`;
      showStatus(`Need at least 20 categorized saved tabs to train the model. You have ${categorizedSavedTabs.length}.`, 'error');
      return;
    }
    
    // Check if model already exists for incremental training
    const { getMLCategorizer } = await import('../ml/categorization/ml-categorizer.js');
    const mlCategorizer = await getMLCategorizer(true);
    const mlStatus = await mlCategorizer.getStatus();
    
    let result;
    if (mlStatus.modelExists) {
      // Use incremental training to continue from existing model
      statusSpan.textContent = `Continuing training (${epochs} additional epochs)...`;
      
      result = await trainer.incrementalTrain(trainingData, {
        epochs: epochs,
        onProgress: (progress) => {
          statusSpan.textContent = `Continue Training: Epoch ${progress.epoch}/${progress.totalEpochs} (${Math.round(progress.progress * 100)}%)`;
        }
      });
      
      // Show that this was incremental training
      if (result && result.success) {
        statusSpan.textContent = `Incremental training complete! Accuracy: ${Math.round(result.accuracy * 100)}%`;
        showStatus('Model updated with incremental training', 'success');
      }
    } else {
      // Train new model from scratch
      statusSpan.textContent = `Training new model (${epochs} epochs)...`;
      
      result = await trainer.trainWithData(trainingData, {
        epochs: epochs,
        onProgress: (progress) => {
          statusSpan.textContent = `Initial Training: ${Math.round(progress.progress * 100)}% (${epochs} epochs)`;
        }
      });
      
      // Show that this was initial training
      if (result && result.success) {
        statusSpan.textContent = `Initial training complete! Accuracy: ${Math.round(result.accuracy * 100)}%`;
        showStatus('New model trained successfully', 'success');
      }
    }
    
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
  if (!smartConfirm('Are you sure you want to reset the ML model? This will delete all training data and learned patterns.', { defaultAnswer: false })) {
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

/**
 * Handle backend switching
 */
async function handleSwitchBackend() {
  const switchBtn = $id('switchBackendBtn');
  const statusContent = $id('mlStatusContent');
  
  if (!switchBtn || !statusContent) return;
  
  // Get current backend info
  const backendInfo = getBackendInfo();
  const targetBackend = backendInfo.isGPU ? 'cpu' : 'webgl';
  
  // Disable button during switch
  switchBtn.disabled = true;
  switchBtn.textContent = 'Switching...';
  
  try {
    const success = await switchBackend(targetBackend);
    
    if (success) {
      showStatus(`Switched to ${targetBackend === 'webgl' ? 'GPU' : 'CPU'} backend`, 'success');
      // Update status to reflect new backend
      await updateMLStatus();
    } else {
      showStatus(`Failed to switch to ${targetBackend} backend`, 'error');
    }
    
  } catch (error) {
    console.error('Error switching backend:', error);
    showStatus('Error switching backend', 'error');
  } finally {
    // Re-enable button
    switchBtn.disabled = false;
    // Button text will be updated by updateMLStatus
  }
}


// Export functions
export default {
  initializeMLDashboard,
  updateMLStatus
};