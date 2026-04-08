/**
 * Technical Indicators Engine
 *
 * Pure math calculations from OHLCV candle data.
 * No external APIs or libraries needed — all computed from Binance klines.
 *
 * Indicators: EMA, SMA, RSI, MACD, Bollinger Bands, ATR, VWAP
 * Structure: Market trend, BoS/CHoCH, Fair Value Gaps, Order Blocks
 *
 * Multi-timeframe: computes indicators for 1h, 4h, 1d
 */

// =============================================================================
// TYPES
// =============================================================================

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
}

export interface EMAResult {
  period: number;
  value: number;
}

export interface RSIResult {
  value: number;
  condition: 'overbought' | 'oversold' | 'neutral';
}

export interface MACDResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  histogramFlipping: boolean;
}

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  percentB: number;
  squeeze: boolean;
}

export interface ATRResult {
  value: number;
}

export interface VWAPResult {
  value: number;
  priceRelation: 'above' | 'below';
}

export interface MarketStructure {
  trend: 'bullish' | 'bearish' | 'ranging';
  lastBoS: { price: number; time: number; direction: 'bullish' | 'bearish' } | null;
  lastCHoCH: { price: number; time: number; direction: 'bullish' | 'bearish' } | null;
  swingHigh: number;
  swingLow: number;
}

export interface FairValueGap {
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  midpoint: number;
  time: number;
  filled: boolean;
}

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  time: number;
  strength: number;
  mitigated: boolean;
}

// Per-timeframe indicator set
export interface TimeframeIndicators {
  timeframe: string;
  ema9: EMAResult;
  ema21: EMAResult;
  ema50: EMAResult;
  ema200: EMAResult;
  rsi: RSIResult;
  macd: MACDResult;
  bollinger: BollingerResult;
  atr: ATRResult;
  vwap: VWAPResult;
  structure: MarketStructure;
  fvgs: FairValueGap[];
  orderBlocks: OrderBlock[];
  emaTrend: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
}

export interface IndicatorSuite {
  '1h': TimeframeIndicators;
  '4h': TimeframeIndicators;
  '1d': TimeframeIndicators;
  confluence: {
    overallTrend: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
    alignedTimeframes: number; // how many TFs agree on direction
    conflictingSignals: string[];
  };
}

// =============================================================================
// BASIC MATH
// =============================================================================

function ema(values: number[], period: number): number[] {
  if (values.length < period) return values.map(() => NaN);

  const k = 2 / (period + 1);
  const result: number[] = new Array(period - 1).fill(NaN);

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  result.push(prev);

  // EMA from period onwards
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

function lastValid(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return 0;
}

// =============================================================================
// INDICATORS
// =============================================================================

export function calcEMA(candles: Candle[], period: number): EMAResult {
  const closes = candles.map((c) => c.close);
  const values = ema(closes, period);
  return { period, value: lastValid(values) };
}

export function calcRSI(candles: Candle[], period: number = 14): RSIResult {
  const closes = candles.map((c) => c.close);
  if (closes.length < period + 1) {
    return { value: 50, condition: 'neutral' };
  }

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // Wilder's smoothed RSI
  // 1. Seed with SMA of first `period` values
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  // 2. Smooth through all remaining values
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  // 3. Final RSI
  let value: number;
  if (avgLoss === 0) {
    value = 100;
  } else {
    const rs = avgGain / avgLoss;
    value = 100 - 100 / (1 + rs);
  }

  return {
    value: parseFloat(value.toFixed(2)),
    condition: value > 70 ? 'overbought' : value < 30 ? 'oversold' : 'neutral',
  };
}

export function calcMACD(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const closes = candles.map((c) => c.close);
  if (closes.length < slowPeriod + signalPeriod) {
    return { macdLine: 0, signalLine: 0, histogram: 0, trend: 'neutral', histogramFlipping: false };
  }

  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);

  // MACD line = fast EMA - slow EMA (keep NaNs aligned)
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(fastEma[i]) || isNaN(slowEma[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(fastEma[i] - slowEma[i]);
    }
  }

  // Signal line = EMA of MACD line, computed IN PLACE (not on filtered array)
  // Find first valid MACD index
  let firstValid = -1;
  for (let i = 0; i < macdLine.length; i++) {
    if (!isNaN(macdLine[i])) { firstValid = i; break; }
  }

  const signalLine: number[] = new Array(macdLine.length).fill(NaN);
  if (firstValid >= 0 && macdLine.length - firstValid >= signalPeriod) {
    // Seed signal with SMA of first signalPeriod valid MACD values
    let sum = 0;
    for (let i = firstValid; i < firstValid + signalPeriod; i++) sum += macdLine[i];
    const seedIdx = firstValid + signalPeriod - 1;
    signalLine[seedIdx] = sum / signalPeriod;

    // EMA from there
    const k = 2 / (signalPeriod + 1);
    for (let i = seedIdx + 1; i < macdLine.length; i++) {
      if (!isNaN(macdLine[i])) {
        signalLine[i] = macdLine[i] * k + signalLine[i - 1] * (1 - k);
      } else {
        signalLine[i] = signalLine[i - 1];
      }
    }
  }

  const lastMacd = lastValid(macdLine);
  const lastSignalVal = lastValid(signalLine);
  const histogram = lastMacd - lastSignalVal;

  // Histogram flip: compare last two valid histograms
  let prevHistogram = histogram;
  for (let i = macdLine.length - 2; i >= 0; i--) {
    if (!isNaN(macdLine[i]) && !isNaN(signalLine[i])) {
      prevHistogram = macdLine[i] - signalLine[i];
      break;
    }
  }
  const histogramFlipping = (histogram > 0 && prevHistogram < 0) || (histogram < 0 && prevHistogram > 0);

  return {
    macdLine: parseFloat(lastMacd.toFixed(2)),
    signalLine: parseFloat(lastSignalVal.toFixed(2)),
    histogram: parseFloat(histogram.toFixed(2)),
    trend: histogram > 0 ? 'bullish' : histogram < 0 ? 'bearish' : 'neutral',
    histogramFlipping,
  };
}

export function calcBollinger(candles: Candle[], period: number = 20, stdDevMult: number = 2): BollingerResult {
  const closes = candles.map((c) => c.close);
  if (closes.length < period) {
    return { upper: 0, middle: 0, lower: 0, bandwidth: 0, percentB: 0.5, squeeze: false };
  }

  // Middle = SMA of last `period` closes
  const recentCloses = closes.slice(-period);
  const middle = recentCloses.reduce((a, b) => a + b, 0) / period;

  // Population standard deviation
  const variance = recentCloses.reduce((sum, val) => sum + (val - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);

  const upper = middle + stdDevMult * sd;
  const lower = middle - stdDevMult * sd;
  const currentPrice = closes[closes.length - 1];
  const bandwidth = middle > 0 ? ((upper - lower) / middle) * 100 : 0;
  const percentB = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;

  // Squeeze: compare current bandwidth to rolling bandwidth over last 50 bars
  let squeeze = false;
  if (closes.length >= period + 30) {
    const bandwidths: number[] = [];
    for (let i = closes.length - 30; i <= closes.length; i++) {
      if (i >= period) {
        const slice = closes.slice(i - period, i);
        const m = slice.reduce((a, b) => a + b, 0) / period;
        const v = slice.reduce((s, val) => s + (val - m) ** 2, 0) / period;
        const bw = m > 0 ? (2 * stdDevMult * Math.sqrt(v) / m) * 100 : 0;
        bandwidths.push(bw);
      }
    }
    if (bandwidths.length > 5) {
      const sorted = [...bandwidths].sort((a, b) => a - b);
      squeeze = bandwidth <= sorted[Math.floor(sorted.length * 0.2)] && bandwidth > 0;
    }
  }

  return {
    upper: parseFloat(upper.toFixed(2)),
    middle: parseFloat(middle.toFixed(2)),
    lower: parseFloat(lower.toFixed(2)),
    bandwidth: parseFloat(bandwidth.toFixed(4)),
    percentB: parseFloat(percentB.toFixed(4)),
    squeeze,
  };
}

export function calcATR(candles: Candle[], period: number = 14): ATRResult {
  if (candles.length < period + 1) return { value: 0 };

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trueRanges.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ));
  }

  // Wilder's smoothing
  let atr = 0;
  for (let i = 0; i < period; i++) atr += trueRanges[i];
  atr /= period;

  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return { value: parseFloat(atr.toFixed(2)) };
}

export function calcVWAP(candles: Candle[]): VWAPResult {
  if (candles.length === 0) return { value: 0, priceRelation: 'below' };

  // VWAP resets daily — find candles from the current day only
  const lastCandle = candles[candles.length - 1];
  const lastDate = new Date(lastCandle.time);
  const dayStart = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()).getTime();

  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const c of candles) {
    if (c.time >= dayStart) {
      const tp = (c.high + c.low + c.close) / 3;
      cumulativeTPV += tp * c.volume;
      cumulativeVolume += c.volume;
    }
  }

  const value = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : lastCandle.close;
  return {
    value: parseFloat(value.toFixed(2)),
    priceRelation: lastCandle.close >= value ? 'above' : 'below',
  };
}

// =============================================================================
// MARKET STRUCTURE DETECTION
// =============================================================================

interface SwingPoint {
  price: number;
  time: number;
  type: 'high' | 'low';
  index: number;
}

function findSwingPoints(candles: Candle[], lookback: number = 3): SwingPoint[] {
  const points: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isHigh = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isLow = false;
    }
    if (isHigh) points.push({ price: candles[i].high, time: candles[i].time, type: 'high', index: i });
    if (isLow) points.push({ price: candles[i].low, time: candles[i].time, type: 'low', index: i });
  }
  return points;
}

export function detectMarketStructure(candles: Candle[]): MarketStructure {
  const swings = findSwingPoints(candles, 3);
  const highs = swings.filter((s) => s.type === 'high');
  const lows = swings.filter((s) => s.type === 'low');

  if (highs.length < 2 || lows.length < 2) {
    return { trend: 'ranging', lastBoS: null, lastCHoCH: null, swingHigh: 0, swingLow: 0 };
  }

  // Walk through swing sequence to determine structure
  // Combine highs and lows in chronological order
  const allSwings = [...swings].sort((a, b) => a.index - b.index);

  let prevSwingHigh: SwingPoint | null = null;
  let prevSwingLow: SwingPoint | null = null;
  let currentTrend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
  let lastBoS: MarketStructure['lastBoS'] = null;
  let lastCHoCH: MarketStructure['lastCHoCH'] = null;

  for (const swing of allSwings) {
    if (swing.type === 'high') {
      if (prevSwingHigh) {
        if (swing.price > prevSwingHigh.price) {
          // Higher high
          if (currentTrend === 'bearish') {
            // Was bearish, now making HH = CHoCH bullish
            lastCHoCH = { price: swing.price, time: swing.time, direction: 'bullish' };
            currentTrend = 'bullish';
          } else {
            // Continuation of bullish = BoS
            lastBoS = { price: swing.price, time: swing.time, direction: 'bullish' };
            currentTrend = 'bullish';
          }
        }
        // Lower high in bullish doesn't change trend yet — need LL to confirm
      }
      prevSwingHigh = swing;
    } else {
      if (prevSwingLow) {
        if (swing.price < prevSwingLow.price) {
          // Lower low
          if (currentTrend === 'bullish') {
            // Was bullish, now making LL = CHoCH bearish
            lastCHoCH = { price: swing.price, time: swing.time, direction: 'bearish' };
            currentTrend = 'bearish';
          } else {
            // Continuation of bearish = BoS
            lastBoS = { price: swing.price, time: swing.time, direction: 'bearish' };
            currentTrend = 'bearish';
          }
        }
        // Higher low in bearish doesn't change trend yet — need HH to confirm
      }
      prevSwingLow = swing;
    }
  }

  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];

  return {
    trend: currentTrend,
    lastBoS,
    lastCHoCH,
    swingHigh: lastHigh.price,
    swingLow: lastLow.price,
  };
}

// =============================================================================
// FAIR VALUE GAPS
// =============================================================================

export function detectFVGs(candles: Candle[], limit: number = 5): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  if (candles.length < 3) return fvgs;

  const currentPrice = candles[candles.length - 1].close;

  for (let i = 2; i < candles.length; i++) {
    const candleBefore = candles[i - 2]; // candle 1
    const candleAfter = candles[i];      // candle 3
    // Middle candle (candles[i-1]) is where the gap happened

    // Bullish FVG: candle 3's low is above candle 1's high
    // The gap zone is between candle 1 high and candle 3 low
    if (candleAfter.low > candleBefore.high) {
      const gapLow = candleBefore.high;
      const gapHigh = candleAfter.low;
      // Filled = price has traded back INTO the gap (not just below it)
      // Check if any subsequent candle's low went into the gap
      let filled = false;
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].low <= gapHigh) { filled = true; break; }
      }
      fvgs.push({
        type: 'bullish',
        high: gapHigh,
        low: gapLow,
        midpoint: (gapHigh + gapLow) / 2,
        time: candles[i - 1].time,
        filled,
      });
    }

    // Bearish FVG: candle 3's high is below candle 1's low
    if (candleAfter.high < candleBefore.low) {
      const gapHigh = candleBefore.low;
      const gapLow = candleAfter.high;
      let filled = false;
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].high >= gapLow) { filled = true; break; }
      }
      fvgs.push({
        type: 'bearish',
        high: gapHigh,
        low: gapLow,
        midpoint: (gapHigh + gapLow) / 2,
        time: candles[i - 1].time,
        filled,
      });
    }
  }

  // Return most recent UNFILLED FVGs nearest to current price
  return fvgs
    .filter((f) => !f.filled)
    .sort((a, b) => Math.abs(a.midpoint - currentPrice) - Math.abs(b.midpoint - currentPrice))
    .slice(0, limit);
}

// =============================================================================
// ORDER BLOCKS
// =============================================================================

export function detectOrderBlocks(candles: Candle[], limit: number = 5): OrderBlock[] {
  if (candles.length < 3) return [];

  const blocks: OrderBlock[] = [];
  const avgVolume = candles.reduce((s, c) => s + c.volume, 0) / candles.length;
  const currentPrice = candles[candles.length - 1].close;

  for (let i = 1; i < candles.length - 1; i++) {
    const curr = candles[i];
    const next = candles[i + 1];

    // Bullish OB: bearish candle followed by strong bullish displacement
    if (
      curr.close < curr.open &&       // bearish candle (the OB)
      next.close > next.open &&        // next is bullish
      next.close > curr.high &&        // displacement: closes above OB high
      next.volume > avgVolume * 1.2    // above-average volume confirms
    ) {
      // Check mitigation: has price come back and traded through the OB?
      let mitigated = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].low <= curr.close) { mitigated = true; break; } // price went below OB low
      }
      blocks.push({
        type: 'bullish',
        high: curr.open,    // OB high = open of bearish candle
        low: curr.close,    // OB low = close of bearish candle
        time: curr.time,
        strength: parseFloat((next.volume / avgVolume).toFixed(2)),
        mitigated,
      });
    }

    // Bearish OB: bullish candle followed by strong bearish displacement
    if (
      curr.close > curr.open &&
      next.close < next.open &&
      next.close < curr.low &&
      next.volume > avgVolume * 1.2
    ) {
      let mitigated = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].high >= curr.close) { mitigated = true; break; }
      }
      blocks.push({
        type: 'bearish',
        high: curr.close,
        low: curr.open,
        time: curr.time,
        strength: parseFloat((next.volume / avgVolume).toFixed(2)),
        mitigated,
      });
    }
  }

  // Return unmitigated OBs nearest to current price
  return blocks
    .filter((ob) => !ob.mitigated)
    .sort((a, b) => Math.abs(((a.high + a.low) / 2) - currentPrice) - Math.abs(((b.high + b.low) / 2) - currentPrice))
    .slice(0, limit);
}

// =============================================================================
// PER-TIMEFRAME COMPUTATION
// =============================================================================

function computeForTimeframe(candles: Candle[], timeframe: string): TimeframeIndicators {
  const ema9 = calcEMA(candles, 9);
  const ema21 = calcEMA(candles, 21);
  const ema50 = calcEMA(candles, 50);
  const ema200 = calcEMA(candles, 200);
  const rsi = calcRSI(candles, 14);
  const macd = calcMACD(candles, 12, 26, 9);
  const bollinger = calcBollinger(candles, 20, 2);
  const atr = calcATR(candles, 14);
  const vwap = calcVWAP(candles);
  const structure = detectMarketStructure(candles);
  const fvgs = detectFVGs(candles, 5);
  const orderBlocks = detectOrderBlocks(candles, 5);

  // EMA trend classification
  const price = candles.length > 0 ? candles[candles.length - 1].close : 0;
  let emaTrend: TimeframeIndicators['emaTrend'] = 'neutral';
  const above9 = price > ema9.value && ema9.value > 0;
  const above21 = price > ema21.value && ema21.value > 0;
  const above50 = price > ema50.value && ema50.value > 0;
  const above200 = price > ema200.value && ema200.value > 0;

  if (above9 && above21 && above50 && above200) emaTrend = 'strong_bullish';
  else if (above50 && above200) emaTrend = 'bullish';
  else if (!above9 && !above21 && !above50 && !above200 && ema200.value > 0) emaTrend = 'strong_bearish';
  else if (!above50 && !above200 && ema200.value > 0) emaTrend = 'bearish';

  return {
    timeframe, ema9, ema21, ema50, ema200,
    rsi, macd, bollinger, atr, vwap,
    structure, fvgs, orderBlocks, emaTrend,
  };
}

// =============================================================================
// MULTI-TIMEFRAME CONFLUENCE
// =============================================================================

export function computeAllIndicators(
  dailyCandles: Candle[],
  h4Candles: Candle[],
  h1Candles: Candle[] = []
): IndicatorSuite {
  const daily = computeForTimeframe(dailyCandles, '1d');
  const h4 = computeForTimeframe(h4Candles, '4h');
  const h1 = computeForTimeframe(h1Candles, '1h');

  // Confluence: count how many timeframes agree on trend direction
  const trends = [daily.emaTrend, h4.emaTrend, h1.emaTrend];
  const bullishCount = trends.filter((t) => t.includes('bullish')).length;
  const bearishCount = trends.filter((t) => t.includes('bearish')).length;

  let overallTrend: IndicatorSuite['confluence']['overallTrend'] = 'neutral';
  if (bullishCount === 3) overallTrend = 'strong_bullish';
  else if (bullishCount >= 2) overallTrend = 'bullish';
  else if (bearishCount === 3) overallTrend = 'strong_bearish';
  else if (bearishCount >= 2) overallTrend = 'bearish';

  const alignedTimeframes = Math.max(bullishCount, bearishCount);

  // Detect conflicting signals
  const conflictingSignals: string[] = [];
  if (daily.emaTrend.includes('bullish') && h4.emaTrend.includes('bearish')) {
    conflictingSignals.push('Daily bullish but 4H bearish — potential pullback in uptrend');
  }
  if (daily.emaTrend.includes('bearish') && h4.emaTrend.includes('bullish')) {
    conflictingSignals.push('Daily bearish but 4H bullish — potential relief rally in downtrend');
  }
  if (daily.rsi.condition === 'overbought' && daily.macd.histogramFlipping) {
    conflictingSignals.push('RSI overbought + MACD histogram flipping — bearish divergence warning');
  }
  if (daily.rsi.condition === 'oversold' && daily.macd.histogramFlipping) {
    conflictingSignals.push('RSI oversold + MACD histogram flipping — bullish divergence opportunity');
  }
  if (daily.bollinger.squeeze) {
    conflictingSignals.push('Bollinger squeeze on daily — big move incoming, direction uncertain');
  }
  if (daily.structure.lastCHoCH) {
    conflictingSignals.push(`CHoCH detected on daily — ${daily.structure.lastCHoCH.direction} reversal signal at $${daily.structure.lastCHoCH.price.toLocaleString()}`);
  }

  return {
    '1h': h1,
    '4h': h4,
    '1d': daily,
    confluence: { overallTrend, alignedTimeframes, conflictingSignals },
  };
}
