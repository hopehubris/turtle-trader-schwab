# Charles Schwab API Setup

This guide walks through obtaining the API credentials needed to run Turtle Trader (Schwab).

---

## Overview

Schwab uses OAuth2 for API authentication. The process:

1. Create a developer account and app on developer.schwab.com
2. Complete a one-time OAuth authorization to get a refresh token
3. Paste credentials into `backend/.env`
4. The app automatically refreshes access tokens every 30 minutes

You only need to do steps 1–3 once. The app handles token refresh automatically.

---

## Step 1 — Create a Schwab Developer Account

1. Go to **https://developer.schwab.com**
2. Click **Sign Up** (or **Log In** if you already have an account)
3. You can use your existing Schwab brokerage credentials

---

## Step 2 — Create an App

1. Once logged in, go to **My Apps** → **Add a New App**
2. Fill in the app details:
   - **App Name**: `Turtle Trader` (or any name)
   - **App Description**: Turtle Trading bot
   - **Callback URL**: `https://127.0.0.1` (exactly this — needed for the OAuth flow)
3. Select the API products to enable:
   - ✅ **Accounts and Trading Production**
   - ✅ **Market Data Production**
4. Submit the application and wait for approval (usually instant for individual developers)

After approval, you'll see your app in the **My Apps** dashboard with:
- **App Key** → this is your `SCHWAB_CLIENT_ID`
- **App Secret** → this is your `SCHWAB_CLIENT_SECRET`

---

## Step 3 — Get Your Account Number

1. Log in to your Schwab brokerage account at **schwab.com**
2. Go to **Accounts** → select your trading account
3. The account number is visible in the URL or account header
4. Schwab API uses an **encrypted account number**, not the plain account number:
   - Call `GET https://api.schwabapi.com/trader/v1/accounts` with a valid access token
   - The response includes `"hashValue"` — this is your `SCHWAB_ACCOUNT_NUMBER`
   - Alternatively, use the script in the next section

---

## Step 4 — Get a Refresh Token (One-time OAuth Flow)

This is the only step that requires manual browser interaction.

### Build the authorization URL

```
https://api.schwabapi.com/v1/oauth/authorize
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://127.0.0.1
```

Replace `YOUR_CLIENT_ID` with your App Key. Paste the full URL into your browser.

### Authorize the app

1. Schwab will show a login screen — log in with your brokerage credentials
2. Select the account(s) you want to authorize
3. Click **Allow**

### Capture the authorization code

After clicking Allow, Schwab redirects to `https://127.0.0.1?code=AUTHORIZATION_CODE&session=...`

Your browser will show a "connection refused" error — that's expected. Copy the `code` parameter from the URL bar.

The code looks like: `C0.b64.long_string_of_characters`

**The code expires in 30 seconds. Complete step 4 immediately.**

### Exchange the code for tokens

```bash
curl -X POST https://api.schwabapi.com/v1/oauth/token \
  -H "Authorization: Basic $(echo -n 'YOUR_CLIENT_ID:YOUR_CLIENT_SECRET' | base64)" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=YOUR_CODE&redirect_uri=https://127.0.0.1"
```

Replace:
- `YOUR_CLIENT_ID` — App Key from developer.schwab.com
- `YOUR_CLIENT_SECRET` — App Secret
- `YOUR_CODE` — the code captured from the redirect URL

The response:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 1800,
  "scope": "..."
}
```

Copy the **`refresh_token`** — this is your `SCHWAB_REFRESH_TOKEN`.

> **Refresh tokens expire after 7 days of non-use.** Once the app is running and making requests daily, the refresh token stays active. If you stop the app for more than 7 days, repeat Step 4.

---

## Step 5 — Get Your Encrypted Account Number

With the access token from Step 4, fetch your account list:

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://api.schwabapi.com/trader/v1/accounts/accountNumbers
```

Response:
```json
[
  {
    "accountNumber": "123456789",
    "hashValue": "ABCD1234EFGH5678..."
  }
]
```

Copy the **`hashValue`** — this is your `SCHWAB_ACCOUNT_NUMBER`.

---

## Step 6 — Configure `.env`

```env
SCHWAB_CLIENT_ID=your_app_key_here
SCHWAB_CLIENT_SECRET=your_app_secret_here
SCHWAB_REFRESH_TOKEN=eyJ...long_refresh_token...
SCHWAB_ACCOUNT_NUMBER=ABCD1234EFGH5678...

PORT=3010
NODE_ENV=development
LOG_LEVEL=info
LOG_DIR=./logs
```

---

## Step 7 — Verify

Start the backend and check the account endpoint:

```bash
cd backend && npm run dev
# In another terminal:
curl http://localhost:3010/api/account | jq .
```

Expected response:
```json
{
  "equity": 105000.00,
  "buyingPower": 82000.00,
  "cash": 41000.00,
  "daytradeCount": 0,
  "pendingManualOrders": []
}
```

If you see an error, check the backend logs:
```bash
tail -f backend/logs/turtle-trader-schwab.log | jq .
```

---

## Refresh Token Maintenance

Schwab refresh tokens expire after **7 days of non-use**. As long as the app runs and makes at least one API call per week, the token stays active.

If the token expires:
1. The backend logs will show `401` or token-related errors
2. Repeat Step 4 (browser OAuth flow) to get a new code
3. Exchange it for new tokens via the curl command
4. Update `SCHWAB_REFRESH_TOKEN` in `.env`
5. Restart the backend

---

## API Rate Limits

Schwab enforces the following rate limits per app (as of 2025):

| Endpoint group | Limit |
|----------------|-------|
| Market Data (price history, quotes) | 120 requests/minute |
| Trading (orders, positions) | 120 requests/minute |

With a 200ms sleep between symbols, a 25-symbol watchlist makes ~25 requests per scan phase × 3 phases = ~75 requests, well within limits.

If you see `429 Too Many Requests` errors in the logs, increase the sleep delay in `turtleScannerService.ts` (search for `sleep(200)`).

---

## Paper Trading

Schwab does not offer a sandbox or paper trading environment via their Developer API. To test safely:

1. Keep `DRY_RUN=true` in Settings — the app logs order intentions but never contacts Schwab
2. Watch the Signals page to verify the scanner is evaluating symbols correctly
3. Review the trade history (populated even in dry run mode) to evaluate strategy performance
4. When satisfied, set `DRY_RUN=false` to enable real orders

---

## Security Notes

- Never commit `backend/.env` to git (it's in `.gitignore`)
- Never share your refresh token — it grants full trading access to your account
- Consider restricting which IP addresses can access port 3010 via a firewall
- The Schwab API credentials authorize access only to the account(s) selected during the OAuth flow
- All API communication uses HTTPS; credentials are never transmitted in plaintext
