#!/usr/bin/env bash
# One-command launcher for ANDROID PHONE via Expo Go.
#
# Starts the backend, then runs `expo start` for the mobile app.
# Expo prints a QR code; you scan it with the Expo Go app on your phone.
#
# Usage:
#   ./run-android.sh                # regex parser (default, no API key)
#   ./run-android.sh openai         # GPT-4o-mini
#   ./run-android.sh anthropic      # Claude (needs ANTHROPIC_API_KEY)
#
# Stop:   Ctrl+C in this terminal (also stops Expo). Backend keeps running.

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

# Pre-flight: LLM modes need their key
if [ "$MODE" = "openai" ] && ! grep -qE '^OPENAI_API_KEY=.+$' backend/.env 2>/dev/null; then
  echo "error: OPENAI_API_KEY is not set in backend/.env"
  exit 1
fi
if [ "$MODE" = "anthropic" ] && ! grep -qE '^ANTHROPIC_API_KEY=.+$' backend/.env 2>/dev/null; then
  echo "error: ANTHROPIC_API_KEY is not set in backend/.env"
  exit 1
fi

# --- find LAN IP early so we can show it and pass it to Expo ---------------
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null)
[ -z "$LAN_IP" ] && LAN_IP=$(ipconfig getifaddr en1 2>/dev/null)
[ -z "$LAN_IP" ] && LAN_IP=$(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}')

if [ -z "$LAN_IP" ]; then
  echo "error: could not detect Mac's LAN IP. Make sure Wi-Fi is connected."
  exit 1
fi

# --- backend ---------------------------------------------------------------
if ! lsof -ti tcp:3000 >/dev/null 2>&1; then
  echo "[run-android] starting backend on :3000 (parser: $MODE)…"
  (cd backend && npm install --silent >/dev/null 2>&1 || true)
  (cd backend && npm run "dev:$MODE" > /tmp/cafeai-backend.log 2>&1 &)
  for i in {1..30}; do
    if curl -sf http://localhost:3000/health >/dev/null 2>&1; then break; fi
    sleep 0.5
  done
  if ! curl -sf http://localhost:3000/health >/dev/null 2>&1; then
    echo "[run-android] backend did not start — see /tmp/cafeai-backend.log"
    tail -30 /tmp/cafeai-backend.log
    exit 1
  fi
  echo "[run-android] backend up."
else
  echo "[run-android] backend already running on :3000."
fi

# --- install mobile deps if needed -----------------------------------------
if [ ! -d "mobile/node_modules" ]; then
  echo "[run-android] installing mobile dependencies (one-time, ~1 min)…"
  (cd mobile && npm install --legacy-peer-deps)
fi

# --- print instructions BEFORE handing the terminal to Expo ----------------
cat <<EOF

===========================================================
  Cafe AI — Expo Go launcher
  Chat parser mode: $MODE
  Mac LAN IP:       $LAN_IP
  Backend:          http://$LAN_IP:3000 (logs: /tmp/cafeai-backend.log)

  ON YOUR PHONE (do this once):
    1. Install "Expo Go" from the Google Play Store.
    2. Make sure phone Wi-Fi is on the SAME network as this Mac.
    3. Open Expo Go and tap "Scan QR code".

  Then SCAN THE QR CODE that Expo prints below (~30s to appear).
  The first bundle download takes 1–2 minutes on the phone —
  it's not stuck, just downloading the JS bundle. Be patient.

  Tips:
    • Press 'r' in this terminal to reload the app on the phone.
    • Press 'j' to open the React DevTools.
    • Press 'Ctrl+C' to stop. The backend keeps running — kill it with:
        lsof -ti :3000 | xargs kill
===========================================================

EOF

# Hand the terminal off to Expo. --lan tells Expo to use the LAN URL
# scheme (not "tunnel" or "localhost"), which is what we want for a phone
# on the same Wi-Fi.
cd mobile
exec npx expo start --lan --clear
