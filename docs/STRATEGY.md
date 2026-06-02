# Turtle Trading Strategy

## Background

The Turtle Trading system was created by commodities trader Richard Dennis in 1983. Dennis made a bet with partner William Eckhardt that successful trading could be taught to anyone. He recruited 23 people — dubbed "Turtles" — taught them his rules over two weeks, and funded each with $1 million. The experiment succeeded: the Turtles collectively earned over $100 million in five years.

This application implements the Turtle system on US equities using Charles Schwab brokerage.

---

## Core Principles

1. **Trend following** — trade only in the direction of the prevailing trend
2. **Breakout entries** — buy when price makes a new N-day closing high; sell short on a new N-day closing low
3. **ATR-based position sizing** — every trade risks an identical dollar amount, regardless of price or volatility
4. **Pyramiding** — add units as the trend confirms, up to a maximum of 4
5. **Mechanical exits** — exit when price crosses the shorter-term Donchian channel, or when a stop is hit

---

## System 1 vs System 2

The original Turtles ran two systems simultaneously:

| | System 1 | System 2 |
|---|---|---|
| **Entry** | 20-day closing high (long) / 20-day closing low (short) | 55-day closing high/low |
| **Exit** | 10-day closing low (long) / 10-day closing high (short) | 20-day closing low/high |
| **Goal** | Faster entries, more signals, smaller trends | Capture larger, longer trends |
| **Filter** | Optional: skip after a winning trade | No filter |

Both systems can be enabled simultaneously via `ENABLED_SYSTEMS=1,2`. They operate on the same watchlist and can hold positions in the same symbol independently.

---

## ATR — The Volatility Unit (N)

N is the 14-day Average True Range, smoothed using Wilder's method.

```
True Range = max(High − Low, |High − PrevClose|, |Low − PrevClose|)

ATR(day 1) = simple average of first 14 True Range values
ATR(day n) = (ATR(prev) × 13 + TR(today)) / 14
```

N represents one unit of price volatility — roughly the typical daily range for that stock. It is the denominator in every position-sizing calculation, ensuring a 1N adverse move always costs the same dollar amount, regardless of what the stock is priced at.

---

## Position Sizing

Each "unit" of a trade is sized so that a 1N adverse move costs exactly `RISK_PCT_PER_UNIT` percent of account equity (default: 1%).

```
Dollar Risk per Unit = Account Equity × Risk% ÷ 100

Unit Size (shares) = Dollar Risk ÷ (Stop Multiplier × N)
```

**Example:** Equity = $100,000 · Risk = 1% · N = $2.50 · Stop multiplier = 2

```
Dollar Risk  = $100,000 × 0.01 = $1,000
Unit Size    = $1,000 ÷ (2 × $2.50) = 200 shares
```

A 2N adverse move on 200 shares = 200 × $5.00 = $1,000 = exactly 1% of equity.

This property holds regardless of whether the stock trades at $10 or $1,000.

---

## Stop Losses

Every unit's stop is set at `STOP_LOSS_MULTIPLIER × N` from entry (default: 2N).

```
Long stop  = Entry Price − (2 × N)
Short stop = Entry Price + (2 × N)
```

When a new unit is added to a position, **all open units' stops are raised** to the new unit's stop level. This means the entire position shares a single unified stop.

**Long pyramid example** (N = $2, entry = $100):

| Unit | Entry | Stop Set |
|------|-------|----------|
| 1 | $100.00 | $96.00 |
| 2 (added at $101.00) | $101.00 | All → $97.00 |
| 3 (added at $102.00) | $102.00 | All → $98.00 |
| 4 (added at $103.00) | $103.00 | All → $99.00 |

The stop is evaluated against the **closing price**, not intraday lows.

---

## Unit Building (Pyramiding)

After the initial breakout entry, additional units are added as price moves in the trade's favor:

| Unit | Trigger (Long) | Trigger (Short) |
|------|---------------|-----------------|
| 1 | Donchian breakout | Donchian breakout |
| 2 | Price ≥ Unit 1 entry + 0.5N | Price ≤ Unit 1 entry − 0.5N |
| 3 | Price ≥ Unit 1 entry + 1.0N | Price ≤ Unit 1 entry − 1.0N |
| 4 | Price ≥ Unit 1 entry + 1.5N | Price ≤ Unit 1 entry − 1.5N |

Units are checked daily as part of the scan. Each unit is sized the same way as Unit 1 using the current equity and current N value.

---

## Exit Rules

A position is exited in full when either condition is met:

1. **Stop loss**: The closing price crosses the current stop level  
   - Long: `close ≤ currentStop`  
   - Short: `close ≥ currentStop`

2. **Donchian exit**: The closing price crosses the exit-period Donchian channel  
   - Long: `close < N-day closing low (excluding today)`  
   - Short: `close > N-day closing high (excluding today)`

The exit-period closing low/high is computed on the **previous** bars only (excluding today's close). This prevents a trivial "exit when today equals today's low" condition.

There are no profit targets. The system rides winners until the exit rule triggers.

---

## System 1 Filter

When `SYS1_FILTER_ENABLED=true`, a System 1 entry is skipped if the **last closed System 1 trade on that symbol was a winner**. The reasoning: a winning trade likely captured a major trend, and re-entering immediately risks whipsawing on a retracement.

The filter only applies to System 1. System 2 runs without any filter.

---

## Risk Management Layers

The application enforces multiple overlapping risk controls:

| Control | Config Key | Default | Description |
|---------|-----------|---------|-------------|
| Per-unit risk | `RISK_PCT_PER_UNIT` | 1% | Max equity lost if stop is hit on one unit |
| Max units | `MAX_UNITS` | 4 | Max units per position (4% max risk per symbol) |
| Max positions | `MAX_OPEN_POSITIONS` | 10 | Total concurrent open positions |
| Min equity | `MIN_EQUITY` | $10,000 | Halt all trading below this level |
| Cooldown | `COOLDOWN_DAYS` | 5 | Days before re-entry after an exit on a symbol |
| Dry run | `DRY_RUN` | true | Simulate orders without placing them |

---

## Why Turtle Trading Works (and When It Doesn't)

**Strengths:**
- Losses are strictly bounded — every single trade risks the same dollar amount
- Winners run without a cap — one large trend offsets many small losses
- Position sizing automatically scales up in calm markets (small N → more shares) and down in volatile markets (large N → fewer shares)
- Fully mechanical — no discretion, no emotion

**Weaknesses:**
- Choppy, range-bound markets generate many small whipsaw losses
- Typical win rates of 30–40% — psychologically difficult to execute
- Large drawdowns (20–30%) are normal during trend-less periods
- Not suitable for very small accounts (unit size rounds down to 0 for high-ATR stocks)

**Typical expectations:**
- Win rate: 30–40%
- Profit factor: 1.4–2.0
- Average hold: 2–6 weeks per winner
- Max drawdown: 20–35% during difficult periods

The system earns its edge from a few very large winners per year. Do not evaluate performance over fewer than 2–3 years of data.
