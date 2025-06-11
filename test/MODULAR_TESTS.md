# Modular Test System

The extension now has a modular test system that allows running specific functionality tests independently.

## Test Modules

### 1. Search Tests (`test_search.py`)
Tests search functionality including:
- ✅ Basic search filtering (case insensitive)
- ✅ Group counter updates during search
- ✅ Empty group handling (groups with 0 results are hidden)
- ✅ Search restoration when cleared

### 2. GROUP BY Tests (`test_groupby.py`)
Tests GROUP BY functionality including:
- ✅ Category grouping (default mode)
- ✅ Domain grouping with proper domain extraction
- ✅ Mode switching between category and domain
- ✅ Group statistics display
- ✅ No "unknown" domain headers

### 3. Complete Test Suite (`test_simple.py`)
The original comprehensive test suite including:
- Real-time updates
- Tab counter functionality
- Navigation refresh
- All GROUP BY and Search tests

## Base Test Class (`test_base.py`)
Shared functionality for all tests:
- Browser setup with extension loading
- Extension tab management
- Common utility methods
- Result logging and reporting

## Running Tests

### Modular Test Runner
```bash
# Run specific test modules
./run_modular_tests.sh search      # Search functionality only
./run_modular_tests.sh groupby     # GROUP BY functionality only
./run_modular_tests.sh all         # Complete test suite

# Show available options
./run_modular_tests.sh help
```

### Individual Test Files
```bash
# Run tests directly
source venv/bin/activate
python test_search.py      # Search tests only
python test_groupby.py     # GROUP BY tests only
python test_simple.py      # Complete test suite
```

### Original Test Runner
```bash
# Still available for complete testing
./run_test.sh
```

## Benefits of Modular Testing

1. **Faster Development**: Test specific functionality without running the entire suite
2. **Easier Debugging**: Isolate issues to specific feature areas
3. **Better Maintenance**: Each test module focuses on one area of functionality
4. **Parallel Development**: Different developers can work on different test modules
5. **CI/CD Friendly**: Can run different test suites for different triggers

## Test Results

Each test module generates its own timestamped report file:
- `test_results_YYYYMMDD_HHMMSS.txt`

Reports include:
- Overall PASSED/FAILED status
- Detailed step-by-step results
- Pass/fail counts
- Timestamps for each test step

## Adding New Test Modules

1. Create new test file inheriting from `ExtensionTestBase`
2. Implement specific test methods
3. Add test runner logic
4. Update `run_modular_tests.sh` to include new module
5. Document in this file

Example structure:
```python
from test_base import ExtensionTestBase

class NewFeatureTest(ExtensionTestBase):
    def test_specific_functionality(self):
        # Test implementation
        pass
    
    def run_tests(self):
        # Test runner logic
        pass
```