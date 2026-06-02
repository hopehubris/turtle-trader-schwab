import prisma from '../db/prisma';

const DEFAULTS: Record<string, string> = {
  WATCHLIST: '',
  SYS1_ENTRY_PERIOD: '20',
  SYS1_EXIT_PERIOD: '10',
  SYS2_ENTRY_PERIOD: '55',
  SYS2_EXIT_PERIOD: '20',
  ATR_PERIOD: '14',
  RISK_PCT_PER_UNIT: '1',
  MAX_UNITS: '4',
  STOP_LOSS_MULTIPLIER: '2',
  MAX_OPEN_POSITIONS: '10',
  MIN_EQUITY: '10000',
  DAILY_LOSS_LIMIT_PCT: '2',
  COOLDOWN_DAYS: '5',
  ENABLED_SYSTEMS: '1,2',
  SYS1_FILTER_ENABLED: 'false',
  ALLOW_SHORT: 'false',
  TRADING_MODE: 'paper',
  BROKER: 'schwab',
  SCAN_CRON: '0 16 * * 1-5',
  BARS_NEEDED: '300',
  DRY_RUN: 'true',
  LAST_SCAN_RUN: '',
};

export async function getConfig(): Promise<Record<string, string>> {
  const rows = await prisma.config.findMany();
  const result: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export async function getConfigValue(key: string): Promise<string> {
  const row = await prisma.config.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? '';
}

export async function setConfig(key: string, value: string): Promise<void> {
  await prisma.config.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function setConfigBulk(data: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(data)) {
    await setConfig(key, value);
  }
}
