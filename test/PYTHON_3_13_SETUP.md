# Python 3.13 + Virtual Environment Setup

## ✅ Complete Setup for Current Tab Test

**Technology:** Python 3.13 + Virtual Environment + Selenium  
**Result:** Single PASSED/FAILED with detailed report

## 🔧 One-Time Setup

### Step 1: Install Python 3.13 (if needed)
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3.13 python3.13-venv python3.13-dev

# Or check if already installed
python3.13 --version
```

### Step 2: Setup Test Environment
```bash
cd test/
./setup_test_env.sh
```

This will:
- ✅ Create Python 3.13 virtual environment in `venv/`
- ✅ Install Selenium + WebDriver Manager
- ✅ Create activation helper script

## 🚀 Running Tests

### Option 1: Automated (Recommended)
```bash
cd test/
./run_test.sh
```

### Option 2: Manual
```bash
cd test/
source venv/bin/activate
python test_simple.py
```

### Option 3: Quick Activation
```bash
cd test/
source activate_test_env.sh
./run_test.sh
```

## 📋 Test Workflow

1. ✅ **Activates Python 3.13 venv** automatically
2. ✅ **Launches Chrome** with extension loaded  
3. ✅ **Opens extension** in full screen mode
4. ✅ **Navigates to Current Tab** view
5. ✅ **Checks initial state** (minimal tabs)
6. ✅ **Opens test browser tab** (example.com)
7. ✅ **Verifies URL appears** in Current Tab via DOM checking

## 📊 Expected Output

**SETUP:**
```bash
$ ./setup_test_env.sh
🐍 Setting up Python 3.13 Test Environment
==========================================
✅ Found Python 3.13: Python 3.13.0
📦 Creating virtual environment...
✅ Virtual environment created
🔧 Activating virtual environment...
📦 Upgrading pip...
📦 Installing test dependencies...
✅ Dependencies installed successfully

🎯 Setup Complete!
```

**TEST RUN:**
```bash
$ ./run_test.sh
🚀 Current Tab Basic Test Runner (Python 3.13 + venv)
===================================================
🐍 Activating Python 3.13 virtual environment...
✅ Virtual environment activated
Python version: Python 3.13.0
🔧 Running Current Tab test...

🚀 Starting Simple Current Tab Test
==================================================
🔄 Executing: Setup browser with extension
[14:25:30] PASSED: Successfully launched Chrome with extension
...
🎯 Final Result: PASSED
Test Name: Current Tab Basic Functionality - PASSED
```

## 📁 File Structure After Setup

```
test/
├── venv/                      # Python 3.13 virtual environment
│   ├── bin/python             # Python 3.13 executable
│   └── lib/python3.13/        # Installed packages
├── setup_test_env.sh          # One-time setup script
├── activate_test_env.sh       # Quick activation helper
├── run_test.sh               # Main test runner
├── test_simple.py            # Test implementation
├── requirements.txt          # Dependencies
└── test_results_*.txt        # Generated test reports
```

## 🔧 Dependencies Installed in venv

- **selenium** - Browser automation framework
- **webdriver-manager** - Automatic ChromeDriver management

## 💡 Benefits of This Setup

✅ **Isolated environment** - No system Python conflicts  
✅ **Python 3.13** - Latest Python features and performance  
✅ **Automatic ChromeDriver** - No manual driver setup  
✅ **Clean dependencies** - Only what's needed for testing  
✅ **Reproducible** - Same environment every time  
✅ **Easy activation** - Simple scripts to run tests  

## 🎯 Troubleshooting

**"python3.13 not found"** → Install Python 3.13 first  
**"Failed to create virtual environment"** → Check python3.13-venv package  
**"ChromeDriver issues"** → webdriver-manager handles this automatically  
**"Extension not found"** → Ensure running from `/test` folder  

This setup ensures reliable, reproducible testing with the latest Python 3.13 in an isolated environment.