/*
 * Simple ML Test - Check what works and what doesn't
 */

console.log('=== ML FUNCTIONALITY TEST ===');

// Test 1: Can we load ML_CONFIG?
async function testMLConfig() {
  try {
    const { ML_CONFIG } = await import('./src/ml/model-config.js');
    console.log('✅ ML_CONFIG loaded');
    console.log('   - Model classes:', ML_CONFIG.model.output.numClasses);
    console.log('   - Training epochs:', ML_CONFIG.training.epochs);
    console.log('   - Background training:', ML_CONFIG.backgroundTraining.enabled);
    return true;
  } catch (error) {
    console.log('❌ ML_CONFIG failed:', error.message);
    return false;
  }
}

// Test 2: Can we load TensorFlow loader?
async function testTensorFlowLoader() {
  try {
    const { loadTensorFlow, getTensorFlow } = await import('./src/ml/tensorflow-loader.js');
    console.log('✅ TensorFlow loader imported');
    
    // Note: Can't actually load TensorFlow in Node.js, but we can check the function exists
    console.log('   - loadTensorFlow function:', typeof loadTensorFlow);
    console.log('   - getTensorFlow function:', typeof getTensorFlow);
    return true;
  } catch (error) {
    console.log('❌ TensorFlow loader failed:', error.message);
    return false;
  }
}

// Test 3: Can we load ML database?
async function testMLDatabase() {
  try {
    const mlDB = await import('./src/ml/storage/ml-database.js');
    console.log('✅ ML Database imported');
    console.log('   - Available functions:', Object.keys(mlDB).join(', '));
    return true;
  } catch (error) {
    console.log('❌ ML Database failed:', error.message);
    return false;
  }
}

// Test 4: Can we load the ML categorizer?
async function testMLCategorizer() {
  try {
    const { MLCategorizer } = await import('./src/ml/categorization/ml-categorizer.js');
    console.log('✅ ML Categorizer imported');
    console.log('   - Constructor available:', typeof MLCategorizer);
    
    // Try to create instance (but don't initialize, as that needs browser environment)
    const categorizer = new MLCategorizer();
    console.log('   - Instance created:', !!categorizer);
    return true;
  } catch (error) {
    console.log('❌ ML Categorizer failed:', error.message);
    console.log('   - Error stack:', error.stack);
    return false;
  }
}

// Test 5: Can we load other ML components?
async function testOtherMLComponents() {
  const components = [
    './src/ml/models/tab-classifier.js',
    './src/ml/voting/ensemble-voter.js',
    './src/ml/trust/performance-tracker.js',
    './src/ml/learning/feedback-processor.js'
  ];
  
  let passed = 0;
  
  for (const component of components) {
    try {
      const imported = await import(component);
      console.log(`✅ ${component.split('/').pop()}: ${Object.keys(imported).join(', ')}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${component.split('/').pop()}: ${error.message}`);
    }
  }
  
  console.log(`   - Components loaded: ${passed}/${components.length}`);
  return passed === components.length;
}

// Run all tests
async function runAllTests() {
  console.log('Starting ML component tests...\n');
  
  const results = {
    config: await testMLConfig(),
    tfLoader: await testTensorFlowLoader(),
    database: await testMLDatabase(),
    categorizer: await testMLCategorizer(),
    components: await testOtherMLComponents()
  };
  
  console.log('\n=== TEST RESULTS ===');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
  });
  
  const totalPassed = Object.values(results).filter(Boolean).length;
  console.log(`\nOVERALL: ${totalPassed}/${Object.keys(results).length} tests passed`);
  
  if (totalPassed === Object.keys(results).length) {
    console.log('🎉 All ML components can be loaded!');
  } else {
    console.log('⚠️  Some ML components have issues');
  }
}

runAllTests().catch(console.error);