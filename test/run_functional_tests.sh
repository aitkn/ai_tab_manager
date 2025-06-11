#!/bin/bash
# Functional Test Runner for Chrome Extension AI Tab Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DEMO_MODE=false
VERBOSE=false
HTML_REPORT=false
SPECIFIC_TEST=""
HELP=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--demo)
            DEMO_MODE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -r|--report)
            HTML_REPORT=true
            shift
            ;;
        -t|--test)
            SPECIFIC_TEST="$2"
            shift 2
            ;;
        -h|--help)
            HELP=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            HELP=true
            shift
            ;;
    esac
done

# Help message
if [ "$HELP" = true ]; then
    echo -e "${BLUE}Chrome Extension Functional Test Runner${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --demo      Enable demo mode with visual balloons"
    echo "  -v, --verbose   Enable verbose output"
    echo "  -r, --report    Generate HTML report"
    echo "  -t, --test      Run specific test (e.g., test_search.py)"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run all tests (fast mode)"
    echo "  $0 --demo                    # Run all tests with visual balloons"
    echo "  $0 --test test_search.py     # Run only search tests"
    echo "  $0 --demo --report           # Run with demo mode and generate report"
    echo ""
    echo "Test Categories:"
    echo "  test_search.py       - Search functionality tests"
    echo "  test_groupby.py      - GROUP BY functionality tests"
    echo "  test_current_tabs.py - Current tabs functionality tests"
    echo ""
    exit 0
fi

# Check if we're in the test directory
if [ ! -d "functional" ]; then
    echo -e "${RED}Error: Please run this script from the test/ directory${NC}"
    echo "Expected directory structure:"
    echo "  test/"
    echo "    functional/"
    echo "    run_functional_tests.sh"
    exit 1
fi

# Check if Chrome is running with remote debugging
echo -e "${BLUE}🔍 Checking Chrome connection...${NC}"
if curl -s http://172.25.48.1:9223/json/version > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Chrome remote debugging connected${NC}"
else
    echo -e "${RED}❌ Chrome remote debugging not available${NC}"
    echo "Please start Chrome with: chrome --remote-debugging-port=9223"
    echo "Or check if IP address 172.25.48.1 is correct for your setup"
    exit 1
fi

# Check if pytest is available
if ! command -v pytest &> /dev/null; then
    echo -e "${YELLOW}⚠️  pytest not found. Installing dependencies...${NC}"
    if [ -f "functional/requirements.txt" ]; then
        pip install -r functional/requirements.txt
    else
        echo -e "${RED}❌ requirements.txt not found${NC}"
        exit 1
    fi
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Build pytest command
PYTEST_CMD="pytest functional/"

# Add specific test if provided
if [ -n "$SPECIFIC_TEST" ]; then
    PYTEST_CMD="pytest functional/$SPECIFIC_TEST"
fi

# Add options
if [ "$DEMO_MODE" = true ]; then
    PYTEST_CMD="$PYTEST_CMD --demo"
fi

if [ "$VERBOSE" = true ]; then
    PYTEST_CMD="$PYTEST_CMD -v -s"
fi

if [ "$HTML_REPORT" = true ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    PYTEST_CMD="$PYTEST_CMD --html=logs/functional_report_$TIMESTAMP.html --self-contained-html"
fi

# Show configuration
echo -e "${BLUE}🧪 Functional Test Configuration${NC}"
echo "  Demo Mode: $DEMO_MODE"
echo "  Verbose: $VERBOSE"
echo "  HTML Report: $HTML_REPORT"
echo "  Specific Test: ${SPECIFIC_TEST:-'All tests'}"
echo "  Command: $PYTEST_CMD"
echo ""

# Run tests
echo -e "${BLUE}🚀 Starting functional tests...${NC}"
echo ""

if eval $PYTEST_CMD; then
    echo ""
    echo -e "${GREEN}🎉 All functional tests completed successfully!${NC}"
    
    if [ "$HTML_REPORT" = true ]; then
        REPORT_FILE=$(ls -t logs/functional_report_*.html 2>/dev/null | head -1)
        if [ -n "$REPORT_FILE" ]; then
            echo -e "${BLUE}📊 HTML Report: $REPORT_FILE${NC}"
        fi
    fi
else
    echo ""
    echo -e "${RED}❌ Some functional tests failed${NC}"
    echo "Check the output above for details"
    exit 1
fi

# Show summary
echo ""
echo -e "${BLUE}📈 Test Summary${NC}"
echo "  Total test files: $(find functional/ -name 'test_*.py' | wc -l)"
echo "  Legacy tests: $(find legacy/ -name 'test_*.py' 2>/dev/null | wc -l)"
echo "  Log files: $(find logs/ -name '*.txt' -o -name '*.html' 2>/dev/null | wc -l)"

echo ""
echo -e "${GREEN}✨ Functional testing complete!${NC}"