#!/bin/bash

# Test Environment Setup Script
# Creates Python 3.13 virtual environment and installs dependencies

echo "🐍 Setting up Python 3.13 Test Environment"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "../manifest.json" ]; then
    echo "❌ Error: Not in extension test directory (../manifest.json not found)"
    echo "Please run this script from the test/ folder within the extension directory"
    exit 1
fi

# Check if Python 3.13 is available
if ! command -v python3.13 &> /dev/null; then
    echo "❌ Error: python3.13 not found. Please install Python 3.13"
    echo "You can install it with:"
    echo "  sudo apt update"
    echo "  sudo apt install python3.13 python3.13-venv python3.13-dev"
    exit 1
fi

echo "✅ Found Python 3.13: $(python3.13 --version)"

# Create virtual environment
echo "📦 Creating virtual environment..."
if [ -d "venv" ]; then
    echo "⚠️  Virtual environment already exists. Removing old one..."
    rm -rf venv
fi

python3.13 -m venv venv

if [ $? -ne 0 ]; then
    echo "❌ Failed to create virtual environment"
    exit 1
fi

echo "✅ Virtual environment created"

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📦 Installing test dependencies..."
pip install selenium webdriver-manager

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create activation script
echo "📝 Creating activation script..."
cat > activate_test_env.sh << 'EOF'
#!/bin/bash
# Activate test environment
echo "🐍 Activating Python 3.13 test environment..."
source venv/bin/activate
echo "✅ Test environment activated!"
echo "Python version: $(python --version)"
echo "To run tests: ./run_test.sh"
EOF

chmod +x activate_test_env.sh

echo ""
echo "🎯 Setup Complete!"
echo "=================="
echo "✅ Python 3.13 virtual environment created in 'venv/'"
echo "✅ Selenium and webdriver-manager installed"
echo "✅ Activation script created: 'activate_test_env.sh'"
echo ""
echo "📋 To use the test environment:"
echo "1. Activate: source activate_test_env.sh"
echo "2. Run test: ./run_test.sh"
echo ""
echo "📋 Or run in one command:"
echo "source venv/bin/activate && python test_simple.py"