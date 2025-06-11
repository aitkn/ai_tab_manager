// Test script for scroll position preservation fix
// Run this in the browser console when the popup is open

console.log('🧪 SCROLL POSITION TEST SCRIPT');
console.log('===============================');

function testScrollPreservation() {
  console.log('🔍 Testing scroll position preservation...');
  
  // Step 1: Switch to saved tab
  console.log('📍 Step 1: Switching to Saved tab...');
  const savedBtn = document.querySelector('[data-tab="saved"]');
  if (!savedBtn) {
    console.error('❌ Saved tab button not found');
    return;
  }
  savedBtn.click();
  
  setTimeout(() => {
    // Step 2: Scroll down in saved content
    console.log('📍 Step 2: Scrolling down in saved content...');
    const savedContent = document.getElementById('savedContent');
    if (savedContent) {
      savedContent.scrollTop = 200; // Scroll down 200px
      console.log(`📍 Set scroll position to: ${savedContent.scrollTop}px`);
    }
    
    setTimeout(() => {
      // Step 3: Switch to Current tab
      console.log('📍 Step 3: Switching to Current tab...');
      const currentBtn = document.querySelector('[data-tab="categorize"]');
      if (currentBtn) {
        currentBtn.click();
      }
      
      setTimeout(() => {
        // Step 4: Switch back to Saved tab
        console.log('📍 Step 4: Switching back to Saved tab...');
        savedBtn.click();
        
        setTimeout(() => {
          // Step 5: Check if scroll position was preserved
          console.log('📍 Step 5: Checking scroll position...');
          const finalScrollPos = savedContent ? savedContent.scrollTop : 0;
          console.log(`📍 Final scroll position: ${finalScrollPos}px`);
          
          if (finalScrollPos >= 190) { // Allow for small variations
            console.log('✅ SUCCESS: Scroll position preserved!');
          } else {
            console.log('❌ FAILED: Scroll position was reset');
          }
        }, 500);
      }, 500);
    }, 500);
  }, 500);
}

// Run the test
testScrollPreservation();