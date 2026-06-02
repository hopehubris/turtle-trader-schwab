import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

export interface AccountInfo {
  equity: number;
  buyingPower: number;
  cash: number;
  daytradeCount: number;
}

export interface SchwabPosition {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
  side: string;
}

export interface Bar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Order {
  id: string;
  symbol: string;
  qty: string | null;
  notional: string | null;
  side: string;
  status: string;
  filled_avg_price: string | null;
  filled_at: string | null;
}

export class SchwabClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  private readonly accountNumber: string;
  private accessToken: string = '';
  private tokenExpiry: number = 0;
  private readonly tradingAxios: AxiosInstance;
  private readonly dataAxios: AxiosInstance;
  private readonly authAxios: AxiosInstance;

  constructor() {
    this.clientId = process.env['SCHWAB_CLIENT_ID'] ?? '';
    this.clientSecret = process.env['SCHWAB_CLIENT_SECRET'] ?? '';
    this.refreshToken = process.env['SCHWAB_REFRESH_TOKEN'] ?? '';
    this.accountNumber = process.env['SCHWAB_ACCOUNT_NUMBER'] ?? '';

    this.authAxios = axios.create({ baseURL: 'https://api.schwabapi.com/v1' });
    this.tradingAxios = axios.create({ baseURL: 'https://api.schwabapi.com/trader/v1' });
    this.dataAxios = axios.create({ baseURL: 'https://api.schwabapi.com/marketdata/v1' });

    const addAuth = async (config: any) => {
      const token = await this.getAccessToken();
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${token}`;
      return config;
    };

    this.tradingAxios.interceptors.request.use(addAuth);
    this.dataAxios.interceptors.request.use(addAuth);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', this.refreshToken);
    const { data } = await this.authAxios.post('/oauth/token', params.toString(), {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    logger.info({ msg: 'Schwab access token refreshed' });
    return this.accessToken;
  }

  async getAccount(): Promise<AccountInfo> {
    const { data } = await this.tradingAxios.get(`/accounts/${this.accountNumber}?fields=positions`);
    const balances = data.securitiesAccount?.currentBalances ?? {};
    return {
      equity: parseFloat(balances.liquidationValue ?? '0'),
      buyingPower: parseFloat(balances.buyingPower ?? balances.cashBalance ?? '0'),
      cash: parseFloat(balances.cashBalance ?? '0'),
      daytradeCount: data.securitiesAccount?.roundTrips ?? 0,
    };
  }

  async getPositions(): Promise<SchwabPosition[]> {
    const { data } = await this.tradingAxios.get(`/accounts/${this.accountNumber}?fields=positions`);
    const positions = (data.securitiesAccount?.positions ?? []) as any[];
    return positions
      .filter((p: any) => p.instrument?.assetType === 'EQUITY')
      .map((p: any) => {
        const qty = p.longQuantity ?? 0;
        const avgPrice = p.averagePrice ?? 0;
        const mktValue = p.marketValue ?? 0;
        const currentPrice = qty > 0 ? mktValue / qty : 0;
        const unrealizedPl = (currentPrice - avgPrice) * qty;
        return {
          symbol: p.instrument.symbol,
          qty: String(qty),
          avg_entry_price: String(avgPrice),
          current_price: String(currentPrice),
          market_value: String(mktValue),
          unrealized_pl: String(unrealizedPl),
          side: qty > 0 ? 'long' : 'short',
        };
      });
  }

  async getBars(symbol: string, limit = 300): Promise<Bar[]> {
    const { data } = await this.dataAxios.get('/pricehistory', {
      params: {
        symbol,
        periodType: 'year',
        period: 2,
        frequencyType: 'daily',
        frequency: 1,
        needExtendedHoursData: false,
      },
    });
    const candles: Bar[] = ((data.candles ?? []) as any[]).map((c: any) => ({
      t: new Date(c.datetime).toISOString(),
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
      v: c.volume,
    }));
    const sorted = candles.sort((a, b) => a.t.localeCompare(b.t));
    return sorted.slice(-limit);
  }

  async placeOrderQty(symbol: string, qty: number, side: 'buy' | 'sell'): Promise<Order> {
    logger.info({ msg: 'Placing Schwab order (qty)', symbol, qty, side });
    const response = await this.tradingAxios.post(
      `/accounts/${this.accountNumber}/orders`,
      {
        orderType: 'MARKET',
        session: 'NORMAL',
        duration: 'DAY',
        orderStrategyType: 'SINGLE',
        orderLegCollection: [{
          instruction: side === 'buy' ? 'BUY' : 'SELL',
          quantity: qty,
          instrument: { symbol, assetType: 'EQUITY' },
        }],
      },
      { validateStatus: (s: number) => s === 201 || (s >= 200 && s < 300) }
    );
    const location = (response.headers['location'] as string) ?? '';
    const orderId = location.split('/').pop() ?? `schwab-order-${Date.now()}`;
    return {
      id: orderId,
      symbol,
      qty: String(qty),
      notional: null,
      side,
      status: 'pending',
      filled_avg_price: null,
      filled_at: null,
    };
  }

  async placeOrderNotional(symbol: string, notional: number, side: 'buy' | 'sell'): Promise<Order> {
    logger.info({ msg: 'Placing Schwab order (notional)', symbol, notional, side });
    const prices = await this.getLatestPrices([symbol]);
    const price = prices.get(symbol) ?? 0;
    if (price <= 0) throw new Error(`Cannot get current price for ${symbol}`);
    const qty = Math.floor(notional / price);
    if (qty < 1) throw new Error(`Insufficient funds: $${notional} cannot buy 1 share of ${symbol} at $${price.toFixed(2)}`);
    return this.placeOrderQty(symbol, qty, side);
  }

  async closePosition(symbol: string): Promise<Order> {
    logger.info({ msg: 'Closing Schwab position', symbol });
    const positions = await this.getPositions();
    const pos = positions.find((p) => p.symbol === symbol);
    if (!pos) throw new Error(`No open Schwab position found for ${symbol}`);
    const qty = parseFloat(pos.qty);
    return this.placeOrderQty(symbol, qty, 'sell');
  }

  async getOrders(status = 'all', limit = 50, lookbackDays = 60): Promise<Order[]> {
    const toTime = new Date();
    const fromTime = new Date();
    fromTime.setDate(fromTime.getDate() - lookbackDays);
    const params: Record<string, string | number> = {
      maxResults: limit,
      fromEnteredTime: fromTime.toISOString().split('.')[0]! + 'Z',
      toEnteredTime: toTime.toISOString().split('.')[0]! + 'Z',
    };
    if (status !== 'all') params['status'] = status.toUpperCase();
    const { data } = await this.tradingAxios.get(`/accounts/${this.accountNumber}/orders`, { params });
    return ((data ?? []) as any[]).map((o: any) => this.mapOrder(o));
  }

  private mapOrder(o: any): Order {
    const leg = (o.orderLegCollection ?? [])[0] ?? {};
    const execLeg = ((o.orderActivityCollection ?? [])[0]?.executionLegs ?? [])[0] ?? {};
    const filledPrice = execLeg.price ?? o.filledPrice;
    return {
      id: String(o.orderId ?? ''),
      symbol: String(leg.instrument?.symbol ?? ''),
      qty: String(leg.quantity ?? ''),
      notional: null,
      side: String(leg.instruction ?? '').toLowerCase().includes('sell') ? 'sell' : 'buy',
      status: String(o.status ?? '').toLowerCase(),
      filled_avg_price: filledPrice != null ? String(filledPrice) : null,
      filled_at: o.closeTime ?? null,
    };
  }

  async getOrder(orderId: string): Promise<Order> {
    const { data } = await this.tradingAxios.get(`/accounts/${this.accountNumber}/orders/${orderId}`);
    return this.mapOrder(data);
  }

  async getLatestPrices(symbols: string[]): Promise<Map<string, number>> {
    if (symbols.length === 0) return new Map();
    const { data } = await this.dataAxios.get<Record<string, any>>(
      '/quotes',
      { params: { symbols: symbols.join(','), fields: 'quote' } }
    );
    const result = new Map<string, number>();
    for (const [sym, info] of Object.entries(data ?? {})) {
      const price = (info as any)?.quote?.lastPrice;
      if (price) result.set(sym, price);
    }
    return result;
  }

  async waitForFill(orderId: string, timeoutMs = 30000): Promise<Order> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const order = await this.getOrder(orderId);
      if (order.status === 'filled') return order;
      if (['canceled', 'expired', 'rejected'].includes(order.status)) {
        throw new Error(`Schwab order ${orderId} ended with status: ${order.status}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return this.getOrder(orderId);
  }
}

const schwabClient = new SchwabClient();
export default schwabClient;
