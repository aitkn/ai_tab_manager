#!/bin/bash

# Release script to sync clean code from dev to public repo
# Usage: ./release.sh [version] [public_repo_path]

VERSION=${1:-"v0.0.1"}
PUBLIC_REPO=${2:-"../ai_tab_manager"}

echo "🚀 Starting release process..."
echo "Version: $VERSION"
echo "Target repo: $PUBLIC_REPO"
echo "----------------------------------------"

# Check if public repo exists
if [ ! -d "$PUBLIC_REPO" ]; then
    echo "❌ Error: Public repo directory not found: $PUBLIC_REPO"
    exit 1
fi

# Check if .releaseignore exists
if [ ! -f ".releaseignore" ]; then
    echo "❌ Error: .releaseignore file not found"
    exit 1
fi

# Load exclusions from .releaseignore file (same pattern as sync.sh)
IGNORE_FILE=".releaseignore"
EXCLUDES=()

echo "Loading ignore patterns from .releaseignore..."
while IFS= read -r line; do
    # Remove leading/trailing whitespace
    line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Skip empty lines and comments (starting with #)
    if [ -n "$line" ] && [ "${line:0:1}" != "#" ]; then
        EXCLUDES+=("$line")
    fi
done < "$IGNORE_FILE"
echo "Loaded ${#EXCLUDES[@]} ignore patterns"

# Build rsync exclude args
RSYNC_EXCLUDES=""
for exclude in "${EXCLUDES[@]}"; do
    RSYNC_EXCLUDES="$RSYNC_EXCLUDES --exclude=$exclude"
done

# Full sync with delete (removes files deleted in dev repo)
echo "📋 Syncing files with full sync (--delete)..."
if command -v rsync &> /dev/null; then
    # Preserve .git directory in destination
    rsync -av --delete --exclude='.git' $RSYNC_EXCLUDES . "$PUBLIC_REPO/" | grep -v "/$" | grep -v "sending incremental"
else
    echo "❌ Error: rsync is required for release sync"
    exit 1
fi

# Update version in manifest.json
echo "📝 Updating version to $VERSION in manifest.json..."
sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION#v}\"/" "$PUBLIC_REPO/manifest.json"

# Change to public repo and commit
echo "📦 Committing release $VERSION..."
git -C "$PUBLIC_REPO" add .
git -C "$PUBLIC_REPO" commit -m "Release $VERSION

- Updated extension to version ${VERSION#v}
- Full sync from development repository with deletions
- Production-ready build without development files"

echo "----------------------------------------"
echo "✅ Release $VERSION prepared successfully!"
echo "📋 Next steps to finalize release:"
echo "   git -C $PUBLIC_REPO tag $VERSION"
echo "   git -C $PUBLIC_REPO push origin main"
echo "   git -C $PUBLIC_REPO push origin $VERSION"