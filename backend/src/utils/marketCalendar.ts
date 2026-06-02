/**
 * US market calendar utilities.
 * Returns true if date is a weekday (Mon-Fri) and not a known US market holiday.
 */

const HOLIDAYS_2025 = new Set([
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18',
  '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01',
  '2025-11-27', '2025-12-25',
]);

const HOLIDAYS_2026 = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03',
  '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07',
  '2026-11-26', '2026-12-25',
]);

function getHolidays(): Set<string> {
  const year = new Date().getFullYear();
  if (year === 2025) return HOLIDAYS_2025;
  if (year === 2026) return HOLIDAYS_2026;
  return new Set();
}

export function isTradingDay(date: Date): boolean {
  const day = date.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const dateStr = date.toISOString().split('T')[0]!;
  return !getHolidays().has(dateStr);
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0]!;
}
