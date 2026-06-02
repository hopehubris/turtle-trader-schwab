
export default function Help() {
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Help & Documentation</h1>

      {[
        {
          title: 'Turtle Trading Overview',
          content: `The original Turtle Trading system was developed by Richard Dennis in the 1980s.
          It uses Donchian Channel breakouts for entries and exits, ATR-based position sizing,
          and systematic unit-building (pyramiding) to ride trends.`,
        },
        {
          title: 'System 1 vs System 2',
          content: `System 1 uses a shorter breakout period (default: 20 days) for faster entries.
          System 2 uses a longer period (default: 55 days) for bigger trend captures.
          Both systems can run simultaneously. Configure periods in Settings.`,
        },
        {
          title: 'Position Sizing (N = ATR)',
          content: `N is the 14-day ATR (Average True Range). Each unit size is calculated as:
          Unit Shares = (Equity × Risk%) / (N × Price)
          The default risk is 1% of equity per unit, meaning a 1N price move equals a 1% portfolio loss.`,
        },
        {
          title: 'Unit Building (Pyramiding)',
          content: `After an initial entry (Unit 1), additional units are added as price moves favorably:
          • Unit 2: Added when price moves 0.5N above Unit 1 entry
          • Unit 3: Added when price moves 1.0N above Unit 1 entry
          • Unit 4: Added when price moves 1.5N above Unit 1 entry
          Maximum 4 units per position by default.`,
        },
        {
          title: 'Stop Losses',
          content: `Stops are set at 2N from the latest unit entry:
          • Long: Stop = Entry Price − (2 × N)
          • Short: Stop = Entry Price + (2 × N)
          When a new unit is added, ALL unit stops move to the new unit's stop level.`,
        },
        {
          title: 'Broker Integration',
          content: `Charles Schwab: Full automated trading via the Schwab Developer API (OAuth2).
          Requires SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET, SCHWAB_REFRESH_TOKEN, and SCHWAB_ACCOUNT_NUMBER in backend/.env.
          Fidelity: Manual trading — the app queues orders and shows instructions. Import positions via CSV export.
          Dry Run: Test the system without placing any real orders.`,
        },
        {
          title: 'Scanner',
          content: `The daily scanner runs automatically at 4pm ET weekdays (configurable).
          Phase 1: Checks exit conditions for all open trades (stop loss + Donchian exit).
          Phase 2: Checks unit addition opportunities for open trades.
          Phase 3: Checks entry breakouts for watchlist symbols without open positions.`,
        },
        {
          title: 'Getting Started',
          content: `1. Obtain Schwab API credentials from developer.schwab.com
2. Add credentials to backend/.env (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, ACCOUNT_NUMBER)
3. Set your watchlist in Settings → Watchlist
4. Configure risk parameters (risk % per unit, max units, etc.)
5. Enable dry run mode for testing
6. Run a manual scan from the Dashboard
7. Review signals and trades before enabling live trading`,
        },
      ].map((section) => (
        <div key={section.title} className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-2">{section.title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{section.content}</p>
        </div>
      ))}
    </div>
  )
}
