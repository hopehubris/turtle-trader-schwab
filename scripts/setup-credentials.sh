#!/usr/bin/env bash
# =============================================================================
# Schwab Credentials Setup — Turtle Trader (Schwab)
# Run this on a machine with a browser to get your Schwab API credentials.
# =============================================================================
set -euo pipefail

ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backend/.env"

echo ""
echo "=============================================="
echo "  Turtle Trader (Schwab) — Credentials Setup"
echo "=============================================="
echo ""

# ── 1. App Key and Secret ─────────────────────────────────────────────────────
read -rp "Enter your Schwab App Key (client ID): " APP_KEY
read -rsp "Enter your Schwab App Secret: " APP_SECRET
echo ""

# ── 2. Open browser for authorization ─────────────────────────────────────────
AUTH_URL="https://api.schwabapi.com/v1/oauth/authorize?client_id=${APP_KEY}&redirect_uri=https://127.0.0.1"

echo ""
echo "Step 1: Open this URL in your browser and log in with your Schwab account:"
echo ""
echo "  $AUTH_URL"
echo ""
echo "After approving, your browser will redirect to https://127.0.0.1/?code=..."
echo "(The page won't load — that's expected. Copy the URL from the address bar.)"
echo ""
read -rp "Paste the full redirect URL here: " REDIRECT_URL

# Extract the code via env var — avoids shell interpolation into Python source
AUTH_CODE=$(REDIRECT_URL="$REDIRECT_URL" python3 -c '
import os
from urllib.parse import urlparse, parse_qs
qs = parse_qs(urlparse(os.environ["REDIRECT_URL"]).query)
print(qs.get("code", [""])[0])
')

if [[ -z "$AUTH_CODE" ]]; then
  echo ""
  echo "ERROR: Could not find 'code' in the URL you pasted."
  echo "Make sure you copied the full URL from the browser address bar."
  exit 1
fi
echo "  Authorization code found."

# ── 3. Exchange code for tokens ───────────────────────────────────────────────
echo ""
echo "Step 2: Exchanging authorization code for tokens..."

# Build Basic auth header via env vars — keeps secrets out of process argv
CREDENTIALS=$(APP_KEY="$APP_KEY" APP_SECRET="$APP_SECRET" python3 -c '
import os, base64
pair = f"{os.environ[\"APP_KEY\"]}:{os.environ[\"APP_SECRET\"]}"
print(base64.b64encode(pair.encode()).decode())
')

TOKEN_RESPONSE=$(curl -s -X POST "https://api.schwabapi.com/v1/oauth/token" \
  -H "Authorization: Basic ${CREDENTIALS}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=${AUTH_CODE}&redirect_uri=https://127.0.0.1")

# Parse JSON via stdin — avoids interpolating server response into Python source
REFRESH_TOKEN=$(printf '%s' "$TOKEN_RESPONSE" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("refresh_token",""))' 2>/dev/null || true)
ACCESS_TOKEN=$(printf '%s' "$TOKEN_RESPONSE"  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("access_token",""))' 2>/dev/null || true)

if [[ -z "$REFRESH_TOKEN" || -z "$ACCESS_TOKEN" ]]; then
  echo ""
  echo "ERROR: Failed to get tokens. Schwab response:"
  echo "$TOKEN_RESPONSE"
  exit 1
fi
echo "  Tokens received."

# ── 4. Get account number hash ────────────────────────────────────────────────
echo ""
echo "Step 3: Fetching your account number..."

ACCOUNTS_RESPONSE=$(curl -s "https://api.schwabapi.com/trader/v1/accounts/accountNumbers" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

# Parse JSON via stdin
ACCOUNT_HASH=$(printf '%s' "$ACCOUNTS_RESPONSE" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["hashValue"])' 2>/dev/null || true)

if [[ -z "$ACCOUNT_HASH" ]]; then
  echo ""
  echo "ERROR: Could not fetch account hash. Schwab response:"
  echo "$ACCOUNTS_RESPONSE"
  exit 1
fi
echo "  Account hash found."

# ── 5. Write .env ─────────────────────────────────────────────────────────────
echo ""
echo "Step 4: Writing credentials to backend/.env..."

BACKEND_DIR="$(dirname "$ENV_FILE")"
APP_DIR="$(dirname "$BACKEND_DIR")"

# umask 077 ensures the file is created 0600 (owner-only) atomically
(umask 077; cat > "$ENV_FILE" <<EOF
SCHWAB_CLIENT_ID=${APP_KEY}
SCHWAB_CLIENT_SECRET=${APP_SECRET}
SCHWAB_REFRESH_TOKEN=${REFRESH_TOKEN}
SCHWAB_ACCOUNT_NUMBER=${ACCOUNT_HASH}

PORT=3010
NODE_ENV=development
LOG_LEVEL=info
LOG_DIR=./logs
EOF
)

echo ""
echo "=============================================="
echo "  Done! Credentials saved to backend/.env"
echo "=============================================="
echo ""
echo "  Start the app:"
echo "    cd ${APP_DIR}/backend && npm run dev"
echo "    cd ${APP_DIR}/frontend && npm run dev"
echo ""
echo "  Or with PM2:"
echo "    pm2 start npm --name tts-backend -- run dev --prefix ${BACKEND_DIR}"
echo "    pm2 start npm --name tts-frontend -- run dev --prefix ${APP_DIR}/frontend"
echo ""
echo "  Frontend: http://localhost:5574"
echo "  Backend:  http://localhost:3010/api/health"
echo ""
echo "  Note: DRY_RUN is enabled by default in the app settings."
echo "  Go to Settings → Dry Run → Disabled when ready for live trading."
echo ""
