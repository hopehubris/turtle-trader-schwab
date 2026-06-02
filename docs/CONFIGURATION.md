# Configuration Reference

All settings are stored in the SQLite database and managed through the **Settings** page or the `PUT /api/config` endpoint. Changes take effect on the next scan — no restart required.

---

## Watchlist

| Key | Default | Description |
|-----|---------|-------------|
| `WATCHLIST` | `""` | Comma-separated tickers to monitor. Example: `AAPL,MSFT,NVDA,XOM,GLD` |

**Tips:**
- Include 15–50 symbols for best results. Too few = missed trends. Too many = slow scans.
- Diversify across sectors (tech, energy, commodities, bonds via ETFs) to find uncorrelated trends.
- ETFs like `GLD`, `TLT`, `USO` tend to trend well.

---

## System 1 (Short-term)

| Key | Default | Description |
|-----|---------|-------------|
| `SYS1_ENTRY_PERIOD` | `20` | Donchian breakout lookback for entry (trading days) |
| `SYS1_EXIT_PERIOD` | `10` | Donchian channel lookback for exit |
| `SYS1_FILTER_ENABLED` | `false` | Skip System 1 entries after a winning System 1 trade on the same symbol |

**The System 1 filter** reduces whipsaw losses in choppy markets. When enabled, if the last System 1 trade on a symbol was closed at a profit, the next System 1 entry signal is skipped. The hypothesis: a profitable trade likely captured a real trend, and the channel is now at a high from which a retracement is more likely than continuation.

---

## System 2 (Long-term)

| Key | Default | Description |
|-----|---------|-------------|
| `SYS2_ENTRY_PERIOD` | `55` | Donchian breakout lookback for entry |
| `SYS2_EXIT_PERIOD` | `20` | Donchian channel lookback for exit |

System 2 has no filter. It runs on every breakout signal.

---

## Position Sizing & Risk

| Key | Default | Description |
|-----|---------|-------------|
| `ATR_PERIOD` | `14` | Lookback for ATR (N) calculation. Wilder's smoothing is used. |
| `RISK_PCT_PER_UNIT` | `1` | Equity percentage risked per unit. `1` = 1% of account equity |
| `MAX_UNITS` | `4` | Maximum units to add to a single position (pyramid cap) |
| `STOP_LOSS_MULTIPLIER` | `2` | Stop distance expressed in N units. `2` = stop 2N from entry |
| `MAX_OPEN_POSITIONS` | `10` | Maximum concurrent open positions across all symbols |
| `MIN_EQUITY` | `10000` | Minimum account equity to trade. Below this, no new entries are opened |
| `DAILY_LOSS_LIMIT_PCT` | `2` | Not yet enforced at order level; included for future use |
| `COOLDOWN_DAYS` | `5` | Calendar days after a trade closes before re-entry on the same symbol |

**Risk per position:**  
With default settings, a single symbol at maximum 4 units = 4 × 1% = **4% of equity** at risk if all stops are hit simultaneously.

**Maximum portfolio risk:**  
`MAX_OPEN_POSITIONS × RISK_PCT_PER_UNIT × MAX_UNITS` = 10 × 1% × 4 = **40% of equity** — the theoretical maximum if every position is at max units and all stops fire. In practice this never happens due to correlation and phased pyramiding.

**Minimum account size:**  
For a $10,000 account with a $200 stock trading at N=$3:
- Dollar risk = $10,000 × 1% = $100
- Unit size = $100 ÷ (2 × $3) = 16 shares

Unit size rounds down to 0 for high-ATR stocks on small accounts (e.g. N=$50 → unit = 1 share). The scanner records this as `no_signal_size` and skips the entry.

---

## Trading Control

| Key | Default | Description |
|-----|---------|-------------|
| `ENABLED_SYSTEMS` | `1,2` | Which systems to run: `1`, `2`, or `1,2` |
| `ALLOW_SHORT` | `false` | Enable short selling. When `false`, only long breakouts are considered |
| `DRY_RUN` | `true` | **Simulate trades without placing real orders.** Set to `false` for live trading |
| `BROKER` | `schwab` | Active broker: `schwab`, `fidelity`, or `manual` |
| `TRADING_MODE` | `paper` | Reserved for future use. Currently `paper` or `live` |

### Broker options

| Value | Behavior |
|-------|----------|
| `schwab` | Full automated trading via Schwab API. Requires valid credentials in `.env` |
| `fidelity` | Manual order queue. Each order generates instructions displayed in the UI |
| `manual` | Same as `fidelity` |

### Dry Run mode

When `DRY_RUN=true`:
- All buy/sell/close orders log their intention but do NOT contact Schwab
- Trades are **still written to the database** as if real
- Use this to test strategy logic without risking capital
- The `GET /trades/open` endpoint still attempts to fetch live prices from Schwab

**Always verify `DRY_RUN=false` before expecting real orders to be placed.**

---

## Scanner

| Key | Default | Description |
|-----|---------|-------------|
| `SCAN_CRON` | `0 16 * * 1-5` | Cron expression for automatic scans |
| `BARS_NEEDED` | `300` | Historical daily bars fetched per symbol from Schwab |
| `LAST_SCAN_RUN` | `""` | ISO timestamp of last completed scan (auto-managed, do not edit) |

### Cron schedule examples

| Cron | Meaning |
|------|---------|
| `0 16 * * 1-5` | 4:00 PM every weekday (ET on ET server) |
| `5 21 * * 1-5` | 9:05 PM UTC (= 4:05 PM ET in summer) |
| `0 13 * * 1-5` | 1:00 PM weekdays |
| `0 9 * * 1-5` | 9:00 AM weekdays (pre-market scan) |

> **Timezone:** The cron runs in the server's local timezone. If your server is in UTC but you want 4 PM ET, use `0 20 * * 1-5` (ET = UTC−4 in summer, UTC−5 in winter).

### Bars needed

The scanner fetches `BARS_NEEDED` daily bars per symbol from Schwab's `/pricehistory` endpoint. The minimum required is:
- `SYS2_ENTRY_PERIOD + ATR_PERIOD + 10` ≈ 55 + 14 + 10 = **79 bars**

The default of 300 provides a comfortable buffer and covers the ~250 trading days in a year.

---

## Startup Catch-up

On every restart, the server checks `LAST_SCAN_RUN` against today's date. If one or more trading days have been missed, it immediately runs a catch-up scan. This ensures the scanner stays current after downtime without manual intervention.

---

## Example Configuration (Starter)

```json
{
  "WATCHLIST": "AAPL,MSFT,NVDA,AMZN,META,GOOGL,JPM,XOM,GLD,TLT,USO,QQQ,SPY",
  "SYS1_ENTRY_PERIOD": "20",
  "SYS1_EXIT_PERIOD": "10",
  "SYS1_FILTER_ENABLED": "false",
  "SYS2_ENTRY_PERIOD": "55",
  "SYS2_EXIT_PERIOD": "20",
  "ATR_PERIOD": "14",
  "RISK_PCT_PER_UNIT": "1",
  "MAX_UNITS": "4",
  "STOP_LOSS_MULTIPLIER": "2",
  "MAX_OPEN_POSITIONS": "10",
  "MIN_EQUITY": "25000",
  "COOLDOWN_DAYS": "5",
  "ENABLED_SYSTEMS": "1,2",
  "ALLOW_SHORT": "false",
  "DRY_RUN": "true",
  "BROKER": "schwab",
  "SCAN_CRON": "0 16 * * 1-5",
  "BARS_NEEDED": "300"
}
```

Start with `DRY_RUN=true` for at least one full month before enabling live trading.
