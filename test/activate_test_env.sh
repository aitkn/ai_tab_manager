#!/bin/bash
# Activate test environment
echo "🐍 Activating Python 3.13 test environment..."
source venv/bin/activate
echo "✅ Test environment activated!"
echo "Python version: $(python --version)"
echo "To run tests: ./run_test.sh"
