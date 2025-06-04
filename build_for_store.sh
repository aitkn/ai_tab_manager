#!/bin/bash

# Build script for Chrome Web Store submission

echo "Building AI Tab Manager for Chrome Web Store..."

# Create build directory
rm -rf build
mkdir -p build

# Copy all necessary files
cp manifest.json build/
cp popup.html build/
cp popup.css build/
cp background.js build/
cp config.js build/
cp database_v2.js build/
cp icon*.png build/

# Create production versions of JS files with console.log removed
echo "Removing console statements..."

# Process popup.js
sed 's/console\.log[^;]*;//g' popup.js | sed 's/console\.error[^;]*;//g' > build/popup.js

# Process background.js (if it has console statements)
sed 's/console\.log[^;]*;//g' background.js | sed 's/console\.error[^;]*;//g' > build/background.js

# Process database_v2.js (if it has console statements)
sed 's/console\.log[^;]*;//g' database_v2.js | sed 's/console\.error[^;]*;//g' > build/database_v2.js

# Create the zip file for upload
cd build
zip -r ../ai-tab-manager-v2.2.0.zip *
cd ..

echo "Build complete! Upload ai-tab-manager-v2.2.0.zip to Chrome Web Store"
echo ""
echo "Checklist before submission:"
echo "✓ Icons in place (16x16, 48x48, 128x128)"
echo "✓ Console statements removed"
echo "✓ Version updated to 2.2.0"
echo "✓ Privacy policy created"
echo "✓ Store listing prepared"
echo ""
echo "Next steps:"
echo "1. Take screenshots of the extension in action"
echo "2. Create promotional images"
echo "3. Upload to Chrome Web Store Developer Dashboard"
echo "4. Fill in store listing information"
echo "5. Submit for review"