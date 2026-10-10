#!/usr/bin/env bash
# One-command launcher: starts the backend, serves the prebuilt web app,
# and opens Chrome at http://localhost:5173
#
# Usage:
#   ./run-web.sh                # regex parser (default, no API key)
#   ./run-web.sh openai         # GPT-4o-mini  (needs OPENAI_API_KEY in backend/.env)
#   ./run-web.sh anthropic      # Claude       (needs ANTHROPIC_API_KEY in backend/.env)
#
# Stop:   Ctrl+C in this terminal

set -e
cd "$(dirname "$0")"

# --- parse mode argument ---------------------------------------------------
MODE="${1:-regex}"
case "$MODE" in
  regex|openai|anthropic) ;;
  *)
    echo "error: unknown mode '$MODE'. Use: regex | openai | anthropic"
    exit 1
    ;;
esac

# Pre-flight: make sure the required API key is set for LLM modes
if [ "$MODE" = "openai" ]; then
  if ! grep -qE '^OPENAI_API_KEY=.+$' backend/.env 2>/dev/null; then
    echo "error: OPENAI_API_KEY is not set in backend/.env"
    echo "       open backend/.env and put your key after OPENAI_API_KEY="
    exit 1
  fi
fi
if [ "$MODE" = "anthropic" ]; then
  if ! grep -qE '^ANTHROPIC_API_KEY=.+$' backend/.env 2>/dev/null; then
    echo "error: ANTHROPIC_API_KEY is not set in backend/.env"
    echo "       get one at console.anthropic.com, then put it after ANTHROPIC_API_KEY="
    exit 1
  fi
fi

# --- backend ---------------------------------------------------------------
if ! lsof -ti tcp:3000 >/dev/null 2>&1; then
  echo "[run-web] starting backend on :3000 (parser: $MODE)…"
  (cd backend && npm install --silent >/dev/null 2>&1 || true)
  (cd backend && npm run "dev:$MODE" > /tmp/cafeai-backend.log 2>&1 &)
  # wait up to 15s for the backend to come up
  for i in {1..30}; do
    if curl -sf http://localhost:3000/health >/dev/null 2>&1; then break; fi
    sleep 0.5
  done
  if ! curl -sf http://localhost:3000/health >/dev/null 2>&1; then
    echo "[run-web] backend did not start — see /tmp/cafeai-backend.log"
    tail -30 /tmp/cafeai-backend.log
    exit 1
  fi
  echo "[run-web] backend up."
else
  echo "[run-web] backend already running on :3000."
fi

# --- web static server -----------------------------------------------------
WEB_DIR="mobile/web-build"
if [ ! -f "$WEB_DIR/index.html" ]; then
  echo "[run-web] no prebuilt bundle at $WEB_DIR — building (this takes ~30s)…"
  (cd mobile && npx expo export --platform web --output-dir web-build)
fi

PORT=5173
if lsof -ti tcp:$PORT >/dev/null 2>&1; then
  PORT=5174
fi

echo "[run-web] serving $WEB_DIR on http://localhost:$PORT (SPA fallback)"
python3 serve-web.py "$PORT" "$WEB_DIR" >/tmp/cafeai-web.log 2>&1 &
SERVER_PID=$!

# open Chrome (falls back to default browser if Chrome isn't installed)
sleep 1
if [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" "http://localhost:$PORT"
else
  open "http://localhost:$PORT"
fi

# --- find LAN IP for phone access ------------------------------------------
# Try the most common Wi-Fi interface first, then Ethernet, then fallback.
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null)
[ -z "$LAN_IP" ] && LAN_IP=$(ipconfig getifaddr en1 2>/dev/null)
[ -z "$LAN_IP" ] && LAN_IP=$(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}')

echo ""
echo "==========================================================="
echo "  Cafe AI is now running."
echo "  Chat parser mode: $MODE"
echo ""
echo "  On THIS Mac (Chrome):"
echo "    http://localhost:$PORT"
echo ""
if [ -n "$LAN_IP" ]; then
  echo "  On your ANDROID PHONE (same Wi-Fi):"
  echo "    http://$LAN_IP:$PORT"
  echo ""
  echo "  Open that URL in Chrome on your phone."
  echo "  (Backend is auto-detected — no extra config needed.)"
else
  echo "  Could not detect your Mac's LAN IP."
  echo "  Run \`ipconfig getifaddr en0\` to find it, then open"
  echo "  http://<that-ip>:$PORT on your phone's Chrome."
fi
echo ""
echo "  Backend:  http://localhost:3000  (logs: /tmp/cafeai-backend.log)"
echo ""
echo "  Press Ctrl+C to stop the web server."
echo "  (Backend will keep running — to stop it:  lsof -ti :3000 | xargs kill)"
echo "==========================================================="

trap "echo; echo '[run-web] stopping web server'; kill $SERVER_PID 2>/dev/null; exit 0" INT TERM
wait $SERVER_PID
