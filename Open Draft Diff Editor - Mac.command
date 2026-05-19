#!/bin/zsh

set -e

APP_DIR="${0:A:h}"
URL="http://localhost:4173/"

cd "$APP_DIR"

if curl --silent --fail "$URL" >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi

echo "Starting Draft Diff Editor..."
node server.js &
SERVER_PID=$!

for attempt in {1..40}; do
  if curl --silent --fail "$URL" >/dev/null 2>&1; then
    open "$URL"
    echo "Draft Diff Editor is running at $URL"
    echo "Leave this window open while you use the app. Close it to stop the local server."
    wait "$SERVER_PID"
    exit 0
  fi
  sleep 0.25
done

echo "The app did not start. Check the messages above for details."
kill "$SERVER_PID" >/dev/null 2>&1 || true
exit 1
