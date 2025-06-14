# Automated Release Process

This document describes the automated release system for AI Tab Manager. When the user says **"make release"**, Claude should follow this exact process.

## Overview

The project has two repositories:
- **Dev repo**: `/home/proshkin/proj/chrome_tabs_extension` (private `ai_tab_manager_dev`)
- **Public repo**: `/home/proshkin/proj/ai_tab_manager` (public `ai_tab_manager`)

## Files in Release System

- `auto-release.sh` - Analyzes commits and prepares release data
- `release.sh` - Syncs code and creates release commit
- `.releaseignore` - Defines files to exclude from public repo
- `RELEASE.md` - This documentation file

## When User Says "make release"

### Step 1: Run Analysis Script
```bash
./auto-release.sh
```

This script will:
- Calculate new version (minor bump by default: 2.2.0 → 2.3.0)
- Find commits since last release
- Export environment variables (`NEW_VERSION`, `PUBLIC_REPO`, `DEV_REPO`)
- Output commit list for Claude to analyze

### Step 2: Analyze Commits and Generate Changelog

Claude should:
1. **Read the commit output** from `/tmp/commits.txt`
2. **Translate technical commits** into user-friendly language:
   - Focus on **features added** and **bugs fixed**
   - Remove technical implementation details
   - Use simple language for extension users
   - Group similar changes together

**Example transformation:**
- Technical: "Refactor state-manager.js with subscription pattern"
- User-friendly: "Improved tab management performance and reliability"

- Technical: "Fix duplicate count not updating in real-time"
- User-friendly: "Fixed issue where duplicate tab counts weren't updating automatically"

### Step 3: Run Release Sync
```bash
./release.sh v[NEW_VERSION]
```

This will:
- Sync clean code from dev to public repo (excludes test files, docs, etc.)
- Update version in manifest.json
- Create release commit with standard message

### Step 4: Create User-Friendly Release Commit

Replace the standard commit with a user-friendly one:
```bash
git -C /home/proshkin/proj/ai_tab_manager commit --amend -m "Release v[VERSION]

[USER-FRIENDLY CHANGELOG HERE]

What's New:
- [Feature 1]
- [Feature 2]

Bug Fixes:
- [Fix 1]
- [Fix 2]

Improvements:
- [Improvement 1]
- [Improvement 2]"
```

### Step 5: Tag and Push Release
```bash
git -C /home/proshkin/proj/ai_tab_manager tag v[NEW_VERSION]
git -C /home/proshkin/proj/ai_tab_manager push origin main
git -C /home/proshkin/proj/ai_tab_manager push origin v[NEW_VERSION]
```

## Release Types

- **Minor release** (default): New features, improvements (2.2.0 → 2.3.0)
- **Patch release**: Bug fixes only (2.2.0 → 2.2.1)
- **Major release**: Breaking changes (2.2.0 → 3.0.0)

For different release types:
```bash
./auto-release.sh minor   # Default
./auto-release.sh patch   # Bug fixes only
./auto-release.sh major   # Breaking changes
```

## File Exclusions (.releaseignore)

The following are excluded from public repo:
- All test files and directories
- Documentation (except README.md)
- Development scripts
- Legacy/backup files
- Node modules
- Store assets

## Complete Automated Workflow

When user says **"make release"**:

```bash
# 1. Analyze commits
./auto-release.sh

# 2. Claude reads /tmp/commits.txt and generates changelog

# 3. Run release sync
./release.sh v[NEW_VERSION]

# 4. Claude amends commit with user-friendly message
git -C /home/proshkin/proj/ai_tab_manager commit --amend -m "[USER_FRIENDLY_RELEASE_MESSAGE]"

# 5. Tag and push
git -C /home/proshkin/proj/ai_tab_manager tag v[NEW_VERSION]
git -C /home/proshkin/proj/ai_tab_manager push origin main  
git -C /home/proshkin/proj/ai_tab_manager push origin v[NEW_VERSION]
```

## Success Indicators

After successful release:
- New version in public repo's manifest.json
- User-friendly release commit message
- Git tag created and pushed
- Clean code synced (no test/dev files)
- Public repo has latest changes without clutter

## Repository Structure After Release

**Dev repo** (`ai_tab_manager_dev`):
- Contains all files (tests, docs, development scripts)
- Private repository for development work
- Technical commit messages

**Public repo** (`ai_tab_manager`):
- Contains only production files
- User-friendly release notes
- Clean, professional presentation
- Ready for Chrome Web Store submission

## Example User-Friendly Changelog Format

```
Release v2.3.0

🎉 What's New:
- Added support for Grok AI for tab categorization
- New machine learning features for better tab organization
- Improved search functionality with faster results

🐛 Bug Fixes:
- Fixed issue where tab counts weren't updating in real-time
- Resolved problem with duplicate tabs not being handled correctly
- Fixed extension popup sometimes not opening

⚡ Improvements:
- Faster tab categorization with optimized AI processing
- Better performance when managing large numbers of tabs
- Enhanced user interface responsiveness
```

This format is what extension users care about - new features they can use and problems that are now fixed.