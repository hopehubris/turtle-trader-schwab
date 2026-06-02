import schwabClient, { Bar } from './schwabClient';

export type { Bar };

export async function getBarsForSymbol(symbol: string, limit = 300): Promise<Bar[]> {
  return schwabClient.getBars(symbol, limit);
}
