# System Architecture

## Overview

Turtle Trader (Schwab) is a two-process application: a Node.js/TypeScript backend that holds all trading logic and a React frontend that provides the UI. They communicate exclusively through a REST API.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (5574)                        │
│  ┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │  Dashboard  │  │  Trades  │  │ Signals  │  │Settings │  │
│  └──────┬──────┘  └────┬─────┘  └────┬─────┘  └────┬────┘  │
│         └──────────────┴─────────────┴──────────────┘       │
│                         Axios /api/*                         │
└─────────────────────────────┬───────────────────────────────┘
                               │ HTTP
┌─────────────────────────────▼───────────────────────────────┐
│                    Express Server (3010)                      │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │                   API Router                         │     │
│  │  /account  /trades  /signals  /charts  /config       │     │
│  │  /stats    /health                                   │     │
│  └────────────────────┬────────────────────────────────┘     │
│                       │                                       │
│  ┌────────────────────▼────────────────────────────────┐     │
│  │               Service Layer                          │     │
│  │                                                      │     │
│  │  turtleScannerService  ←── node-cron (daily 4pm)    │     │
│  │       ↓         ↓                                   │     │
│  │  brokerService  turtleSignalService                  │     │
│  │       ↓              ↓                              │     │
│  │  schwabClient    indicatorService                   │     │
│  │  fidelityClient  (pure functions)                   │     │
│  │                                                      │     │
│  │  tradeService  configService  statsService           │     │
│  └────────────────────┬────────────────────────────────┘     │
│                       │                                       │
│  ┌────────────────────▼────────────────────────────────┐     │
│  │              Prisma ORM → SQLite                     │     │
│  │   Trade  TradeUnit  Signal  Config  DailyPnL         │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────┬───────────────────────────────┘
                               │ HTTPS (OAuth2)
┌─────────────────────────────▼───────────────────────────────┐
│                  Charles Schwab APIs                          │
│  api.schwabapi.com/v1/oauth/token    (token refresh)         │
│  api.schwabapi.com/trader/v1/        (orders, positions)      │
│  api.schwabapi.com/marketdata/v1/    (price history, quotes)  │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Service Layer

Each service has a single, well-defined responsibility.

### `schwabClient.ts`
OAuth2 client for the Schwab Developer API. Manages token refresh automatically (tokens expire every 30 minutes). Exposes methods matching the shapes expected by `brokerService`.

Key methods:
- `getAccount()` → account balances
- `getPositions()` → live positions
- `getBars(symbol, limit)` → 2-year daily price history
- `placeOrderQty(symbol, qty, side)` → market order by share count
- `closePosition(symbol)` → sell all shares of a position
- `getLatestPrices(symbols)` → real-time quotes (used for notional order sizing)
- `waitForFill(orderId, timeoutMs)` → poll until order fills

Token refresh uses the OAuth2 `refresh_token` grant. The access token is cached in memory; a refresh is triggered automatically when it is within 60 seconds of expiry.

### `brokerService.ts`
Abstraction layer over `schwabClient` and `fidelityClient`. All scanner code calls `brokerService` — it never calls `schwabClient` directly. This isolates broker-specific logic and makes dry-run mode trivial to implement.

When `DRY_RUN=true`, every order method returns a synthetic order object (`dry-buy-*`, `dry-sell-*`) without contacting any broker.

When `BROKER=fidelity`, orders are queued as `PendingManualOrder` objects. The user sees instructions in the UI and executes them manually.

### `indicatorService.ts`
Pure functions — no I/O, no side effects, no dependencies. Contains ATR (Wilder's smoothing), Donchian Upper/Lower (high/low and close variants), breakout detection, and unit size calculation.

These functions are tested directly via Jest without any mocking.

### `turtleSignalService.ts`
Evaluates entry, exit, and unit-add signals given bars and configuration. Also pure — takes bars and config as input, returns signal objects. No database calls, no broker calls.

Three evaluation functions:
- `evaluateEntries(symbol, bars, cfg, equity)` → `EntrySignal[]`
- `evaluateExit(symbol, bars, cfg, system, direction, currentStop)` → `ExitSignal`
- `evaluateUnitAdd(bars, cfg, direction, unit1Entry, unit1Atr, unitCount, equity)` → `UnitAddSignal`

### `turtleScannerService.ts`
Orchestrates the daily scan in three sequential phases:

```
Phase 1 — Exit checks
  For each open trade:
    fetch bars → evaluateExit → if shouldExit → closeFullPosition + closeTrade
    always write Signal record (for audit trail)

Phase 2 — Unit addition checks
  For each remaining open trade:
    fetch bars → evaluateUnitAdd → if shouldAdd → placeBuyOrder/placeSellOrder + addUnit
    write Signal record

Phase 3 — Entry checks
  For each watchlist symbol:
    skip if: open position exists, in cooldown, max positions reached
    fetch bars → evaluateEntries → for each signal:
      if canEnter and buying power sufficient → placeBuyOrder/placeSellOrder + openTrade
    write Signal record (one per system, regardless of action taken)
```

The scanner sleeps 200ms between symbols to respect API rate limits.

### `tradeService.ts`
CRUD for `Trade` and `TradeUnit` records. Handles the atomic operations required for unit addition (updating all existing stops in the same transaction as creating the new unit).

### `configService.ts`
Key-value store backed by the `Config` table. Merges database values with hardcoded defaults so all keys always have a value. The scanner reads config fresh on every run.

### `statsService.ts`
Computes aggregate statistics (win rate, profit factor, average hold days, etc.) from closed trade records. Also writes daily equity snapshots to the `DailyPnL` table.

---

## Database Schema

```
Trade
  id           PK autoincrement
  symbol       TEXT
  side         TEXT  (long | short)
  system       INT   (1 | 2)
  status       TEXT  (open | closed)
  broker       TEXT  (schwab | fidelity | manual)
  entryDate    TEXT  (YYYY-MM-DD)
  exitDate     TEXT?
  exitReason   TEXT? (stop_loss | donchian_exit | manual | reconciled)
  exitPrice    REAL?
  unitCount    INT   (1–4)
  currentStop  REAL
  totalShares  REAL  (sum of all units)
  avgEntryPrice REAL (weighted average)
  dollarAmount  REAL (total cost basis)
  pnl          REAL? (calculated on close)
  pnlPct       REAL?

TradeUnit
  id           PK autoincrement
  tradeId      FK → Trade.id (CASCADE DELETE)
  unitNumber   INT   (1–4)
  entryDate    TEXT
  entryPrice   REAL
  shares       REAL
  atrAtEntry   REAL  (N at the time of unit entry)
  stopLoss     REAL  (stop at the time of unit entry)
  status       TEXT  (open | closed | stopped)

Signal
  id           PK autoincrement
  symbol       TEXT
  scanDate     TEXT
  system       INT
  direction    TEXT
  close        REAL?
  dcEntryUpper REAL?
  dcEntryLower REAL?
  dcExitLower  REAL?
  dcExitUpper  REAL?
  atrValue     REAL?
  entryBreakout BOOL
  exitBreakout  BOOL
  unitAddSignal BOOL
  stopTriggered BOOL
  actionTaken   TEXT

Config
  key     TEXT UNIQUE
  value   TEXT

DailyPnL
  date                TEXT UNIQUE  (YYYY-MM-DD)
  equity              REAL
  dailyPnl            REAL
  cumulativePnl       REAL
  openPositionsCount  INT
```

Every scan writes one `Signal` row per symbol per enabled system, regardless of whether an action was taken. This creates a complete audit trail.

---

## Frontend Architecture

The frontend is a single-page React application with client-side routing.

```
App.tsx
├── ThemeProvider          (classic | terminal theme)
├── BrowserRouter
│   ├── Terminal layout (dark sidebar + main)
│   │   ├── TerminalSidebar
│   │   └── Routes
│   │       ├── / → TerminalDashboard
│   │       ├── /trades → Trades
│   │       ├── /signals → Signals
│   │       ├── /settings → Settings
│   │       └── /help → Help
│   └── Classic layout (top nav + max-width container)
│       └── Routes (same pages → Dashboard instead of TerminalDashboard)
```

### Data fetching

All API calls are centralised in `src/api/client.ts`. Every function is fully typed with TypeScript interfaces. Components never call `fetch` or `axios` directly.

Pages use `usePolling(fn, intervalMs)` to auto-refresh data. The polling hook calls the provided function immediately on mount, then on the specified interval. Polling is suspended when the component unmounts.

### Theme system

Theme is stored in `localStorage` under key `tt-theme`. The `ThemeProvider` persists the choice across page reloads. When terminal theme is active, `class="dark terminal"` is added to `<html>`.

Classic theme uses Tailwind utility classes. Terminal theme overrides with inline styles for fine-grained control over the monospace aesthetic.

---

## Schwab API Integration

The Schwab Developer API uses OAuth2. The app uses the `refresh_token` grant only — it never handles the initial authorization flow (that must be done once manually, see `docs/SCHWAB_SETUP.md`).

```
Startup / any API call:
  1. Check if access_token exists and expires_in > 60s
  2. If not: POST /v1/oauth/token with refresh_token grant
  3. Cache new access_token + expiry in memory
  4. Attach Authorization: Bearer <token> to every request

Token lifecycle:
  - Access tokens expire after 30 minutes
  - Refresh tokens expire after 7 days (must re-auth if not used)
  - The app refreshes the access token automatically; the refresh token must be rotated manually
```

The two Schwab base URLs used:
- `https://api.schwabapi.com/trader/v1` — account, orders, positions
- `https://api.schwabapi.com/marketdata/v1` — price history, quotes

---

## Scan Data Flow (detailed)

```
node-cron fires (or POST /signals/scan)
  │
  ▼
turtleScannerService.runDailyScan()
  │
  ├── isTradingDay(today) → if false and !force → return early
  │
  ├── getConfig() → parse TurtleConfig
  │
  ├── brokerService.getAccount() → equity, buyingPower
  │
  ├── PHASE 1: exits
  │   └── for each open Trade:
  │       ├── getBarsForSymbol(symbol) → schwabClient.getBars()
  │       ├── turtleSignalService.evaluateExit()
  │       ├── if shouldExit:
  │       │   ├── brokerService.closeFullPosition() → schwabClient.closePosition()
  │       │   └── tradeService.closeTrade() → DB update
  │       └── prisma.signal.create() (always — audit trail)
  │
  ├── PHASE 2: unit adds
  │   └── for each open Trade (refreshed):
  │       ├── getBarsForSymbol(symbol)
  │       ├── turtleSignalService.evaluateUnitAdd()
  │       ├── if shouldAdd:
  │       │   ├── brokerService.placeBuyOrder/placeSellOrder() → schwabClient.placeOrderQty()
  │       │   └── tradeService.addUnit() → DB insert + update stops
  │       └── prisma.signal.create()
  │
  └── PHASE 3: entries
      └── for each watchlist symbol:
          ├── skip if: hasOpenPosition, isInCooldown, maxPositions reached
          ├── getBarsForSymbol(symbol)
          ├── turtleSignalService.evaluateEntries()
          ├── for each EntrySignal:
          │   ├── if canEnter and buying power >= cost:
          │   │   ├── brokerService.placeBuyOrder/placeSellOrder()
          │   │   └── tradeService.openTrade() → DB insert
          │   └── prisma.signal.create()
          └── LAST_SCAN_RUN → configService.setConfig()
```

---

## Key Design Decisions

### Pure signal functions
`indicatorService` and `turtleSignalService` are free of side effects. They receive data as arguments and return results. This makes them trivially testable — no mocking required, no database seeding. The 42 unit tests cover these layers exclusively.

### Broker abstraction
`brokerService` is the only module that knows about the active broker. The scanner calls `placeBuyOrder`, `closeFullPosition`, etc. — it never imports `schwabClient` directly. Swapping brokers requires changes only in `brokerService` and `schwabClient`/`fidelityClient`.

### Signal audit trail
Every symbol scanned writes a `Signal` row, even when no action is taken. This creates a queryable history of what the scanner evaluated and why it acted (or didn't). The Signals page in the UI reads this table.

### SQLite
No external database server. The entire trade history fits in a single file (`prisma/dev.db`). Prisma handles migrations. Back up by copying the file.

### Dry run
`DRY_RUN=true` is the default. All order methods in `brokerService` short-circuit before contacting Schwab when dry run is on. Trades are still written to the DB so the full flow can be tested and reviewed before going live.
