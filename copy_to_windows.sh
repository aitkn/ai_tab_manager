#!/bin/bash

# Copy extension to Windows directory for Chrome loading
# This avoids WSL file permission issues

echo "📁 Copying extension to Windows directory..."
echo "========================================="

# Create Windows temp directory for extension
WINDOWS_DIR="/mnt/c/temp/chrome_tabs_extension"

# Remove old directory if exists
if [ -d "$WINDOWS_DIR" ]; then
    echo "🗑️  Removing old Windows copy..."
    rm -rf "$WINDOWS_DIR"
fi

# Create directory
echo "📂 Creating Windows directory..."
mkdir -p "$WINDOWS_DIR"

# Copy all extension files
echo "📋 Copying extension files..."
cp -r * "$WINDOWS_DIR/"

# Remove unnecessary files
echo "🧹 Cleaning up unnecessary files..."
cd "$WINDOWS_DIR"
rm -rf test/
rm -rf node_modules/
rm -rf .git/
rm -rf venv/
rm -f *.sh
rm -f .gitignore
rm -f sync.sh
rm -f watch-sync.sh

echo ""
echo "✅ Extension copied successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Open Chrome on Windows"
echo "2. Go to chrome://extensions/"
echo "3. Enable Developer mode"
echo "4. Click 'Load unpacked'"
echo "5. Navigate to: C:\\temp\\chrome_tabs_extension"
echo "6. Select the folder"
echo ""
echo "📁 Windows path: C:\\temp\\chrome_tabs_extension"
echo "🔧 Then run: ./run_modular_tests.sh wsl"