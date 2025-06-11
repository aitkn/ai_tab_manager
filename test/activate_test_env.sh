#!/bin/bash
# Activate test environment
echo "🐍 Activating Python 3.13 test environment..."
source venv/bin/activate

# Set Chrome debug address
export CHROME_DEBUG_ADDRESS="10.255.255.254:9222"
echo "🔧 Chrome Debug Address: $CHROME_DEBUG_ADDRESS"

echo "✅ Test environment activated!"
echo "Python version: $(python --version)"
echo "To run tests: ./run_test.sh"
