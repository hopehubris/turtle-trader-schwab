import {
  calcATR,
  calcDonchianUpper,
  calcDonchianLower,
  calcDonchianUpperClose,
  calcDonchianLowerClose,
  calcUnitSize,
  calcStopLoss,
  isLongBreakout,
  isShortBreakout,
  Bar,
} from '../src/services/indicatorService';

// Helper to generate synthetic bars
function makeBars(closes: number[], highs?: number[], lows?: number[]): Bar[] {
  return closes.map((c, i) => ({
    t: `2024-01-${String(i + 1).padStart(2, '0')}`,
    o: c * 0.99,
    h: highs ? highs[i]! : c * 1.01,
    l: lows ? lows[i]! : c * 0.99,
    c,
    v: 100000,
  }));
}

describe('calcATR', () => {
  it('returns NaN for first period values', () => {
    const bars = makeBars([10, 11, 12, 13, 14]);
    const result = calcATR(bars, 3);
    expect(isNaN(result[0]!)).toBe(true);
    expect(isNaN(result[1]!)).toBe(true);
    expect(isNaN(result[2]!)).toBe(true);
  });

  it('returns valid ATR after warmup period', () => {
    const closes = [10, 11, 10.5, 12, 11.5, 13, 12.5, 14, 13.5, 15, 14.5, 16, 15.5, 17, 16.5, 18];
    const bars = makeBars(closes);
    const result = calcATR(bars, 14);
    expect(result[14]).toBeDefined();
    expect(isNaN(result[14]!)).toBe(false);
    expect(result[14]!).toBeGreaterThan(0);
  });

  it('returns NaN array if too few bars', () => {
    const bars = makeBars([10, 11, 12]);
    const result = calcATR(bars, 14);
    result.forEach((v) => expect(isNaN(v)).toBe(true));
  });

  it('ATR is always positive', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const bars = makeBars(closes);
    const result = calcATR(bars, 14);
    result.filter((v) => !isNaN(v)).forEach((v) => expect(v).toBeGreaterThan(0));
  });
});

describe('calcDonchianUpper', () => {
  it('returns highest high over period', () => {
    const highs = [10, 12, 11, 15, 13];
    const bars = makeBars([9, 11, 10, 14, 12], highs);
    const result = calcDonchianUpper(bars, 3);
    // Period 3: index 2 = max(10,12,11) = 12, index 3 = max(12,11,15) = 15
    expect(result[2]).toBe(12);
    expect(result[3]).toBe(15);
  });

  it('first (period-1) values are NaN', () => {
    const bars = makeBars([1, 2, 3, 4, 5]);
    const result = calcDonchianUpper(bars, 3);
    expect(isNaN(result[0]!)).toBe(true);
    expect(isNaN(result[1]!)).toBe(true);
    expect(isNaN(result[2]!)).toBe(false);
  });
});

describe('calcDonchianLower', () => {
  it('returns lowest low over period', () => {
    const lows = [5, 3, 7, 2, 8];
    const bars = makeBars([6, 4, 8, 3, 9], undefined, lows);
    const result = calcDonchianLower(bars, 3);
    // Period 3: index 2 = min(5,3,7)=3, index 3 = min(3,7,2)=2
    expect(result[2]).toBe(3);
    expect(result[3]).toBe(2);
  });
});

describe('calcDonchianUpperClose / calcDonchianLowerClose', () => {
  it('upper uses closes only', () => {
    const closes = [10, 20, 15, 25, 18];
    const result = calcDonchianUpperClose(closes, 3);
    expect(result[2]).toBe(20); // max of 10,20,15
    expect(result[3]).toBe(25); // max of 20,15,25
  });

  it('lower uses closes only', () => {
    const closes = [10, 5, 15, 3, 12];
    const result = calcDonchianLowerClose(closes, 3);
    expect(result[2]).toBe(5);  // min of 10,5,15
    expect(result[3]).toBe(3);  // min of 5,15,3
  });
});

describe('calcUnitSize', () => {
  it('calculates correct unit size', () => {
    // equity=100000, risk=1%, N=2, price=50
    // unitSize = (100000 * 0.01) / (2 * 50) = 1000/100 = 10
    const result = calcUnitSize(100000, 1, 2, 50);
    expect(result).toBe(10);
  });

  it('returns 0 for zero ATR', () => {
    expect(calcUnitSize(100000, 1, 0, 50)).toBe(0);
  });

  it('returns 0 for zero price', () => {
    expect(calcUnitSize(100000, 1, 2, 0)).toBe(0);
  });

  it('floors to integer shares', () => {
    // 100000 * 0.01 / (3 * 50) = 1000/150 = 6.67 → floor = 6
    const result = calcUnitSize(100000, 1, 3, 50);
    expect(result).toBe(6);
  });
});

describe('calcStopLoss', () => {
  it('long stop = entry - 2N', () => {
    expect(calcStopLoss(100, 5, 'long')).toBe(90);
    expect(calcStopLoss(100, 5, 'long', 2)).toBe(90);
  });

  it('short stop = entry + 2N', () => {
    expect(calcStopLoss(100, 5, 'short')).toBe(110);
  });

  it('custom multiplier', () => {
    expect(calcStopLoss(100, 5, 'long', 3)).toBe(85);
    expect(calcStopLoss(100, 5, 'short', 3)).toBe(115);
  });
});

describe('isLongBreakout / isShortBreakout', () => {
  it('detects long breakout when today exceeds previous period high', () => {
    // Previous 3 closes: 10, 12, 11. Today = 13 → breakout
    const closes = [10, 12, 11, 13];
    expect(isLongBreakout(closes, 3)).toBe(true);
  });

  it('no long breakout when today is below previous high', () => {
    const closes = [10, 12, 11, 11.5];
    expect(isLongBreakout(closes, 3)).toBe(false);
  });

  it('detects short breakout when today below previous period low', () => {
    // Previous 3 closes: 10, 8, 9. Today = 7 → breakout
    const closes = [10, 8, 9, 7];
    expect(isShortBreakout(closes, 3)).toBe(true);
  });

  it('no short breakout when today is above previous low', () => {
    const closes = [10, 8, 9, 8.5];
    expect(isShortBreakout(closes, 3)).toBe(false);
  });

  it('returns false if not enough data', () => {
    expect(isLongBreakout([10, 12], 5)).toBe(false);
    expect(isShortBreakout([10, 8], 5)).toBe(false);
  });
});
