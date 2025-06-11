# Chrome Web Store Submission Checklist

## Pre-submission Requirements

### 1. Developer Account
- [X] Create Chrome Web Store Developer account
- [X] Pay one-time $5 registration fee
- [X] Verify account email

### 2. Extension Package
- [x] Update manifest.json version to 2.2.0
- [x] Remove unnecessary permissions ("management" removed)
- [x] Add proper description (under 132 chars)
- [X] Ensure all icon files exist (icon16.png, icon48.png, icon128.png)
- [x] Remove console.log statements (use build_for_store.sh)
- [x] Test extension thoroughly

### 3. Store Assets

#### Required Images
- [ ] Extension icons (16x16, 48x48, 128x128) - PNG format
- [ ] Screenshot 1 (1280x800 or 640x400) - Main interface
- [ ] Screenshot 2 (1280x800 or 640x400) - Saved tabs view
- [ ] Screenshot 3 (1280x800 or 640x400) - Settings panel
- [ ] Screenshot 4 (1280x800 or 640x400) - Dark mode
- [ ] Screenshot 5 (1280x800 or 640x400) - Grouping feature

#### Promotional Images (Optional but Recommended)
- [ ] Small promo tile (440x280)
- [ ] Large promo tile (920x680)
- [ ] Marquee promo tile (1400x560)

### 4. Store Listing Information
- [x] Extension name: "AI Tab Manager"
- [x] Short description (132 chars max)
- [x] Detailed description (prepared in STORE_LISTING.md)
- [x] Category: Productivity
- [x] Language: English
- [x] Privacy policy URL (host PRIVACY_POLICY.md on GitHub)

### 5. Privacy & Compliance
- [x] Privacy policy written
- [x] Single purpose description
- [x] Permission justifications ready
- [x] No remote code execution
- [x] All content appropriate

### 6. Testing Checklist
- [ ] Test in fresh Chrome profile
- [ ] Test all AI providers (Claude, OpenAI, Gemini)
- [ ] Test categorization functionality
- [ ] Test save and close operations
- [ ] Test saved tabs viewing and grouping
- [ ] Test search functionality
- [ ] Test dark/light theme switching
- [ ] Test with no tabs open
- [ ] Test with 50+ tabs open
- [ ] Test error handling (invalid API key)

### 7. Build Process
1. Run `./build_for_store.sh` to create production build
2. This creates `ai-tab-manager-v2.2.0.zip`
3. Test the zip file by loading it as unpacked extension

### 8. Submission Steps
1. Go to https://chrome.google.com/webstore/devconsole
2. Click "New Item"
3. Upload the zip file
4. Fill in all store listing fields
5. Upload screenshots and promotional images
6. Add privacy policy URL
7. Provide permission justifications
8. Submit for review

### 9. Post-submission
- [ ] Monitor email for review feedback
- [ ] Respond to any review issues promptly
- [ ] Plan marketing/announcement once approved
- [ ] Update GitHub README with Chrome Web Store link

## Review Guidelines to Follow
- No keyword stuffing in description
- Accurate representation of functionality
- Clear explanation of AI provider requirement
- Transparent about data handling
- No misleading claims

## Common Rejection Reasons to Avoid
- Missing or unclear privacy policy
- Excessive permissions
- Console.log statements in production
- Unclear user value proposition
- Missing screenshots
- Violation of branding guidelines