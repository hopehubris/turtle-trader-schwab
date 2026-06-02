# 🐢 Turtle Trader (Schwab)

Donchian Channel breakout bot implementing classic Turtle Trading methodology, powered by Charles Schwab brokerage.

Identical feature set and UI to the Alpaca-based Turtle Trader — only the broker integration differs.

## Stack

- **Backend**: Node.js / TypeScript / Express / Prisma / SQLite
- **Frontend**: React / Vite / TailwindCSS / lightweight-charts
- **Broker**: Charles Schwab Developer API (OAuth2)
- **Ports**: Backend 3010, Frontend 5574

## Setup

### 1. Schwab API Credentials

Obtain credentials from [developer.schwab.com](https://developer.schwab.com):

```
SCHWAB_CLIENT_ID=your-client-id
SCHWAB_CLIENT_SECRET=your-client-secret
SCHWAB_REFRESH_TOKEN=your-refresh-token
SCHWAB_ACCOUNT_NUMBER=your-account-number
```

Copy to `backend/.env` (see `backend/.env.example`).

### 2. Run

```bash
# Backend
cd backend && npm install && npx prisma migrate dev && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Frontend: http://localhost:5574  
Backend API: http://localhost:3010/api/health

## Strategy

- **System 1**: 20-day Donchian breakout entry, 10-day exit
- **System 2**: 55-day Donchian breakout entry, 20-day exit
- **Position sizing**: ATR-based unit sizing (1% equity risk per unit)
- **Pyramiding**: Up to 4 units at 0.5N increments
- **Stop losses**: 2N trailing stops

## Features

- Automated daily scanner (4pm ET weekdays, configurable cron)
- Classic and Terminal view modes
- Real-time open trade monitoring with live P&L from Schwab
- Schwab position sync and exit reconciliation
- Donchian channel charts with System 1/2 overlays
- Full trade history with performance stats
- Dry run mode for paper trading simulation
- Fidelity manual order queue as secondary broker option
