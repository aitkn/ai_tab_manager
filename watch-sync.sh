#!/bin/bash
# Auto-sync script that watches for changes

WIN_USER="prosh"
SOURCE_DIR="/home/proshkin/proj/chrome_tabs_extension"
DEST_DIR="/mnt/c/Users/${WIN_USER}/proj/chrome_tabs_extension"

echo "Starting auto-sync..."
echo "From: $SOURCE_DIR"
echo "To: C:\\Users\\${WIN_USER}\\proj\\chrome_tabs_extension"
echo ""
echo "Press Ctrl+C to stop"
echo ""

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

# Function to sync
sync_files() {
    echo "[$(date '+%H:%M:%S')] Syncing files..."
    
    # Use rsync for better output
    if command -v rsync &> /dev/null; then
        # Show only changed files, not directories
        rsync -av --delete $RSYNC_EXCLUDES "$SOURCE_DIR/" "$DEST_DIR/" | grep -v "/$" | grep -v "sending incremental" | while read -r line; do
            if [ -n "$line" ]; then
                echo "  → $line"
            fi
        done
    else
        # Fallback without rsync (less efficient but works)
        echo "  Using cp (rsync not available)..."
        # Just do a simple copy for watch mode
        cp -r "$SOURCE_DIR"/* "$DEST_DIR"/ 2>/dev/null
    fi
    
    echo "[$(date '+%H:%M:%S')] ✓ Sync complete"
}

# Initial sync
sync_files

# Function to get directory state (file list with modification times)
get_dir_state() {
    find "$SOURCE_DIR" -type f 2>/dev/null | while read -r file; do
        # Skip excluded files
        rel_path="${file#$SOURCE_DIR/}"
        skip=false
        for exclude in "${EXCLUDES[@]}"; do
            if [[ "$rel_path" == *"$exclude"* ]] || [[ "$rel_path" == "$exclude" ]]; then
                skip=true
                break
            fi
        done
        
        if [ "$skip" = false ]; then
            echo "$(stat -c '%Y' "$file" 2>/dev/null || echo 0) $file"
        fi
    done | sort
}

# Watch for changes including renames, deletions, and new files
LAST_STATE=$(get_dir_state)

while true; do
    sleep 1
    CURRENT_STATE=$(get_dir_state)
    
    if [ "$CURRENT_STATE" != "$LAST_STATE" ]; then
        # Detect what changed
        echo "[$(date '+%H:%M:%S')] Detected changes:"
        
        # Find deleted/renamed files
        comm -23 <(echo "$LAST_STATE" | cut -d' ' -f2- | sort) <(echo "$CURRENT_STATE" | cut -d' ' -f2- | sort) | while read -r file; do
            rel_file="${file#$SOURCE_DIR/}"
            echo "  ✗ Removed: $rel_file"
        done
        
        # Find new/renamed files
        comm -13 <(echo "$LAST_STATE" | cut -d' ' -f2- | sort) <(echo "$CURRENT_STATE" | cut -d' ' -f2- | sort) | while read -r file; do
            rel_file="${file#$SOURCE_DIR/}"
            echo "  ✓ Added: $rel_file"
        done
        
        # Find modified files
        comm -12 <(echo "$LAST_STATE" | sort) <(echo "$CURRENT_STATE" | sort) | while read -r line; do
            old_time=$(echo "$LAST_STATE" | grep "${line#* }" | cut -d' ' -f1)
            new_time=$(echo "$CURRENT_STATE" | grep "${line#* }" | cut -d' ' -f1)
            if [ "$old_time" != "$new_time" ] 2>/dev/null; then
                rel_file="${line#* }"
                rel_file="${rel_file#$SOURCE_DIR/}"
                echo "  ↻ Modified: $rel_file"
            fi
        done
        
        sync_files
        LAST_STATE=$CURRENT_STATE
    fi
done