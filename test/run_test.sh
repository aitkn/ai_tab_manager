#!/bin/bash

# Current Tab Basic Test Runner (Python 3.13 + venv)
# Runs the basic functionality test for Current Tab using Selenium

echo "🚀 Current Tab Basic Test Runner (Python 3.13 + venv)"
echo "==================================================="

# Check if we're in the right directory (test folder should be in extension directory)
if [ ! -f "../manifest.json" ]; then
    echo "❌ Error: Not in extension test directory (../manifest.json not found)"
    echo "Please run this script from the test/ folder within the extension directory"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Please run setup first: ./setup_test_env.sh"
    exit 1
fi

echo "🐍 Activating Python 3.13 virtual environment..."
source venv/bin/activate

if [ $? -ne 0 ]; then
    echo "❌ Failed to activate virtual environment"
    echo "Please run setup: ./setup_test_env.sh"
    exit 1
fi

echo "✅ Virtual environment activated"
echo "Python version: $(python --version)"

echo "🔧 Running Current Tab test..."
python test_simple.py

# Show results
echo ""
echo "📊 Test Results:"
echo "==============="

# Find the most recent test result file
RESULT_FILE=$(ls -t test_results_*.txt 2>/dev/null | head -n1)

if [ -f "$RESULT_FILE" ]; then
    echo "📄 Report file: $RESULT_FILE"
    echo ""
    
    # Extract the overall result
    OVERALL_RESULT=$(grep "Overall Result:" "$RESULT_FILE" | cut -d' ' -f3)
    
    if [ "$OVERALL_RESULT" = "PASSED" ]; then
        echo "✅ Test Name: Current Tab Basic Functionality - PASSED"
    else
        echo "❌ Test Name: Current Tab Basic Functionality - FAILED"
        echo ""
        echo "Failed steps:"
        grep "FAILED:" "$RESULT_FILE" | head -5
    fi
    
    echo ""
    echo "📋 Full report available in: $RESULT_FILE"
else
    echo "⚠️  No test result file found"
fi

echo ""
echo "🎯 Test completed!"