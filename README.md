# 🐢 Turtle Trader (Schwab)

A fully automated implementation of the classic [Turtle Trading](docs/STRATEGY.md) system, connected to Charles Schwab brokerage via the official Schwab Developer API.

Identical feature set and UI to the original Alpaca-based Turtle Trader — only the broker integration differs.

---

## Features

- **Donchian Channel breakout strategy** — System 1 (20-day) and System 2 (55-day) running simultaneously
- **ATR-based position sizing** — every trade risks an identical dollar amount regardless of price or volatility
- **Pyramiding** — adds up to 4 units as a trend confirms, 0.5N apart
- **Automated daily scanner** — runs at 4pm ET weekdays via cron (configurable)
- **Catch-up scans** — automatically scans on startup if a trading day was missed
- **Two UI themes** — Terminal (dark, monospace) and Classic (light/dark, card-based)
- **Live P&L** — open trades enriched with real-time prices from Schwab
- **Schwab sync** — one-click reconciliation of DB positions vs. live Schwab account
- **Donchian charts** — interactive candlestick charts with System 1/2 channel overlays
- **Dry run mode** — simulates all orders without touching your brokerage account
- **Fidelity fallback** — optional manual order queue for Fidelity users

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, TypeScript, Express |
| Database | SQLite via Prisma ORM |
| Scheduler | node-cron |
| Broker | Charles Schwab Developer API (OAuth2) |
| Market data | Schwab `/pricehistory` endpoint |
| Frontend | React 18, Vite, TailwindCSS |
| Charts | lightweight-charts |
| Ports | Backend **3010**, Frontend **5574** |

---

## Quick Start

### 1. Get Schwab API credentials

Run the interactive setup script — it walks through the full OAuth2 flow and writes `backend/.env` automatically:

```bash
bash scripts/setup-credentials.sh
```

The script will:
1. Prompt for your App Key and App Secret from [developer.schwab.com](https://developer.schwab.com)
2. Print the authorization URL to open in your browser
3. Accept the redirect URL and extract the authorization code
4. Exchange it for tokens via the Schwab token endpoint
5. Fetch your encrypted account number
6. Write `backend/.env` with all four credentials (file created `0600`)

Alternatively, follow the manual walkthrough in **[docs/SCHWAB_SETUP.md](docs/SCHWAB_SETUP.md)**.

### 2. Install and run

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5574**

---

## Documentation

| Document | Description |
|----------|-------------|
| [SCHWAB_SETUP.md](docs/SCHWAB_SETUP.md) | How to obtain Schwab API credentials |
| [USER_GUIDE.md](docs/USER_GUIDE.md) | Complete guide to every feature and screen |
| [STRATEGY.md](docs/STRATEGY.md) | Turtle Trading system explanation |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | All settings reference |
| [API.md](docs/API.md) | REST API reference |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and data flow |
| [INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | Production deployment guide |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Dev setup, testing, project structure |

---

## Project Structure

```
turtle-trader-schwab/
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── schwabClient.ts        # Schwab OAuth2 + trading API
│   │   │   ├── brokerService.ts       # Broker abstraction (Schwab / Fidelity)
│   │   │   ├── marketDataService.ts   # Price history via Schwab
│   │   │   ├── indicatorService.ts    # ATR, Donchian (pure functions)
│   │   │   ├── turtleSignalService.ts # Entry/exit/unit-add signal logic
│   │   │   ├── turtleScannerService.ts# Daily scan orchestration
│   │   │   ├── tradeService.ts        # Trade + unit CRUD
│   │   │   ├── configService.ts       # Settings CRUD
│   │   │   └── statsService.ts        # P&L statistics
│   │   ├── api/routes/                # Express route handlers
│   │   ├── jobs/dailyScan.ts          # node-cron scheduler
│   │   └── utils/                     # Logger, market calendar
│   ├── prisma/schema.prisma           # Database schema
│   └── __tests__/                     # Jest unit tests (42 tests)
├── frontend/
│   └── src/
│       ├── api/client.ts              # Typed API client
│       ├── pages/                     # Dashboard, Trades, Signals, Settings, Help
│       └── components/                # Reusable UI components
├── scripts/
│   └── setup-credentials.sh           # Interactive Schwab OAuth2 setup
└── docs/                              # This documentation
```

---

## License

MIT
