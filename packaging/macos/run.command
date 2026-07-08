#!/bin/bash
# Runs the OpenEventor server in this Terminal window. Double-clicking the .app
# (or this file) lands here. Keeps event databases in Application Support so they
# survive restarts and don't scatter across the home directory. The server opens
# the browser itself; press Ctrl-C in this window to stop it.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
export DATA_DIR="$HOME/Library/Application Support/OpenEventor"
mkdir -p "$DATA_DIR"
echo "OpenEventor — data: $DATA_DIR"
echo "Press Ctrl-C to stop."
exec "$DIR/openeventor"
