# User Guide

## First Time Setup

1. Follow **[SCHWAB_SETUP.md](SCHWAB_SETUP.md)** to get your API credentials
2. Add credentials to `backend/.env`
3. Start the backend: `cd backend && npm run dev`
4. Start the frontend: `cd frontend && npm run dev`
5. Open **http://localhost:5574**
6. Go to **Settings** and configure your watchlist and risk parameters
7. Run a manual scan in dry run mode to verify everything works
8. Review the Signals tab to see what the scanner evaluated
9. When ready: set `DRY_RUN = Disabled` in Settings to enable live orders

---

## Navigation

The app has two visual themes accessible from any page:

- **Terminal** (default) — dark background, monospace font, sidebar navigation
- **Classic** — light/dark card layout, top navigation bar

Switch between them using the **Classic / Terminal** buttons in the sidebar (Terminal mode) or top-right corner (Classic mode). Your preference is saved in the browser.

Five pages are available:

| Page | Description |
|------|-------------|
| Dashboard | Account overview, scanner control, open trades, latest signals |
| Trades | Full trade history with performance statistics |
| Signals | Complete signal log with filters |
| Settings | All configuration options |
| Help | Quick reference documentation |

---

## Dashboard

The Dashboard is the main operational screen. It refreshes automatically every 30 seconds.

### DRY RUN banner

A yellow banner appears at the top when `DRY_RUN` is enabled. No real orders will be placed while this is active. Disable it in Settings when ready for live trading.

### Account cards

Four metric cards show the current account state pulled from Schwab:

| Card | Source |
|------|--------|
| Portfolio Equity | Schwab account liquidation value |
| Cash | Schwab settled cash balance |
| Total P&L | Realized P&L (from DB) + unrealized P&L (from open positions) |
| Open Positions | Count of open trades in the database |

### Scanner control

The scanner panel shows whether a scan is running and when the last scan completed. Two buttons:

- **Run Scan** — triggers an immediate scan (same as the scheduled 4pm run)
- **Force Scan** is available via the API (`POST /signals/scan` with `{ "force": true }`) to bypass the trading-day check on weekends or holidays

During an active scan, a progress bar shows the current phase (exits / units / entries) and current symbol.

### Daily P&L chart

A 30-day sparkline of cumulative realized P&L. The line is green when the cumulative total is positive, red when negative.

### Open Trades table

Shows all currently open positions with live data from Schwab:

| Column | Description |
|--------|-------------|
| Symbol | Click to open the chart modal for this symbol |
| Side | LONG or SHORT |
| Sys | System 1 or System 2 |
| Units | Current units / max units |
| Entry | Average entry price across all units |
| Stop | Current stop loss level |
| Current | Live price from Schwab |
| Unreal. P&L | Unrealized P&L from Schwab |
| Shares | Total shares across all units |
| Entry Date | Date of the first unit |
| Actions | Close (places broker order) or Mark Closed (DB only, no broker order) |

**Close** — places a market sell order on Schwab and marks the trade closed in the database. A confirmation step is shown before executing.

**Mark Closed** — marks the trade closed in the database without placing any broker order. Use this to reconcile trades that were closed directly in Schwab or your brokerage platform.

### Sync with Schwab button

Compares all open DB trades against live Schwab positions:

- Symbols no longer in Schwab → marked closed in DB (reconciled exit)
- Symbols still in Schwab → entry price synced if it has drifted

Run this after making manual changes in Schwab, or if you suspect the DB and brokerage are out of sync.

### Latest Run Signals

Shows signals from the most recent scan (all signals created within 15 minutes of the newest signal). This gives you a snapshot of what the last scan evaluated and what actions it took.

---

## Terminal Dashboard

The Terminal Dashboard is the dark-mode, data-dense version of the Dashboard. It contains the same information with a different visual design optimised for a secondary monitor or full-screen view.

**SYNC SCHWAB** button in the top-right corner does the same as "Sync with Schwab" in the Classic Dashboard.

The open trades section shows a full table on desktop and collapses to cards on mobile.

---

## Trades Page

Shows the complete trade history with performance statistics.

### Stats bar

Four primary metrics at the top:

- **Total Trades** — all closed trades
- **Win Rate** — percentage of closed trades that were profitable
- **Total P&L** — sum of all realized P&L from closed trades
- **Profit Factor** — gross profit ÷ gross loss. Values > 1 indicate a profitable system

Three secondary metrics below:
- **Avg Win** — average P&L of winning trades
- **Avg Loss** — average P&L of losing trades
- **Avg Hold Days** — average calendar days between entry and exit

### Trade history table

All trades (open and closed) sorted newest first. Click any symbol to open the chart modal for that symbol, showing the Donchian channel context at the time.

Closed trades show:
- Exit date and exit reason (`stop_loss`, `donchian_exit`, `manual`, `reconciled`)
- Realized P&L in dollars and percentage

---

## Signals Page

The Signals page shows the complete history of what the scanner evaluated. Every symbol processed in every scan generates at least one signal record.

### Filters

Filter by:
- **System** — System 1, System 2, or both
- **Direction** — Long, Short, or both
- **Date** — specific scan date (YYYY-MM-DD)

The filter state is reflected in the URL query via the API call, so only matching records are fetched.

### Signal columns

| Column | Description |
|--------|-------------|
| Symbol | Ticker |
| Time | Timestamp when the signal was created |
| Sys | System 1 or 2 |
| Dir | Long or Short |
| Close | Closing price on the scan date |
| N (ATR) | ATR value used for sizing |
| DC Upper | Donchian entry upper channel level |
| DC Lower | Donchian entry lower channel level |
| Criteria | Pass/fail badges for entry, exit, unit-add, stop conditions |
| Action | What the scanner did |

### Action badges

| Badge | Color | Meaning |
|-------|-------|---------|
| Entered | Green | New position opened |
| Unit Added | Blue | Additional unit added to existing position |
| Exited (stop loss) | Orange | Position closed — stop hit |
| Exited (Donchian exit) | Orange | Position closed — Donchian exit |
| No Signal | Gray | No Donchian breakout detected |
| Size Too Small | Amber | Breakout detected but unit size = 0 (account too small for ATR) |
| Insufficient Funds | Red | Breakout detected but not enough buying power |
| Cooldown | Yellow | Symbol in cooldown period after recent exit |

---

## Settings Page

All configuration values are stored in the database and applied on the next scan. Changes take effect immediately — no restart needed.

Save changes with the **Save Changes** button at the top right.

### Key settings to configure first

1. **Watchlist** — add the tickers you want to trade (comma-separated)
2. **Dry Run** — set to `Disabled` when ready for live trading
3. **Broker** — set to `schwab` (default)
4. **Risk % per Unit** — lower this (e.g. 0.5) for a more conservative approach
5. **Scan Schedule** — adjust the cron expression for your server timezone

See [CONFIGURATION.md](CONFIGURATION.md) for the complete reference.

---

## Chart Modal

Click any symbol name (in Open Trades, Trade History, or Dashboard) to open the chart modal.

The chart shows:
- **Candlesticks** — daily OHLCV from Schwab price history (200 bars by default)
- **Entry channel** — dashed blue lines showing the Donchian entry upper and lower levels
- **Exit level** — dotted amber line showing the Donchian exit lower level (for long positions)

Toggle between **System 1** and **System 2** channel overlays using the buttons at the top of the modal.

The chart is interactive:
- Scroll to zoom in/out
- Click and drag to pan
- Hover for crosshair with exact values
- Press Escape or click outside to close

---

## Scan Workflow (Understanding What the Scanner Does)

The scanner runs in three sequential phases every trading day at 4pm ET (or whenever triggered manually).

### Phase 1 — Exit checks
For every open trade, the scanner:
1. Fetches the latest daily bars from Schwab
2. Checks if the stop loss level has been breached (close ≤ stop for longs)
3. Checks if the Donchian exit channel has been breached
4. If either condition is true: closes the position via Schwab and marks the trade closed in the DB

### Phase 2 — Unit addition
For every trade that survived Phase 1:
1. Checks if price has moved enough to add another unit (0.5N above the Unit 1 entry)
2. If yes and buying power is sufficient: places the order and adds a unit to the DB record

### Phase 3 — Entry checks
For every symbol on the watchlist (skipping any already in a position or in cooldown):
1. Checks if the closing price is above the 20-day (System 1) or 55-day (System 2) Donchian upper
2. If yes and the unit size is ≥ 1 share and buying power is sufficient: opens a new position

Each phase writes Signal records to the DB regardless of the outcome — these are visible in the Signals page.

---

## Manual Order Mode (Fidelity)

Set `BROKER = fidelity` in Settings to switch to manual order mode. When the scanner wants to place an order:
- It queues a `PendingManualOrder` in memory
- The Dashboard shows a yellow **Pending Manual Orders** panel
- Each pending order shows the exact instructions: *"Place a BUY market order for 25 shares of AAPL in your Fidelity account."*
- After you execute the order manually, use **Mark Closed** (for exits) or the sync endpoint to update the database

Note: Account equity is not available in Fidelity mode. The scanner uses $0 for account lookups, so set `MIN_EQUITY=0` to prevent the equity check from blocking scans.

---

## Troubleshooting

### "Scanner already running" error
A previous scan is still in progress. Wait for it to finish or use the **Stop** button. If it appears stuck, restart the backend.

### Trades show no current price
Schwab credential error — check that your refresh token is valid and the account number is correct. View backend logs for the specific error.

### Unit size is always 0
Your account equity is too small relative to the stock's ATR. Either increase equity, reduce the risk percentage, or add lower-ATR symbols to the watchlist.

### Scan runs but finds no entries
Normal behavior. The scanner only enters on confirmed Donchian breakouts. During range-bound markets, there may be no breakouts for days or weeks. Check the Signals page to confirm the scanner ran and evaluated symbols.

### Schwab token expired
Schwab refresh tokens expire after 7 days of non-use. If the backend logs show token refresh errors, follow the re-authorization steps in [SCHWAB_SETUP.md](SCHWAB_SETUP.md).
