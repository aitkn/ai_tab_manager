#!/bin/bash

# Modular Test Runner for Chrome Extension
# Allows running individual test modules or all tests

echo "🧪 Chrome Extension Modular Test Runner"
echo "======================================"

# Check if we're in the right directory
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
echo ""

# Function to run a specific test
run_test() {
    local test_name=$1
    local test_file=$2
    
    echo "🔄 Running $test_name..."
    echo "=========================="
    
    python "$test_file"
    local exit_code=$?
    
    echo ""
    if [ $exit_code -eq 0 ]; then
        echo "✅ $test_name - PASSED"
    else
        echo "❌ $test_name - FAILED"
    fi
    echo ""
    
    return $exit_code
}

# Function to display available tests
show_tests() {
    echo "📋 Available Test Modules:"
    echo "========================="
    echo "1. search      - Search functionality tests"
    echo "2. groupby     - GROUP BY functionality tests"
    echo "3. tdd-issues  - TDD test for GROUP BY + search issues"
    echo "4. all         - Run complete test suite (original)"
    echo "5. manual      - Open browser for manual testing (avoids blocking)"
    echo "6. wsl         - WSL-safe headless testing (no Windows display issues)"
    echo "7. known       - Test known Windows extension (fnklipkenfpdakdficiofcdejbiajgeh)"
    echo "8. auto        - Automated testing with Windows Chrome extension"
    echo "9. mcp         - MCP-based automated testing (recommended)"
    echo "10. help       - Show this help message"
    echo ""
    echo "Usage examples:"
    echo "  ./run_modular_tests.sh search"
    echo "  ./run_modular_tests.sh groupby"
    echo "  ./run_modular_tests.sh tdd-issues"
    echo "  ./run_modular_tests.sh all"
    echo "  ./run_modular_tests.sh manual"
    echo "  ./run_modular_tests.sh wsl"
    echo "  ./run_modular_tests.sh known"
    echo "  ./run_modular_tests.sh auto"
    echo "  ./run_modular_tests.sh mcp"
    echo ""
}

# Main logic
case "${1:-help}" in
    "search")
        echo "🔍 Running Search Functionality Tests Only"
        echo "=========================================="
        run_test "Search Tests" "test_search.py"
        exit $?
        ;;
    
    "groupby")
        echo "📂 Running GROUP BY Functionality Tests Only"
        echo "==========================================="
        run_test "GROUP BY Tests" "test_groupby.py"
        exit $?
        ;;
    
    "tdd-issues")
        echo "🔍 Running TDD Test for GROUP BY + Search Issues"
        echo "==============================================="
        run_test "GROUP BY + Search Issues TDD" "test_groupby_search_issues.py"
        exit $?
        ;;
    
    "all")
        echo "🎯 Running Complete Test Suite"
        echo "=============================="
        run_test "Complete Tests" "test_simple.py"
        exit $?
        ;;
    
    "manual")
        echo "🔧 Opening Browser for Manual Testing"
        echo "====================================="
        python manual_test_helper.py
        exit $?
        ;;
    
    "wsl")
        echo "🐧 Running WSL-Safe Headless Testing"
        echo "===================================="
        python test_wsl_safe.py
        exit $?
        ;;
    
    "known")
        echo "🔧 Testing Known Windows Extension"
        echo "=================================="
        python test_known_extension.py
        exit $?
        ;;
    
    "auto")
        echo "🤖 Running Automated Windows Chrome Testing"
        echo "==========================================="
        python test_automated_windows.py
        exit $?
        ;;
    
    "mcp")
        echo "🔧 Running MCP-Based Automated Testing"
        echo "======================================"
        python test_mcp_automated.py
        exit $?
        ;;
    
    "help"|"-h"|"--help")
        show_tests
        exit 0
        ;;
    
    *)
        echo "❌ Unknown test module: $1"
        echo ""
        show_tests
        exit 1
        ;;
esac