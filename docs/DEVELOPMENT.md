# Development Guide

## Prerequisites

- Node.js 18+ (`node --version`)
- npm 9+ (`npm --version`)
- Git

---

## Initial Setup

```bash
git clone https://github.com/YOUR_USERNAME/turtle-trader-schwab.git
cd turtle-trader-schwab

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your Schwab credentials (see docs/SCHWAB_SETUP.md)
npx prisma migrate dev --name init
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5574  
Backend API: http://localhost:3010/api/health

---

## Environment Variables

`backend/.env`:

```env
SCHWAB_CLIENT_ID=your-client-id
SCHWAB_CLIENT_SECRET=your-client-secret
SCHWAB_REFRESH_TOKEN=your-refresh-token
SCHWAB_ACCOUNT_NUMBER=your-account-number

PORT=3010
NODE_ENV=development
LOG_LEVEL=info
LOG_DIR=./logs
```

All Schwab credential fields are required for live mode. With `DRY_RUN=true` (the default), the app works without credentials — the scanner will error on the first broker call but trades are still written to the DB.

---

## Project Structure

```
turtle-trader-schwab/
├── backend/
│   ├── src/
│   │   ├── index.ts                   # Express server entry, bootstrap
│   │   ├── api/
│   │   │   ├── index.ts               # Router aggregation
│   │   │   └── routes/
│   │   │       ├── account.ts         # GET /account
│   │   │       ├── trades.ts          # CRUD + sync endpoints
│   │   │       ├── signals.ts         # Scan trigger + results
│   │   │       ├── charts.ts          # OHLCV + indicators
│   │   │       ├── config.ts          # Settings CRUD
│   │   │       └── stats.ts           # Performance stats
│   │   ├── services/
│   │   │   ├── schwabClient.ts        # Schwab OAuth2 API client
│   │   │   ├── fidelityClient.ts      # Fidelity manual order queue
│   │   │   ├── brokerService.ts       # Broker abstraction layer
│   │   │   ├── marketDataService.ts   # Price history wrapper
│   │   │   ├── indicatorService.ts    # ATR, Donchian (pure functions)
│   │   │   ├── turtleSignalService.ts # Signal evaluation (pure)
│   │   │   ├── turtleScannerService.ts# Daily scan orchestration
│   │   │   ├── tradeService.ts        # Trade + unit CRUD
│   │   │   ├── configService.ts       # Key-value config CRUD
│   │   │   └── statsService.ts        # P&L aggregation
│   │   ├── jobs/
│   │   │   └── dailyScan.ts           # node-cron scheduler
│   │   ├── db/
│   │   │   └── prisma.ts              # PrismaClient singleton
│   │   └── utils/
│   │       ├── logger.ts              # Winston logger
│   │       └── marketCalendar.ts      # Trading day detection
│   ├── __tests__/
│   │   ├── indicatorService.test.ts   # ATR, Donchian, breakout tests
│   │   ├── turtleSignalService.test.ts# Entry/exit/unit-add tests
│   │   └── tradeService.test.ts       # DB CRUD tests
│   ├── prisma/
│   │   ├── schema.prisma              # Database schema
│   │   └── migrations/                # Migration history
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    # Root — routing + layout
│   │   ├── api/client.ts              # Typed API client (all endpoints)
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx          # Classic dashboard
│   │   │   ├── TerminalDashboard.tsx  # Terminal-theme dashboard
│   │   │   ├── Trades.tsx             # Trade history + stats
│   │   │   ├── Signals.tsx            # Signal log
│   │   │   ├── Settings.tsx           # Config editor
│   │   │   └── Help.tsx               # Documentation
│   │   ├── components/
│   │   │   ├── AccountCard.tsx        # Equity/cash/P&L cards
│   │   │   ├── OpenTradesTable.tsx    # Live open positions
│   │   │   ├── TradeHistoryTable.tsx  # Closed trade history
│   │   │   ├── SignalTable.tsx        # Filterable signal log
│   │   │   ├── TradeChartModal.tsx    # Candlestick chart modal
│   │   │   ├── DailyPnLChart.tsx      # Cumulative P&L chart (Recharts)
│   │   │   ├── ScannerStatus.tsx      # Scanner status + trigger button
│   │   │   └── ScanProgress.tsx       # Live scan progress bar
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx        # Classic/Terminal theme state
│   │   └── hooks/
│   │       └── usePolling.ts          # Auto-refresh polling hook
│   ├── vite.config.ts                 # Port 5574, proxy /api → 3010
│   └── package.json
└── docs/                              # Documentation
```

---

## Scripts

### Backend

```bash
npm run dev        # ts-node-dev with hot reload (development)
npm run build      # Compile TypeScript to dist/
npm start          # Run compiled dist/index.js (production)
npm test           # Jest unit tests
npm test -- --watch      # Watch mode
npm test -- --coverage   # Coverage report
npm run prisma:migrate   # Apply new migrations
npm run prisma:generate  # Regenerate Prisma Client
```

### Frontend

```bash
npm run dev        # Vite dev server (HMR, port 5574)
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
npm run typecheck  # TypeScript check without emit
```

---

## Running Tests

```bash
cd backend
npm test
```

```
PASS __tests__/indicatorService.test.ts
PASS __tests__/turtleSignalService.test.ts
PASS __tests__/tradeService.test.ts

Tests: 42 passed, 42 total
```

Tests cover:
- **indicatorService**: ATR calculation, Donchian upper/lower (bars and closes), breakout detection, unit size calculation, stop loss calculation
- **turtleSignalService**: Entry evaluation (System 1 and 2), exit evaluation (stop loss and Donchian), unit add evaluation (threshold logic, max units)
- **tradeService**: openTrade, addUnit (avg price recalculation, stop propagation), closeTrade (P&L calculation)

`tradeService` tests use the real SQLite database (a test database is created automatically by Prisma from the schema). There is no mocking of database calls.

---

## Database

```bash
# Interactive SQLite shell
sqlite3 backend/prisma/dev.db

# Common queries
sqlite3 backend/prisma/dev.db "SELECT * FROM Trade WHERE status='open';"
sqlite3 backend/prisma/dev.db "SELECT COUNT(*), actionTaken FROM Signal GROUP BY actionTaken;"
sqlite3 backend/prisma/dev.db "SELECT * FROM Trade ORDER BY createdAt DESC LIMIT 10;"

# Reset all data (keeps schema)
cd backend && npx prisma migrate reset

# Apply new migration after schema change
cd backend && npx prisma migrate dev --name describe_your_change
```

---

## Adding a New Config Key

1. Add the key and default to `DEFAULTS` in `configService.ts`
2. Add the field to `FIELD_GROUPS` in `frontend/src/pages/Settings.tsx`
3. Use `getConfigValue('YOUR_KEY')` in any service

No migration required — config is stored as key-value rows in the `Config` table.

---

## Key Design Decisions

### No mocking of the broker in tests
Unit tests cover only pure functions (indicators, signal logic) and the trade service (which hits a real test DB). The broker layer is not tested via unit tests — it's validated by running the application in dry run mode.

### 200ms sleep between symbols
`turtleScannerService` sleeps 200ms between symbol fetches to respect Schwab's API rate limits. The Schwab Market Data API has a default rate limit of 120 requests/minute per OAuth app. At 200ms per symbol, 25 symbols take approximately 5 seconds.

### Separate `marketDataService` wrapper
`marketDataService.ts` is a thin wrapper around `schwabClient.getBars()`. This exists so the charts route and scanner can both import from `marketDataService` without importing `schwabClient` directly — maintaining the same separation used in `brokerService`.

### SQLite over PostgreSQL
SQLite requires no external process, no connection string, no infrastructure. The trade data is small (thousands of rows), writes are infrequent (once per day per symbol), and reads are local. The single-writer model is fine for this use case.

### Vite proxy
`vite.config.ts` proxies all `/api/*` requests to `http://localhost:3010`. The frontend never has hardcoded backend URLs — it always calls `/api/...` relative to its own origin. This makes the production nginx config trivial (proxy `/api/` to the backend, serve everything else as static files).

---

## Logs

Logs are written to `backend/logs/turtle-trader-schwab.log` in newline-delimited JSON. Each line is a structured log event.

```bash
# Stream live logs
tail -f backend/logs/turtle-trader-schwab.log | jq .

# Filter for errors
cat backend/logs/turtle-trader-schwab.log | jq 'select(.level == "error")'

# View scan results
cat backend/logs/turtle-trader-schwab.log | jq 'select(.msg == "Daily scan complete") | .result'
```

---

## TypeScript

Both backend and frontend use strict TypeScript. Check types without building:

```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

Both should produce no output (zero errors) on a clean checkout.
