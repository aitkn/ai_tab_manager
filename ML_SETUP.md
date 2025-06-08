# Machine Learning Setup for AI Tab Manager

Due to Chrome extension security restrictions, TensorFlow.js cannot be loaded dynamically from external sources or via blob URLs. 

## Current ML Status

The ML features are currently **disabled** because:

1. Chrome extensions have strict Content Security Policy (CSP) that prevents:
   - Loading scripts from external CDNs
   - Executing dynamically created scripts (blob URLs)
   - Using eval() or new Function() with external code

2. TensorFlow.js is too large (~3MB) to bundle directly with the extension

## Possible Solutions

### Option 1: Bundle TensorFlow.js (Not Recommended)
- Would increase extension size by ~3MB
- May affect extension load time and performance
- Would require build process changes

### Option 2: Use Cloud-based ML API
- Move ML processing to a backend service
- Extension would send tab data to API for categorization
- Requires hosting and API development

### Option 3: Use Lighter ML Library
- Find a smaller alternative to TensorFlow.js
- May have limited functionality
- Still subject to CSP restrictions

### Option 4: Native Messaging
- Create a companion desktop app
- Extension communicates with app via Native Messaging API
- App handles ML processing locally

## Current Implementation

For now, the extension uses:
1. **Rule-based categorization** - Fast, reliable, customizable
2. **LLM categorization** - Intelligent categorization via API calls

The ML infrastructure is in place but disabled. When a viable solution is implemented, the ML features can be enabled.