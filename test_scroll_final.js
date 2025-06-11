// Final test for scroll position preservation 
// Run this in browser console when popup is open

console.log('🧪 FINAL SCROLL TEST');
console.log('==================');

function testScrollFlow() {
  console.log('📍 Testing complete scroll preservation flow...');
  
  // Step 1: Go to saved tab first
  console.log('1️⃣ Switching to Saved tab...');
  const savedBtn = document.querySelector('[data-tab="saved"]');
  savedBtn?.click();
  
  setTimeout(() => {
    // Step 2: Scroll down
    console.log('2️⃣ Scrolling down to 800px...');
    const savedContent = document.getElementById('savedContent');
    if (savedContent) {
      savedContent.scrollTop = 800;
      console.log(`📍 Current scroll: ${savedContent.scrollTop}px`);
    }
    
    setTimeout(() => {
      // Step 3: Switch to Current tab
      console.log('3️⃣ Switching to Current tab...');
      document.querySelector('[data-tab="categorize"]')?.click();
      
      setTimeout(() => {
        // Step 4: Switch back to Saved tab
        console.log('4️⃣ Switching back to Saved tab...');
        savedBtn?.click();
        
        setTimeout(() => {
          // Step 5: Check final position
          const finalPos = savedContent ? savedContent.scrollTop : 0;
          console.log(`5️⃣ Final scroll position: ${finalPos}px`);
          
          if (finalPos >= 750) {
            console.log('✅ SUCCESS: Single smooth scroll restoration!');
          } else {
            console.log('❌ FAILED: Scroll position lost');
          }
        }, 200);
      }, 500);
    }, 500);
  }, 500);
}

// Test the Settings → Saved flow too
function testSettingsFlow() {
  console.log('📍 Testing Settings → Saved flow...');
  
  // Step 1: Go to saved tab and scroll
  const savedBtn = document.querySelector('[data-tab="saved"]');
  savedBtn?.click();
  
  setTimeout(() => {
    const savedContent = document.getElementById('savedContent');
    if (savedContent) {
      savedContent.scrollTop = 600;
      console.log(`📍 Set scroll to: ${savedContent.scrollTop}px`);
    }
    
    setTimeout(() => {
      // Step 2: Go to Settings
      console.log('🔄 Switching to Settings...');
      document.querySelector('[data-tab="settings"]')?.click();
      
      setTimeout(() => {
        // Step 3: Return to Saved
        console.log('🔄 Back to Saved...');
        savedBtn?.click();
        
        setTimeout(() => {
          const finalPos = savedContent ? savedContent.scrollTop : 0;
          console.log(`📍 Settings→Saved final: ${finalPos}px`);
        }, 200);
      }, 500);
    }, 500);
  }, 500);
}

console.log('Running Current→Saved test...');
testScrollFlow();

// Run Settings test after 5 seconds
setTimeout(() => {
  console.log('\nRunning Settings→Saved test...');
  testSettingsFlow();
}, 5000);