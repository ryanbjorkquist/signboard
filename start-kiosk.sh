#!/bin/bash
# SF Transit Board - Kiosk Mode Startup Script
# For Raspberry Pi or any Linux system with Chromium

PORT=8080
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting SF Transit Board..."
echo "Directory: $DIR"

# Kill any existing server on this port
pkill -f "python3 -m http.server $PORT" 2>/dev/null

# Start the web server in background
cd "$DIR"
python3 -m http.server $PORT &
SERVER_PID=$!
echo "Web server started on port $PORT (PID: $SERVER_PID)"

# Wait for server to be ready
sleep 2

# Launch Chromium in kiosk mode
# --kiosk: Full screen, no UI
# --noerrdialogs: Suppress error dialogs
# --disable-infobars: Hide info bars
# --incognito: Don't save history
# --check-for-update-interval=31536000: Disable update checks

if command -v chromium-browser &> /dev/null; then
    BROWSER="chromium-browser"
elif command -v chromium &> /dev/null; then
    BROWSER="chromium"
elif command -v google-chrome &> /dev/null; then
    BROWSER="google-chrome"
else
    echo "No Chromium/Chrome browser found. Opening in default browser..."
    xdg-open "http://localhost:$PORT" 2>/dev/null || open "http://localhost:$PORT" 2>/dev/null
    wait $SERVER_PID
    exit 0
fi

echo "Launching $BROWSER in kiosk mode..."

$BROWSER \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-translate \
    --disable-features=TranslateUI \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --no-first-run \
    --start-fullscreen \
    --incognito \
    --check-for-update-interval=31536000 \
    "http://localhost:$PORT" &

BROWSER_PID=$!
echo "Browser started (PID: $BROWSER_PID)"

# Handle shutdown
cleanup() {
    echo "Shutting down..."
    kill $BROWSER_PID 2>/dev/null
    kill $SERVER_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep running
wait $BROWSER_PID
cleanup
