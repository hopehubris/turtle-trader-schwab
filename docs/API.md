# REST API Reference

Base URL: `http://localhost:3010/api`

All responses are JSON. All requests with a body use `Content-Type: application/json`.

No authentication is required — the API is intended for local use only. Do not expose it to the public internet without adding authentication middleware.

---

## Health

### `GET /health`

Service liveness check.

**Response**
```json
{
  "status": "ok",
  "timestamp": "2026-06-02T20:00:00.000Z"
}
```

---

## Account

### `GET /account`

Returns the Schwab account balances and any pending manual orders (Fidelity broker mode).

**Response**
```json
{
  "equity": 105420.50,
  "buyingPower": 82000.00,
  "cash": 41000.00,
  "daytradeCount": 0,
  "pendingManualOrders": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `equity` | number | Total liquidation value of the account |
| `buyingPower` | number | Available buying power |
| `cash` | number | Settled cash balance |
| `daytradeCount` | number | Number of day trades in the rolling 5-day window |
| `pendingManualOrders` | array | Orders queued for manual execution (Fidelity mode) |

**Pending manual order shape**
```json
{
  "id": "manual-1717372800000-AAPL",
  "symbol": "AAPL",
  "side": "buy",
  "qty": 25,
  "type": "market",
  "createdAt": "2026-06-02T20:00:00.000Z",
  "instructions": "Place a BUY market order for 25 shares of AAPL in your Fidelity account."
}
```

---

## Trades

### `GET /trades`

All trades (open and closed), most recent first. Maximum 500 returned.

**Response** — array of Trade objects (see schema below).

---

### `GET /trades/open`

Open trades enriched with live data from Schwab: current price, unrealized P&L, and current ATR (N).

**Response** — array of enriched Trade objects with additional fields:

| Field | Type | Description |
|-------|------|-------------|
| `currentPrice` | number \| null | Live last price from Schwab |
| `unrealizedPnl` | number \| null | Unrealized P&L from Schwab position |
| `currentN` | number \| null | Current ATR value for stop reference |

---

### `GET /trades/:id`

Single trade with all units.

**Path params:** `id` — integer trade ID

**Response** — Trade object with `units` array.

**Errors**
- `400 Bad Request` — invalid ID
- `404 Not Found` — trade not found

---

### `DELETE /trades/:id`

Close a trade: places a market sell order on Schwab and marks it closed in the database.

**Path params:** `id` — integer trade ID

**Response**
```json
{ "success": true, "tradeId": 12 }
```

**Errors**
- `404 Not Found` — trade not found
- `409 Conflict` — trade is not open

---

### `POST /trades/:id/mark-closed`

Mark a trade closed in the database **without** placing a broker order. Useful for reconciling trades that were manually closed in Schwab.

**Path params:** `id` — integer trade ID

**Body** (optional)
```json
{ "exitPrice": 185.50 }
```

If `exitPrice` is omitted, the current Schwab position price is used. If that also fails, the average entry price is used as a fallback.

**Response**
```json
{ "success": true, "tradeId": 12, "exitPrice": 185.50 }
```

---

### `POST /trades/sync-prices`

Sync average entry prices for all open trades from Schwab position data. Useful after partial fills or price adjustments.

**Response**
```json
{
  "synced": [
    { "symbol": "AAPL", "oldPrice": 182.00, "newPrice": 182.35 }
  ],
  "count": 1
}
```

---

### `POST /trades/sync`

Full reconciliation with Schwab:

1. Compares all open DB trades against live Schwab positions
2. Closes any DB trade whose symbol is no longer in Schwab (position was closed externally)
3. Syncs entry prices for positions still open

**Response**
```json
{
  "entriesSynced": [
    { "symbol": "MSFT", "oldPrice": 410.00, "newPrice": 410.25 }
  ],
  "entriesCount": 1,
  "exitsReconciled": [
    { "symbol": "TSLA", "exitPrice": 245.00 }
  ],
  "exitsCount": 1,
  "schwabPositions": 4,
  "dbOpenTrades": 5
}
```

---

### `POST /trades/import-csv`

Parse a Fidelity positions CSV export. Does not create trades — returns the parsed data for review.

**Body**
```json
{ "csv": "Symbol,Quantity,Last Price,Cost Basis Per Share,Unrealized Gain/Loss\nAAPL,100,$185.00,$172.00,$1300.00" }
```

**Response**
```json
{
  "parsed": [
    {
      "symbol": "AAPL",
      "shares": 100,
      "avgCost": 172.0,
      "currentValue": 18500.0,
      "unrealizedPnl": 1300.0,
      "side": "long"
    }
  ],
  "count": 1
}
```

---

## Trade Object Schema

```json
{
  "id": 12,
  "symbol": "AAPL",
  "side": "long",
  "system": 1,
  "status": "open",
  "broker": "schwab",
  "entryDate": "2026-05-15",
  "exitDate": null,
  "exitReason": null,
  "exitPrice": null,
  "unitCount": 2,
  "currentStop": 178.50,
  "totalShares": 50,
  "avgEntryPrice": 182.35,
  "dollarAmount": 9117.50,
  "pnl": null,
  "pnlPct": null,
  "notes": null,
  "createdAt": "2026-05-15T20:05:00.000Z",
  "updatedAt": "2026-05-20T20:05:00.000Z",
  "units": [
    {
      "id": 23,
      "tradeId": 12,
      "unitNumber": 1,
      "entryDate": "2026-05-15",
      "entryPrice": 180.00,
      "shares": 25,
      "atrAtEntry": 2.80,
      "stopLoss": 178.50,
      "status": "open",
      "createdAt": "2026-05-15T20:05:00.000Z"
    },
    {
      "id": 24,
      "tradeId": 12,
      "unitNumber": 2,
      "entryDate": "2026-05-20",
      "entryPrice": 181.40,
      "shares": 25,
      "atrAtEntry": 2.80,
      "stopLoss": 178.50,
      "status": "open",
      "createdAt": "2026-05-20T20:05:00.000Z"
    }
  ]
}
```

---

## Signals

### `GET /signals`

Recent scan signals.

**Query params**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | 100 | Maximum signals to return |
| `date` | string | — | Filter by scan date (YYYY-MM-DD) |
| `system` | integer | — | Filter by system (1 or 2) |
| `direction` | string | — | Filter by direction (`long` or `short`) |

**Response** — array of Signal objects (see schema below).

---

### `POST /signals/scan`

Trigger a manual scan immediately.

**Body**
```json
{ "force": false }
```

Set `force: true` to bypass the trading-day check and run on weekends or holidays.

**Response** — ScanResult object (see schema below).

---

### `GET /signals/scan/status`

Whether the scanner is currently running and when it last ran.

**Response**
```json
{
  "isRunning": false,
  "lastRun": "2026-06-02T20:05:23.000Z",
  "nextRun": "Scheduled via SCAN_CRON config (default: 4pm weekdays)"
}
```

---

### `GET /signals/scan/progress`

Live progress during an active scan. Poll this at 1–2 second intervals when a scan is running.

**Response**
```json
{
  "phase": "entries",
  "currentSymbol": "NVDA",
  "symbolsDone": 12,
  "symbolsTotal": 25,
  "stopped": false,
  "stoppedReason": null
}
```

| Field | Values | Description |
|-------|--------|-------------|
| `phase` | `idle`, `exits`, `units`, `entries`, `done` | Current scan phase |
| `currentSymbol` | string \| null | Symbol being processed |
| `stopped` | boolean | Whether a stop was requested |
| `stoppedReason` | `"user"` \| null | Why the scan stopped early |

---

### `POST /signals/scan/stop`

Request graceful stop of the active scan. The scanner will halt after completing the current symbol.

**Response**
```json
{ "stopped": true }
```

---

## Signal Object Schema

```json
{
  "id": 445,
  "symbol": "NVDA",
  "scanDate": "2026-06-02",
  "system": 1,
  "direction": "long",
  "close": 875.40,
  "dcEntryUpper": 870.00,
  "dcEntryLower": 810.00,
  "dcExitLower": 835.00,
  "dcExitUpper": null,
  "atrValue": 18.50,
  "entryBreakout": true,
  "exitBreakout": false,
  "unitAddSignal": false,
  "stopTriggered": false,
  "actionTaken": "entered",
  "createdAt": "2026-06-02T20:05:01.000Z"
}
```

**`actionTaken` values**

| Value | Description |
|-------|-------------|
| `entered` | Breakout confirmed, position opened |
| `no_signal` | No Donchian breakout detected |
| `no_signal_size` | Breakout detected but unit size rounds to 0 |
| `no_funds` | Breakout detected but insufficient buying power |
| `skipped_cooldown` | Symbol in cooldown period |
| `unit_N_added` | Unit N added to existing position |
| `exit_evaluated` | Exit check run, no exit triggered |
| `exited_stop_loss` | Position closed — stop hit |
| `exited_donchian_exit` | Position closed — Donchian exit |

---

## ScanResult Object Schema

```json
{
  "date": "2026-06-02",
  "tradingDay": true,
  "symbolsScanned": 25,
  "entriesOpened": 2,
  "unitsAdded": 1,
  "exitsExecuted": 0,
  "skipped": ["TSLA:cooldown", "AMZN:open_position"],
  "errors": []
}
```

---

## Charts

### `GET /charts/:symbol`

OHLCV bars and pre-computed Donchian indicator arrays for a symbol. Used by the chart modal.

**Path params:** `symbol` — uppercase ticker (e.g. `AAPL`)

**Query params**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | 200 | Number of bars to return |

**Response**
```json
{
  "symbol": "AAPL",
  "bars": [
    { "t": "2026-06-02", "o": 185.00, "h": 187.50, "l": 184.20, "c": 186.80, "v": 52000000 }
  ],
  "indicators": {
    "atr": [null, null, 2.4, 2.5, ...],
    "sys1Upper": [null, ..., 190.00, 190.50],
    "sys1Lower": [null, ..., 172.00, 172.00],
    "sys1ExitLower": [null, ..., 178.00, 178.50],
    "sys2Upper": [null, ..., 195.00, 195.00],
    "sys2Lower": [null, ..., 165.00, 165.00],
    "sys2ExitLower": [null, ..., 174.00, 174.00]
  },
  "config": {
    "sys1Entry": 20,
    "sys1Exit": 10,
    "sys2Entry": 55,
    "sys2Exit": 20,
    "atrPeriod": 14
  }
}
```

Indicator arrays are the same length as `bars`. Values are `null` for the warm-up period before enough bars exist to compute the indicator.

---

## Config

### `GET /config`

All configuration values as a flat key-value object. Unknown keys from the database are included; missing keys are filled from defaults.

**Response**
```json
{
  "WATCHLIST": "AAPL,MSFT,NVDA",
  "SYS1_ENTRY_PERIOD": "20",
  "BROKER": "schwab",
  "DRY_RUN": "true",
  ...
}
```

---

### `PUT /config`

Update one or more configuration keys. Partial updates are supported — omitted keys are left unchanged.

**Body**
```json
{
  "WATCHLIST": "AAPL,MSFT,TSLA,NVDA",
  "DRY_RUN": "false"
}
```

**Response** — complete updated config object (same shape as `GET /config`).

---

## Stats

### `GET /stats`

Aggregate performance statistics across all closed trades.

**Response**
```json
{
  "totalTrades": 58,
  "openTrades": 4,
  "closedTrades": 54,
  "winRate": 37.0,
  "totalPnl": 18420.50,
  "avgWin": 1240.00,
  "avgLoss": -315.00,
  "largestWin": 8200.00,
  "largestLoss": -680.00,
  "avgHoldDays": 21.4,
  "profitFactor": 1.85
}
```

| Field | Description |
|-------|-------------|
| `winRate` | Percentage of closed trades with positive P&L |
| `profitFactor` | Gross profit ÷ gross loss. Values > 1 are profitable |
| `avgHoldDays` | Average calendar days between entry and exit |

---

### `GET /stats/daily-pnl`

Daily P&L snapshots for charting.

**Query params:** `days` (default: 30)

**Response**
```json
[
  {
    "date": "2026-06-02",
    "dailyPnl": 420.50,
    "cumulativePnl": 18420.50,
    "equity": 118420.50
  }
]
```

Ordered oldest → newest. `cumulativePnl` is cumulative from the first recorded snapshot.
