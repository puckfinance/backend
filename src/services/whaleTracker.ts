/**
 * Whale Tracking & Market Analysis Service
 * 
 * Multi-source crypto intelligence for AI trading agent:
 * - Whale Alert API - Large transaction tracking
 * - Exchange APIs - Funding rates, open interest, orderbook
 * - Fear & Greed Index - Market sentiment
 * - On-chain metrics - Exchange flows, whale activity
 * 
 * @author AI Assistant
 * @createdDate 2026-04-05
 */

import axios from 'axios';
import logger from '../utils/Logger';

// Types
export interface WhaleAlert {
  id: string;
  timestamp: number;
  blockchain: string;
  symbol: string;
  amount: number;
  amountUsd: number;
  from: {
    address: string;
    ownerType: string;
    owner?: string;
  };
  to: {
    address: string;
    ownerType: string;
    owner?: string;
  };
  transactionType: 'transfer' | 'exchange' | 'unknown';
  exchange?: string;
}

export interface WhaleStats {
  totalInflow24h: number;
  totalOutflow24h: number;
  largeTransactionsCount: number;
  exchangeNetFlow: number;
  whaleCount: number;
}

export interface MarketSentiment {
  fearGreedIndex: number;
  fearGreedClassification: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  fundingRateBinance: number;
  fundingRateBybit: number;
  avgFundingRate: number;
  openInterest: number;
  longShortRatio: number;
  marketBias: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100
}

export interface ExchangeFlow {
  exchange: string;
  inflow24h: number;
  outflow24h: number;
  netFlow: number;
  velocity: number; // How fast coins are moving
}

export interface CryptoAnalysis {
  whaleStats: WhaleStats;
  sentiment: MarketSentiment;
  exchangeFlows: ExchangeFlow[];
  technicalLevels: {
    keySupport: number;
    keyResistance: number;
    currentPrice: number;
    dailyHigh: number;
    dailyLow: number;
  };
  signals: AiSignal[];
  summary: string;
  recommendation: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  confidence: number;
}

export interface AiSignal {
  type: 'whale' | 'onchain' | 'sentiment' | 'technical' | 'funding';
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 1-5
  description: string;
  data?: any;
}

// Configuration
const WHALE_ALERT_API_URL = 'https://api.whale-alert.io/v1/transactions';
const WHALE_ALERT_MIN_VALUE = 1000000; // $1M minimum (requires paid API key)
const BINANCE_API_URL = 'https://api.binance.com/api/v3';
const BYBIT_API_URL = 'https://api.bybit.com/v5';

// =============================================================================
// WHALE ALERT FUNCTIONS
// =============================================================================

/**
 * Fetch whale alerts from Whale Alert API
 * NOTE: Whale Alert is NOT free - requires paid subscription ($29.95/mo)
 * Without API key, returns mock data for testing
 */
export async function fetchWhaleAlerts(
  minValue: number = WHALE_ALERT_MIN_VALUE,
  limit: number = 10
): Promise<{ alerts: WhaleAlert[]; isMock: boolean }> {
  try {
    const apiKey = process.env.WHALE_ALERT_API_KEY;
    
    if (!apiKey) {
      logger.warn('WHALE_ALERT_API_KEY not set, returning mock data');
      return { alerts: getMockWhaleAlerts(limit), isMock: true };
    }

    const params: Record<string, any> = {
      min_value: minValue,
      limit: limit,
    };

    const response = await axios.get(WHALE_ALERT_API_URL, {
      params,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 10000,
    });

    if (!response.data?.transactions) {
      return { alerts: [], isMock: false };
    }

    const alerts = response.data.transactions.map((tx: any) => parseWhaleAlert(tx));
    return { alerts, isMock: false };
  } catch (error: any) {
    logger.error('Whale Alert API error:', error.message);
    return { alerts: getMockWhaleAlerts(limit), isMock: true };
  }
}

function parseWhaleAlert(tx: any): WhaleAlert {
  return {
    id: `whale-${tx.hash || tx.id}`,
    timestamp: tx.timestamp * 1000,
    blockchain: tx.blockchain || 'bitcoin',
    symbol: tx.symbol?.toUpperCase() || 'BTC',
    amount: tx.amount || 0,
    amountUsd: tx.amount_usd || 0,
    from: {
      address: tx.from?.address || '',
      ownerType: tx.from?.owner_type || 'unknown',
      owner: tx.from?.owner || undefined,
    },
    to: {
      address: tx.to?.address || '',
      ownerType: tx.to?.owner_type || 'unknown',
      owner: tx.to?.owner || undefined,
    },
    transactionType: determineTransactionType(tx),
    exchange: detectExchange(tx),
  };
}

function determineTransactionType(tx: any): 'transfer' | 'exchange' | 'unknown' {
  const fromOwner = tx.from?.owner_type?.toLowerCase() || '';
  const toOwner = tx.to?.owner_type?.toLowerCase() || '';
  
  if (fromOwner.includes('exchange') || toOwner.includes('exchange')) {
    return 'exchange';
  }
  if (fromOwner.includes('wallet') || toOwner.includes('wallet')) {
    return 'transfer';
  }
  return 'unknown';
}

function detectExchange(tx: any): string | undefined {
  const address = (tx.to?.address || tx.from?.address || '').toLowerCase();
  
  const exchangePatterns: Record<string, string[]> = {
    'Binance': ['binance'],
    'Coinbase': ['coinbase'],
    'Kraken': ['kraken'],
    'Bitfinex': ['bitfinex'],
    'Huobi': ['huobi'],
    'OKX': ['okx'],
    'MEXC': ['mexc'],
    'Bybit': ['bybit'],
  };
  
  for (const [exchange, patterns] of Object.entries(exchangePatterns)) {
    if (patterns.some(p => address.includes(p))) {
      return exchange;
    }
  }
  return undefined;
}

// =============================================================================
// FEAR & GREED INDEX
// =============================================================================

/**
 * Fetch Fear & Greed Index from alternative.me
 * Free, no API key needed
 */
export async function getFearAndGreedIndex(): Promise<{ value: number; classification: string }> {
  try {
    const response = await axios.get('https://api.alternative.me/fng/', {
      timeout: 10000,
    });

    const data = response.data?.data?.[0];
    const value = parseInt(data?.value || '50', 10);
    const classification = data?.value_classification || 'Neutral';

    return { value, classification };
  } catch (error: any) {
    logger.error('Fear & Greed API error:', error.message);
    return { value: 50, classification: 'Neutral' };
  }
}

// =============================================================================
// FUNDING RATE ANALYSIS
// =============================================================================

/**
 * Get funding rates from Binance and Bybit
 * Funding rate > 0 = long traders paying shorts (bullish)
 * Funding rate < 0 = short traders paying longs (bearish)
 */
export async function getFundingRates(symbol: string = 'BTC'): Promise<{
  binance: number;
  bybit: number;
  average: number;
}> {
  let binanceRate = 0;
  let bybitRate = 0;

  try {
    // Binance funding rate
    const binanceResponse = await axios.get(`${BINANCE_API_URL}/premiumIndex`, {
      params: { symbol: `${symbol}USDT` },
      timeout: 10000,
    });
    binanceRate = parseFloat(binanceResponse.data?.lastFundingRate || '0') * 100;
  } catch (error: any) {
    logger.warn('Binance funding rate fetch failed:', error.message);
  }

  try {
    // Bybit funding rate
    const bybitResponse = await axios.get(`${BYBIT_API_URL}/market/tickers`, {
      params: { category: 'linear', symbol: `${symbol}USDT` },
      timeout: 10000,
    });
    const bybitData = bybitResponse.data?.result?.list?.[0];
    bybitRate = parseFloat(bybitData?.fundingRate || '0') * 100;
  } catch (error: any) {
    logger.warn('Bybit funding rate fetch failed:', error.message);
  }

  const average = (binanceRate + bybitRate) / 2;

  return { binance: binanceRate, bybit: bybitRate, average };
}

// =============================================================================
// OPEN INTEREST & LONG/SHORT
// =============================================================================

/**
 * Get open interest and long/short ratio
 */
export async function getOpenInterestAndRatio(symbol: string = 'BTC'): Promise<{
  openInterest: number;
  longShortRatio: number;
  totalLong: number;
  totalShort: number;
}> {
  let openInterest = 0;
  let longShortRatio = 1;
  let totalLong = 0;
  let totalShort = 0;

  try {
    // Binance futures long/short ratio
    const response = await axios.get(`${BINANCE_API_URL}/takerLongShortRatio`, {
      params: { symbol: `${symbol}USDT`, period: '1h', limit: 1 },
      timeout: 10000,
    });

    const data = response.data?.takerLongShortRatio?.[0];
    if (data) {
      longShortRatio = parseFloat(data.longShortRatio || '1');
      totalLong = parseFloat(data.buySellRatio || '1');
      totalShort = 1 / totalLong;
    }
  } catch (error: any) {
    logger.warn('Open interest fetch failed:', error.message);
  }

  try {
    // Get open interest value
    const oiResponse = await axios.get(`${BINANCE_API_URL}/openInterest`, {
      params: { symbol: `${symbol}USDT` },
      timeout: 10000,
    });
    openInterest = parseFloat(oiResponse.data?.openInterest || '0') * parseFloat(oiResponse.data?.price || '0');
  } catch (error: any) {
    logger.warn('Open interest value fetch failed:', error.message);
  }

  return { openInterest, longShortRatio, totalLong, totalShort };
}

// =============================================================================
// EXCHANGE FLOWS
// =============================================================================

/**
 * Get exchange flow data
 * Positive = net inflow to exchange (potential selling pressure)
 * Negative = net outflow from exchange (potential accumulation)
 */
export async function getExchangeFlows(symbol: string = 'BTC'): Promise<ExchangeFlow[]> {
  // In production, use CryptoQuant or similar API
  // For now, we'll estimate from whale alert data
  
  try {
    const { alerts } = await fetchWhaleAlerts(500000, 50);
    const btcAlerts = alerts.filter(a => a.symbol === symbol || symbol === 'BTC');
    
    const exchanges: Record<string, { inflow: number; outflow: number }> = {};
    
    for (const alert of btcAlerts) {
      const exchange = alert.exchange || 'Unknown';
      if (!exchanges[exchange]) {
        exchanges[exchange] = { inflow: 0, outflow: 0 };
      }
      
      // If going TO exchange = inflow
      if (alert.to.ownerType === 'exchange') {
        exchanges[exchange].inflow += alert.amountUsd;
      }
      // If going FROM exchange = outflow
      if (alert.from.ownerType === 'exchange') {
        exchanges[exchange].outflow += alert.amountUsd;
      }
    }
    
    return Object.entries(exchanges).map(([exchange, flow]) => ({
      exchange,
      inflow24h: flow.inflow,
      outflow24h: flow.outflow,
      netFlow: flow.outflow - flow.inflow, // Negative = into exchange
      velocity: (flow.inflow + flow.outflow) / 2,
    }));
  } catch (error: any) {
    logger.error('Exchange flows error:', error.message);
    return [];
  }
}

// =============================================================================
// TECHNICAL LEVELS
// =============================================================================

/**
 * Get key technical levels from Binance
 */
export async function getTechnicalLevels(symbol: string = 'BTC'): Promise<{
  currentPrice: number;
  dailyHigh: number;
  dailyLow: number;
  keySupport: number;
  keyResistance: number;
}> {
  try {
    const response = await axios.get(`${BINANCE_API_URL}/ticker/24hr`, {
      params: { symbol: `${symbol}USDT` },
      timeout: 10000,
    });

    const data = response.data;
    const currentPrice = parseFloat(data?.lastPrice || '0');
    const dailyHigh = parseFloat(data?.highPrice || '0');
    const dailyLow = parseFloat(data?.lowPrice || '0');
    
    // Simple support/resistance calculation
    // In production, use more sophisticated methods
    const volatility = dailyHigh - dailyLow;
    const keySupport = dailyLow + (volatility * 0.236); // 23.6% retracement
    const keyResistance = dailyHigh - (volatility * 0.236); // 23.6% retracement

    return { currentPrice, dailyHigh, dailyLow, keySupport, keyResistance };
  } catch (error: any) {
    logger.error('Technical levels fetch error:', error.message);
    return { currentPrice: 0, dailyHigh: 0, dailyLow: 0, keySupport: 0, keyResistance: 0 };
  }
}

// =============================================================================
// WHALE STATS CALCULATION
// =============================================================================

export async function getWhaleStats(symbol: string = 'BTC'): Promise<WhaleStats> {
  try {
    const { alerts } = await fetchWhaleAlerts(1000000, 50);
    
    const btcAlerts = alerts.filter(a => a.symbol === symbol || symbol === 'BTC');
    
    let totalInflow = 0;
    let totalOutflow = 0;
    let exchangeInflow = 0;
    let exchangeOutflow = 0;
    
    for (const alert of btcAlerts) {
      // Exchange flow: coins going TO exchange = potential selling pressure
      if (alert.to.ownerType === 'exchange') {
        exchangeInflow += alert.amountUsd;
        totalInflow += alert.amountUsd;
      }
      // Coins leaving exchange = potential accumulation
      if (alert.from.ownerType === 'exchange') {
        exchangeOutflow += alert.amountUsd;
        totalOutflow += alert.amountUsd;
      }
      // Unknown wallets
      if (alert.to.ownerType === 'unknown' && alert.from.ownerType === 'unknown') {
        totalInflow += alert.amountUsd / 2;
        totalOutflow += alert.amountUsd / 2;
      }
    }
    
    return {
      totalInflow24h: totalInflow,
      totalOutflow24h: totalOutflow,
      largeTransactionsCount: btcAlerts.length,
      exchangeNetFlow: exchangeInflow - exchangeOutflow,
      whaleCount: new Set(btcAlerts.map(a => a.from.address)).size,
    };
  } catch (error: any) {
    logger.error('Error calculating whale stats:', error.message);
    return {
      totalInflow24h: 0,
      totalOutflow24h: 0,
      largeTransactionsCount: 0,
      exchangeNetFlow: 0,
      whaleCount: 0,
    };
  }
}

// =============================================================================
// MARKET SENTIMENT
// =============================================================================

export async function getMarketSentiment(symbol: string = 'BTC'): Promise<MarketSentiment> {
  const [fearGreed, funding, oiRatio] = await Promise.all([
    getFearAndGreedIndex(),
    getFundingRates(symbol),
    getOpenInterestAndRatio(symbol),
  ]);

  // Determine bias from funding rate
  // Positive funding = longs paying shorts = bullish sentiment
  // Negative funding = shorts paying longs = bearish sentiment
  let marketBias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let confidence = 50;

  if (funding.average > 0.01) {
    marketBias = 'bullish';
    confidence = Math.min(90, 50 + funding.average * 100);
  } else if (funding.average < -0.01) {
    marketBias = 'bearish';
    confidence = Math.min(90, 50 + Math.abs(funding.average) * 100);
  }

  // Adjust for Fear & Greed
  if (fearGreed.value < 25 && marketBias === 'bearish') {
    confidence = Math.min(95, confidence + 20); // Strong bearish confluence
  } else if (fearGreed.value > 75 && marketBias === 'bullish') {
    confidence = Math.min(95, confidence + 20); // Strong bullish confluence
  }

  return {
    fearGreedIndex: fearGreed.value,
    fearGreedClassification: fearGreed.classification as any,
    fundingRateBinance: funding.binance,
    fundingRateBybit: funding.bybit,
    avgFundingRate: funding.average,
    openInterest: oiRatio.openInterest,
    longShortRatio: oiRatio.longShortRatio,
    marketBias,
    confidence: Math.round(confidence),
  };
}

// =============================================================================
// AI SIGNAL GENERATION
// =============================================================================

/**
 * Generate trading signals from all data sources
 */
function generateSignals(
  whaleStats: WhaleStats,
  sentiment: MarketSentiment,
  _exchangeFlows: ExchangeFlow[],
  techLevels: { currentPrice: number; dailyHigh: number; dailyLow: number; keySupport: number; keyResistance: number }
): AiSignal[] {
  const signals: AiSignal[] = [];

  // WHALE SIGNALS
  if (whaleStats.exchangeNetFlow > 50000000) {
    signals.push({
      type: 'whale',
      direction: 'bearish',
      strength: 4,
      description: `Heavy inflow to exchanges ($${(whaleStats.exchangeNetFlow / 1000000).toFixed(1)}M) - distribution pressure`,
    });
  } else if (whaleStats.exchangeNetFlow < -50000000) {
    signals.push({
      type: 'whale',
      direction: 'bullish',
      strength: 4,
      description: `Heavy outflow from exchanges ($${(Math.abs(whaleStats.exchangeNetFlow) / 1000000).toFixed(1)}M) - accumulation`,
    });
  }

  if (whaleStats.largeTransactionsCount > 20) {
    signals.push({
      type: 'whale',
      direction: 'neutral',
      strength: 2,
      description: `High whale activity: ${whaleStats.largeTransactionsCount} large transactions`,
    });
  }

  // FUNDING RATE SIGNALS
  if (sentiment.avgFundingRate > 0.05) {
    signals.push({
      type: 'funding',
      direction: 'bullish',
      strength: 3,
      description: `High funding rate (${sentiment.avgFundingRate.toFixed(4)}%) - bullish sentiment`,
    });
  } else if (sentiment.avgFundingRate < -0.05) {
    signals.push({
      type: 'funding',
      direction: 'bearish',
      strength: 3,
      description: `Negative funding rate (${sentiment.avgFundingRate.toFixed(4)}%) - bearish sentiment`,
    });
  }

  // SENTIMENT SIGNALS
  if (sentiment.fearGreedIndex < 20) {
    signals.push({
      type: 'sentiment',
      direction: 'bullish',
      strength: 4,
      description: `Extreme Fear (${sentiment.fearGreedIndex}) - potential buy opportunity`,
    });
  } else if (sentiment.fearGreedIndex > 80) {
    signals.push({
      type: 'sentiment',
      direction: 'bearish',
      strength: 4,
      description: `Extreme Greed (${sentiment.fearGreedIndex}) - potential sell opportunity`,
    });
  }

  // LONG/SHORT RATIO SIGNALS
  if (sentiment.longShortRatio > 1.2) {
    signals.push({
      type: 'sentiment',
      direction: 'bullish',
      strength: 3,
      description: `High long/short ratio (${sentiment.longShortRatio.toFixed(2)}) - bullish positioning`,
    });
  } else if (sentiment.longShortRatio < 0.8) {
    signals.push({
      type: 'sentiment',
      direction: 'bearish',
      strength: 3,
      description: `Low long/short ratio (${sentiment.longShortRatio.toFixed(2)}) - bearish positioning`,
    });
  }

  // TECHNICAL SIGNALS
  if (techLevels.currentPrice > techLevels.keyResistance) {
    signals.push({
      type: 'technical',
      direction: 'bullish',
      strength: 3,
      description: `Breaking resistance at $${techLevels.keyResistance.toLocaleString()}`,
    });
  } else if (techLevels.currentPrice < techLevels.keySupport) {
    signals.push({
      type: 'technical',
      direction: 'bearish',
      strength: 3,
      description: `Below support at $${techLevels.keySupport.toLocaleString()}`,
    });
  }

  return signals;
}

// =============================================================================
// COMPREHENSIVE ANALYSIS
// =============================================================================

/**
 * Get comprehensive crypto analysis for AI trading agent
 */
export async function getComprehensiveAnalysis(symbol: string = 'BTC'): Promise<CryptoAnalysis> {
  const [whaleStats, sentiment, exchangeFlows, techLevels] = await Promise.all([
    getWhaleStats(symbol),
    getMarketSentiment(symbol),
    getExchangeFlows(symbol),
    getTechnicalLevels(symbol),
  ]);

  const signals = generateSignals(whaleStats, sentiment, exchangeFlows, techLevels);

  // Calculate overall recommendation
  let bullishSignals = signals.filter(s => s.direction === 'bullish').reduce((sum, s) => sum + s.strength, 0);
  let bearishSignals = signals.filter(s => s.direction === 'bearish').reduce((sum, s) => sum + s.strength, 0);
  
  // Adjust for exchange net flow (most important signal)
  if (whaleStats.exchangeNetFlow < -100000000) bullishSignals += 5;
  else if (whaleStats.exchangeNetFlow > 100000000) bearishSignals += 5;

  let recommendation: CryptoAnalysis['recommendation'] = 'NEUTRAL';
  let confidence = 50;

  if (bullishSignals > bearishSignals * 1.5) {
    recommendation = bullishSignals > bearishSignals * 2.5 ? 'STRONG_BUY' : 'BUY';
    confidence = Math.min(95, 50 + (bullishSignals - bearishSignals) * 10);
  } else if (bearishSignals > bullishSignals * 1.5) {
    recommendation = bearishSignals > bullishSignals * 2.5 ? 'STRONG_SELL' : 'SELL';
    confidence = Math.min(95, 50 + (bearishSignals - bullishSignals) * 10);
  }

  // Generate summary
  const summary = generateSummary(symbol, whaleStats, sentiment, signals, techLevels);

  return {
    whaleStats,
    sentiment,
    exchangeFlows,
    technicalLevels: techLevels,
    signals,
    summary,
    recommendation,
    confidence: Math.round(confidence),
  };
}

function generateSummary(
  _symbol: string,
  whaleStats: WhaleStats,
  sentiment: MarketSentiment,
  signals: AiSignal[],
  techLevels: { currentPrice: number; dailyHigh: number; dailyLow: number; keySupport: number; keyResistance: number }
): string {
  const parts: string[] = [];

  // Overall market sentiment
  parts.push(`${sentiment.fearGreedClassification} (${sentiment.fearGreedIndex}/100)`);

  // Funding rate
  if (sentiment.avgFundingRate > 0.01) {
    parts.push(`Funding rate positive at ${sentiment.avgFundingRate.toFixed(3)}%`);
  } else if (sentiment.avgFundingRate < -0.01) {
    parts.push(`Funding rate negative at ${sentiment.avgFundingRate.toFixed(3)}%`);
  }

  // Whale activity
  if (whaleStats.exchangeNetFlow < -50000000) {
    parts.push(`Whales accumulating ($${Math.abs(whaleStats.exchangeNetFlow / 1000000).toFixed(1)}M outflow from exchanges)`);
  } else if (whaleStats.exchangeNetFlow > 50000000) {
    parts.push(`Whales distributing ($${(whaleStats.exchangeNetFlow / 1000000).toFixed(1)}M inflow to exchanges)`);
  }

  // Key signals count
  const bullish = signals.filter(s => s.direction === 'bullish').length;
  const bearish = signals.filter(s => s.direction === 'bearish').length;
  parts.push(`${bullish} bullish vs ${bearish} bearish signals`);

  // Price action
  parts.push(`Price at $${techLevels.currentPrice.toLocaleString()} (High: $${techLevels.dailyHigh.toLocaleString()}, Low: $${techLevels.dailyLow.toLocaleString()})`);

  return parts.join(' | ');
}

// =============================================================================
// MOCK DATA
// =============================================================================

function getMockWhaleAlerts(count: number): WhaleAlert[] {
  const mockAlerts: WhaleAlert[] = [
    {
      id: 'mock-1',
      timestamp: Date.now() - 300000,
      blockchain: 'bitcoin',
      symbol: 'BTC',
      amount: 1250.5,
      amountUsd: 82500000,
      from: { address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', ownerType: 'exchange', owner: 'Binance' },
      to: { address: 'bc1qar0srrr7xfkvyymg4d4s5c6p5fwmlhs5xq5r5y', ownerType: 'wallet', owner: 'Unknown' },
      transactionType: 'exchange',
      exchange: 'Binance',
    },
    {
      id: 'mock-2',
      timestamp: Date.now() - 600000,
      blockchain: 'bitcoin',
      symbol: 'BTC',
      amount: 850.25,
      amountUsd: 56100000,
      from: { address: 'bc1qar0srrr7xfkvyymg4d4s5c6p5fwmlhs5xq5r5y', ownerType: 'wallet', owner: 'Whale' },
      to: { address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', ownerType: 'exchange', owner: 'Coinbase' },
      transactionType: 'exchange',
      exchange: 'Coinbase',
    },
    {
      id: 'mock-3',
      timestamp: Date.now() - 900000,
      blockchain: 'bitcoin',
      symbol: 'BTC',
      amount: 2100.0,
      amountUsd: 138600000,
      from: { address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', ownerType: 'exchange', owner: 'Binance' },
      to: { address: 'bc1qar0srrr7xfkvyymg4d4s5c6p5fwmlhs5xq5r5y', ownerType: 'wallet', owner: 'Unknown' },
      transactionType: 'exchange',
      exchange: 'Binance',
    },
    {
      id: 'mock-4',
      timestamp: Date.now() - 1200000,
      blockchain: 'bitcoin',
      symbol: 'BTC',
      amount: 450.75,
      amountUsd: 29750000,
      from: { address: 'bc1qar0srrr7xfkvyymg4d4s5c6p5fwmlhs5xq5r5y', ownerType: 'wallet', owner: 'OTC' },
      to: { address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', ownerType: 'exchange', owner: 'Kraken' },
      transactionType: 'exchange',
      exchange: 'Kraken',
    },
    {
      id: 'mock-5',
      timestamp: Date.now() - 1800000,
      blockchain: 'ethereum',
      symbol: 'ETH',
      amount: 8500.0,
      amountUsd: 14450000,
      from: { address: '0x28C6c06298d514Db089934071355E5743bf21d60', ownerType: 'exchange', owner: 'Coinbase' },
      to: { address: '0x21a31Ee1afC51d94C2EfCCa3aD2a4E3F2b5aBcde', ownerType: 'wallet', owner: 'DeFi' },
      transactionType: 'exchange',
      exchange: 'Coinbase',
    },
  ];
  
  return mockAlerts.slice(0, count);
}

// =============================================================================
// FORMATTING
// =============================================================================

export function formatWhaleAlertForDisplay(alert: WhaleAlert): string {
  const time = new Date(alert.timestamp).toLocaleTimeString();
  const amount = alert.amount.toFixed(4);
  const usd = formatUSD(alert.amountUsd);
  
  const direction = alert.transactionType === 'exchange' 
    ? `${alert.from.owner || 'Exchange'} → ${alert.to.owner || 'Exchange'}`
    : `Wallet ${alert.from.address.slice(0, 8)}... → Wallet ${alert.to.address.slice(0, 8)}...`;
  
  return `[${time}] ${alert.symbol}: ${amount} (${usd}) - ${direction}`;
}

function formatUSD(amount: number): string {
  if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${amount.toFixed(2)}`;
}
