#!/bin/bash

# Automated release script for Claude to use
# This script handles version bumping, changelog generation, and release

# Convert relative path to absolute path
PUBLIC_REPO_INPUT=${1:-"~/proj/ai_tab_manager"}
PUBLIC_REPO=$(realpath "$PUBLIC_REPO_INPUT" 2>/dev/null || echo "$PUBLIC_REPO_INPUT")
BUMP_TYPE=${2:-"minor"}  # major, minor, patch

# Get current working directory (dev repo)
DEV_REPO=$(pwd)

echo "🤖 Automated Release Process Starting..."
echo "Dev repo: $DEV_REPO"
echo "Public repo: $PUBLIC_REPO"
echo "Bump type: $BUMP_TYPE"
echo "----------------------------------------"

# Ensure we're in the dev repo
if [[ ! -f "manifest.json" ]]; then
    echo "❌ Error: manifest.json not found. Run from dev repo directory."
    exit 1
fi

# Check if public repo exists
if [[ ! -d "$PUBLIC_REPO" ]]; then
    echo "❌ Error: Public repo directory not found: $PUBLIC_REPO"
    exit 1
fi

# Get current version from manifest.json
CURRENT_VERSION=$(grep '"version"' manifest.json | cut -d'"' -f4)
echo "Current version: $CURRENT_VERSION"

# Calculate new version based on bump type
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

case $BUMP_TYPE in
    "major")
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    "minor")
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    "patch")
        PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "New version: $NEW_VERSION"

# Get last release tag from PUBLIC repo (since that's where releases are tagged)
cd "$PUBLIC_REPO"
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
cd "$DEV_REPO"

if [ -z "$LAST_TAG" ]; then
    echo "No previous tags found in public repo, using all commits from dev"
    COMMIT_RANGE="HEAD"
else
    echo "Last release: $LAST_TAG"
    # Get commits since last tag in dev repo
    COMMIT_RANGE="HEAD --since=\"$(git -C "$PUBLIC_REPO" log -1 --format=%ci "$LAST_TAG")\""
fi

# Get commit messages for changelog generation from DEV repo
echo "📋 Analyzing commits since last release..."
eval "git log $COMMIT_RANGE --oneline --pretty=format:\"%s\"" > /tmp/commits.txt

echo "Commits to analyze:"
cat /tmp/commits.txt

echo ""
echo "🎯 Ready for Claude to:"
echo "1. Analyze commits and generate user-friendly changelog"
echo "2. Update version to v$NEW_VERSION"
echo "3. Run release sync from dev to public repo"
echo "4. Create release commit and tag in public repo"
echo ""

# Export variables for Claude to use
export NEW_VERSION
export COMMIT_RANGE
export PUBLIC_REPO
export DEV_REPO

echo "Environment variables set:"
echo "NEW_VERSION=$NEW_VERSION"
echo "PUBLIC_REPO=$PUBLIC_REPO"  
echo "DEV_REPO=$DEV_REPO"