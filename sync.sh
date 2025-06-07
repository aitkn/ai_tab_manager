#\!/bin/bash
# Simple sync script to copy extension to Windows

# Get Windows username
WIN_USER="prosh"  # Your Windows username

# Set paths
SOURCE_DIR="/home/proshkin/proj/chrome_tabs_extension"
DEST_DIR="/mnt/c/Users/${WIN_USER}/proj/chrome_tabs_extension"

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"

# Sync files
echo "Syncing extension to Windows..."
echo "----------------------------------------"

# Define exclusions
EXCLUDES=(
    ".git"
    ".gitignore"
    "node_modules"
    "build"
    "dist"
    "*.zip"
    "*.log"
    ".DS_Store"
    "Thumbs.db"
    "*.swp"
    "*.swo"
    "*~"
    ".vscode"
    ".idea"
    "sync.sh"
    "watch-sync.sh"
)

# Build rsync exclude args
RSYNC_EXCLUDES=""
for exclude in "${EXCLUDES[@]}"; do
    RSYNC_EXCLUDES="$RSYNC_EXCLUDES --exclude=$exclude"
done

# Use rsync for better output
if command -v rsync &> /dev/null; then
    rsync -av --delete $RSYNC_EXCLUDES "$SOURCE_DIR/" "$DEST_DIR/" | grep -v "/$" | grep -v "sending incremental"
else
    # Fallback to cp with manual exclusion
    echo "Using cp (rsync not available)..."
    # First remove destination to ensure clean state
    rm -rf "$DEST_DIR"/*
    
    # Copy files excluding unwanted ones
    find "$SOURCE_DIR" -type f | while read -r file; do
        rel_path="${file#$SOURCE_DIR/}"
        skip=false
        
        # Check if file should be excluded
        for exclude in "${EXCLUDES[@]}"; do
            if [[ "$rel_path" == *"$exclude"* ]] || [[ "$rel_path" == "$exclude" ]]; then
                skip=true
                break
            fi
        done
        
        if [ "$skip" = false ]; then
            dest_file="$DEST_DIR/$rel_path"
            mkdir -p "$(dirname "$dest_file")"
            cp -v "$file" "$dest_file" | sed "s|$SOURCE_DIR/||"
        fi
    done
fi

echo "----------------------------------------"
echo "✓ Synced to: C:\\Users\\${WIN_USER}\\proj\\chrome_tabs_extension"
echo ""
echo "In Chrome:"
echo "1. Go to chrome://extensions/"
echo "2. Click 'Load unpacked'"
echo "3. Select: C:\\Users\\${WIN_USER}\\proj\\chrome_tabs_extension"
