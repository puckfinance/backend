/**
 * AI-Powered Market Analysis Service
 *
 * Uses Vercel AI SDK with Google Gemini Flash 3.0 for detailed
 * market analysis, sentiment interpretation, and trading insights.
 *
 * @author AI Assistant
 * @createdDate 2026-04-06
 */

import { generateText, streamText, Output } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { getCoinGeckoMarketData, getDeFiLlamaProtocols, getTotalDeFiTVL } from './whaleTracker';
import { getFearAndGreedIndex, getTechnicalLevels, getMarketSentiment, getWhaleActivity } from './whaleTracker';
import type { WhaleActivity } from './whaleTracker';
import { getMacroContext, type MacroContext } from './finnhub';
import { computeAllIndicators, type IndicatorSuite } from './technicalIndicators';
import logger from '../utils/Logger';

// Google Gemini model
const MODEL_ID = 'gemini-3-flash-preview';

// =============================================================================
// AI ANALYSIS TYPES
// =============================================================================

export interface AIDetailedAnalysis {
  symbol: string;
  timestamp: number;

  // Market Overview
  marketOverview: {
    price: number;
    priceChange24h: number;
    priceChangePercentage24h: number;
    marketCap: number;
    volume24h: number;
    circulatingSupply: number;
    ath: number;
    athDate: string;
    distanceFromAth: number;
  };

  // Technical Analysis
  technicalAnalysis: {
    currentPrice: number;
    dailyHigh: number;
    dailyLow: number;
    keySupport: number;
    keyResistance: number;
    supportBreakdown: string;
    resistanceBreakdown: string;
    volatilityAssessment: string;
    trendDirection: 'bullish' | 'bearish' | 'neutral';
  };

  // Sentiment Analysis
  sentimentAnalysis: {
    fearGreedIndex: number;
    fearGreedClassification: string;
    fundingRate: number;
    fundingInterpretation: string;
    longShortRatio: number;
    marketBias: string;
    sentimentVerdict: string;
  };

  // DeFi Context
  defiContext: {
    totalDeFiTVL: number;
    topProtocols: Array<{
      name: string;
      tvl: number;
      category: string;
    }>;
    defiHealth: string;
  };

  // AI Insights
  aiInsights: {
    keyObservations: string[];
    riskFactors: string[];
    opportunities: string[];
    tradingConsiderations: string[];
  };

  // Summary & Recommendation
  summary: {
    shortTermOutlook: string;
    mediumTermOutlook: string;
    keyLevelToWatch: string;
    recommendedStrategy: string;
    confidenceScore: number;
    overallVerdict: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  };

  // Trade Alert
  tradeAlert: {
    active: boolean;
    direction: 'LONG' | 'SHORT' | 'NONE';
    entryPrice: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
    riskRewardRatio: number | null;
    tradeSetup: string;
    reasoning: string;
  };
}

// =============================================================================
// DATA COLLECTOR
// =============================================================================

async function collectMarketData(symbol: string): Promise<{
  marketData: Awaited<ReturnType<typeof getCoinGeckoMarketData>>;
  sentiment: Awaited<ReturnType<typeof getMarketSentiment>>;
  technical: Awaited<ReturnType<typeof getTechnicalLevels>>;
  fearGreed: Awaited<ReturnType<typeof getFearAndGreedIndex>>;
  defi: {
    protocols: Awaited<ReturnType<typeof getDeFiLlamaProtocols>>;
    totalTvl: Awaited<ReturnType<typeof getTotalDeFiTVL>>;
  };
  macro: MacroContext;
  whales: WhaleActivity;
  indicators: IndicatorSuite;
}> {
  const [marketData, sentiment, technical, fearGreedData, defiProtocols, totalTvl, macro, whales] = await Promise.all([
    getCoinGeckoMarketData(symbol),
    getMarketSentiment(symbol),
    getTechnicalLevels(symbol),
    getFearAndGreedIndex(),
    getDeFiLlamaProtocols(5),
    getTotalDeFiTVL(),
    getMacroContext(),
    getWhaleActivity(symbol),
  ]);

  // Compute indicators from the klines already fetched by getTechnicalLevels
  const dailyCandles = technical.recentCandles.find((c) => c.timeframe === '1d')?.candles || [];
  const h4Candles = technical.recentCandles.find((c) => c.timeframe === '4h')?.candles || [];
  const h1Candles = technical.recentCandles.find((c) => c.timeframe === '1h')?.candles || [];
  const indicators = computeAllIndicators(dailyCandles, h4Candles, h1Candles);

  return {
    marketData,
    sentiment,
    technical,
    fearGreed: fearGreedData,
    defi: {
      protocols: defiProtocols,
      totalTvl,
    },
    macro,
    whales,
    indicators,
  };
}

// =============================================================================
// AI PROMPT BUILDER
// =============================================================================

function buildAnalysisPrompt(symbol: string, data: Awaited<ReturnType<typeof collectMarketData>>): string {
  const { marketData, sentiment, technical, fearGreed, defi } = data;

  const distanceFromAth =
    marketData.ath > 0 ? (((marketData.price - marketData.ath) / marketData.ath) * 100).toFixed(2) : '0';

  return `You are an expert crypto market analyst. Analyze the following market data for ${symbol} and provide a detailed, structured analysis.

## MARKET DATA
- Current Price: $${marketData.price.toLocaleString()}
- 24h Change: $${marketData.priceChange24h.toLocaleString()} (${marketData.priceChangePercentage24h.toFixed(2)}%)
- Market Cap: $${(marketData.marketCap / 1e9).toFixed(2)}B
- 24h Volume: $${(marketData.volume24h / 1e9).toFixed(2)}B
- Circulating Supply: ${marketData.circulatingSupply.toLocaleString()}
- All-Time High: $${marketData.ath.toLocaleString()} (${marketData.athDate})
- Distance from ATH: ${distanceFromAth}%

## TECHNICAL LEVELS
- Current Price: $${technical.currentPrice.toLocaleString()}
- 24h High: $${technical.dailyHigh.toLocaleString()}
- 24h Low: $${technical.dailyLow.toLocaleString()}
- Key Support: $${technical.keySupport.toLocaleString()}
- Key Resistance: $${technical.keyResistance.toLocaleString()}

## SENTIMENT DATA
- Fear & Greed Index: ${fearGreed.value} (${fearGreed.classification})
- Average Funding Rate: ${sentiment.avgFundingRate.toFixed(4)}%
- Long/Short Ratio: ${sentiment.longShortRatio.toFixed(2)}
- Market Bias: ${sentiment.marketBias}

## DEFI CONTEXT
- Total DeFi TVL: $${(defi.totalTvl.totalTvl / 1e9).toFixed(1)}B
- Top Protocols by TVL:
${defi.protocols
  .slice(0, 5)
  .map((p, i) => `  ${i + 1}. ${p.name}: $${(p.tvl / 1e9).toFixed(1)}B (${p.category})`)
  .join('\n')}

---

Provide your analysis in the following JSON format ONLY (no markdown, no extra text):
{
  "technicalAnalysis": {
    "supportBreakdown": "Explain where the key support levels are and their significance",
    "resistanceBreakdown": "Explain where the key resistance levels are and their significance", 
    "volatilityAssessment": "Assess the current volatility and what it means for traders",
    "trendDirection": "bullish, bearish, or neutral - choose one"
  },
  "sentimentAnalysis": {
    "fundingInterpretation": "What does the funding rate tell us about market sentiment?",
    "sentimentVerdict": "Based on Fear & Greed and funding rates, what is the overall sentiment verdict?"
  },
  "defiContext": {
    "defiHealth": "Assess the overall DeFi health based on TVL and top protocols"
  },
  "aiInsights": {
    "keyObservations": ["List 3-4 key observations about this asset", "Be specific and data-driven"],
    "riskFactors": ["List 2-3 key risk factors", "Consider both technical and fundamental risks"],
    "opportunities": ["List 2-3 potential opportunities", "Be specific about entry points and scenarios"],
    "tradingConsiderations": ["List 2-3 things traders should consider", "Include both short-term and medium-term views"]
  },
  "summary": {
    "shortTermOutlook": "1-2 sentence outlook for the next 24-72 hours",
    "mediumTermOutlook": "1-2 sentence outlook for the next 1-4 weeks",
    "keyLevelToWatch": "Specify a key price level to watch with explanation",
    "recommendedStrategy": "1-2 sentence strategy recommendation",
    "confidenceScore": "A number from 0-100 representing your confidence in this analysis"
  },
  "tradeAlert": {
    "active": "true if there's a clear trade setup, false otherwise",
    "direction": "LONG or SHORT or NONE - based on current market conditions",
    "entryPrice": "Suggested entry price (current price if no pullback needed)",
    "stopLoss": "Stop loss price - should be below support for longs, above resistance for shorts",
    "takeProfit": "Take profit price - should be at next resistance for longs, next support for shorts",
    "riskRewardRatio": "Calculate as (TP - Entry) / (Entry - SL). Example: 2.5 means 2.5:1 reward-to-risk",
    "tradeSetup": "Brief description of the trade setup (e.g., 'Breakout retest', 'Pullback to support')",
    "reasoning": "1-2 sentence explanation of why this trade makes sense now"
  }
}

Respond ONLY with valid JSON matching this exact format. No markdown, no explanation, just the JSON.`;
}

// =============================================================================
// AI RESPONSE SCHEMA (Zod for generateObject)
// =============================================================================

const TechnicalAnalysisSchema = z.object({
  supportBreakdown: z.string(),
  resistanceBreakdown: z.string(),
  volatilityAssessment: z.string(),
  trendDirection: z.enum(['bullish', 'bearish', 'neutral']),
});

const SentimentAnalysisSchema = z.object({
  fundingInterpretation: z.string(),
  sentimentVerdict: z.string(),
});

const DeFiContextSchema = z.object({
  defiHealth: z.string(),
});

const AIInsightsSchema = z.object({
  keyObservations: z.array(z.string()),
  riskFactors: z.array(z.string()),
  opportunities: z.array(z.string()),
  tradingConsiderations: z.array(z.string()),
});

const SummarySchema = z.object({
  shortTermOutlook: z.string(),
  mediumTermOutlook: z.string(),
  keyLevelToWatch: z.string(),
  recommendedStrategy: z.string(),
  confidenceScore: z.number(),
  overallVerdict: z.enum(['STRONG_BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG_SELL']),
});

const TradeAlertSchema = z.object({
  active: z.boolean(),
  direction: z.enum(['LONG', 'SHORT', 'NONE']),
  entryPrice: z.number().nullable(),
  stopLoss: z.number().nullable(),
  takeProfit: z.number().nullable(),
  riskRewardRatio: z.number().nullable(),
  tradeSetup: z.string(),
  reasoning: z.string(),
});

const AIAnalysisResponseSchema = z.object({
  technicalAnalysis: TechnicalAnalysisSchema,
  sentimentAnalysis: SentimentAnalysisSchema,
  defiContext: DeFiContextSchema,
  aiInsights: AIInsightsSchema,
  summary: SummarySchema,
  tradeAlert: TradeAlertSchema,
});

// =============================================================================
// AI ANALYSIS FUNCTION
// =============================================================================

export async function getAIAnalysis(symbol: string = 'BTC'): Promise<AIDetailedAnalysis> {
  try {
    // Collect all market data in parallel
    const data = await collectMarketData(symbol);
    const { marketData, sentiment, technical, defi } = data;

    // Calculate distance from ATH
    const distanceFromAth = marketData.ath > 0 ? ((marketData.price - marketData.ath) / marketData.ath) * 100 : 0;

    // Build prompt for AI
    const prompt = buildAnalysisPrompt(symbol, data);

    // Generate structured analysis using generateText with Output API
    const { output: parsedAnalysis } = (await generateText({
      model: google(MODEL_ID),
      output: Output.object({
        schema: AIAnalysisResponseSchema as any,
      }),
      prompt,
      temperature: 0,
    })) as { output: z.infer<typeof AIAnalysisResponseSchema> };

    // Build response
    const analysis: AIDetailedAnalysis = {
      symbol,
      timestamp: Date.now(),

      marketOverview: {
        price: marketData.price,
        priceChange24h: marketData.priceChange24h,
        priceChangePercentage24h: marketData.priceChangePercentage24h,
        marketCap: marketData.marketCap,
        volume24h: marketData.volume24h,
        circulatingSupply: marketData.circulatingSupply,
        ath: marketData.ath,
        athDate: marketData.athDate,
        distanceFromAth,
      },

      technicalAnalysis: {
        currentPrice: technical.currentPrice,
        dailyHigh: technical.dailyHigh,
        dailyLow: technical.dailyLow,
        keySupport: technical.keySupport,
        keyResistance: technical.keyResistance,
        supportBreakdown: parsedAnalysis.technicalAnalysis.supportBreakdown,
        resistanceBreakdown: parsedAnalysis.technicalAnalysis.resistanceBreakdown,
        volatilityAssessment: parsedAnalysis.technicalAnalysis.volatilityAssessment,
        trendDirection: parsedAnalysis.technicalAnalysis.trendDirection,
      },

      sentimentAnalysis: {
        fearGreedIndex: sentiment.fearGreedIndex,
        fearGreedClassification: sentiment.fearGreedClassification,
        fundingRate: sentiment.avgFundingRate,
        fundingInterpretation: parsedAnalysis.sentimentAnalysis.fundingInterpretation,
        longShortRatio: sentiment.longShortRatio,
        marketBias: sentiment.marketBias,
        sentimentVerdict: parsedAnalysis.sentimentAnalysis.sentimentVerdict,
      },

      defiContext: {
        totalDeFiTVL: defi.totalTvl.totalTvl,
        topProtocols: defi.protocols.slice(0, 5).map((p) => ({
          name: p.name,
          tvl: p.tvl,
          category: p.category,
        })),
        defiHealth: parsedAnalysis.defiContext.defiHealth,
      },

      aiInsights: {
        keyObservations: parsedAnalysis.aiInsights.keyObservations,
        riskFactors: parsedAnalysis.aiInsights.riskFactors,
        opportunities: parsedAnalysis.aiInsights.opportunities,
        tradingConsiderations: parsedAnalysis.aiInsights.tradingConsiderations,
      },

      summary: {
        shortTermOutlook: parsedAnalysis.summary.shortTermOutlook,
        mediumTermOutlook: parsedAnalysis.summary.mediumTermOutlook,
        keyLevelToWatch: parsedAnalysis.summary.keyLevelToWatch,
        recommendedStrategy: parsedAnalysis.summary.recommendedStrategy,
        confidenceScore: parsedAnalysis.summary.confidenceScore,
        overallVerdict: parsedAnalysis.summary.overallVerdict,
      },

      tradeAlert: {
        active: parsedAnalysis.tradeAlert.active,
        direction: parsedAnalysis.tradeAlert.direction,
        entryPrice: parsedAnalysis.tradeAlert.entryPrice,
        stopLoss: parsedAnalysis.tradeAlert.stopLoss,
        takeProfit: parsedAnalysis.tradeAlert.takeProfit,
        riskRewardRatio: parsedAnalysis.tradeAlert.riskRewardRatio,
        tradeSetup: parsedAnalysis.tradeAlert.tradeSetup,
        reasoning: parsedAnalysis.tradeAlert.reasoning,
      },
    };

    return analysis;
  } catch (error: any) {
    logger.error('AI Analysis error:', error.message);
    throw error;
  }
}

// =============================================================================
// QUICK MARKET SUMMARY SCHEMA
// =============================================================================

const QuickSummarySchema = z.object({
  verdict: z.enum(['STRONG_BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG_SELL']),
  confidence: z.number(),
  insight: z.string(),
});

// =============================================================================
// QUICK MARKET SUMMARY (Lightweight version)
// =============================================================================

export async function getAIQuickSummary(symbol: string = 'BTC'): Promise<{
  symbol: string;
  timestamp: number;
  price: number;
  change24h: number;
  sentiment: string;
  verdict: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  insight: string;
}> {
  try {
    const [marketData, fearGreed, sentiment] = await Promise.all([
      getCoinGeckoMarketData(symbol),
      getFearAndGreedIndex(),
      getMarketSentiment(symbol),
    ]);

    const { output: parsed } = (await generateText({
      model: google(MODEL_ID),
      output: Output.object({
        schema: QuickSummarySchema as any,
      }),
      prompt: `Give a one-sentence trading insight for ${symbol} at $${marketData.price.toLocaleString()},
      up ${marketData.priceChangePercentage24h.toFixed(2)}% in 24h.
      Fear & Greed Index is ${fearGreed.value} (${fearGreed.classification}).
      Market bias from funding rates: ${sentiment.marketBias}.

      Respond with a JSON object with verdict (STRONG_BUY/BUY/NEUTRAL/SELL/STRONG_SELL), confidence (0-100), and insight (one sentence).`,
      temperature: 0.5,
    })) as { output: z.infer<typeof QuickSummarySchema> };

    return {
      symbol,
      timestamp: Date.now(),
      price: marketData.price,
      change24h: marketData.priceChangePercentage24h,
      sentiment: fearGreed.classification,
      verdict: parsed.verdict,
      confidence: parsed.confidence,
      insight: parsed.insight,
    };
  } catch (error: any) {
    logger.error('AI Quick Summary error:', error.message);
    throw error;
  }
}

// =============================================================================
// TIMEFRAME FORMATTER FOR PROMPT
// =============================================================================

import type { TimeframeIndicators } from './technicalIndicators';

function formatTimeframe(tf: TimeframeIndicators, _currentPrice: number): string {
  const label = tf.timeframe.toUpperCase();
  return `### ${label} Timeframe
- **EMA Trend**: ${tf.emaTrend
    .replace('_', ' ')
    .toUpperCase()} | EMA 9: $${tf.ema9.value.toLocaleString()} | 21: $${tf.ema21.value.toLocaleString()} | 50: $${tf.ema50.value.toLocaleString()} | 200: $${tf.ema200.value.toLocaleString()}
- **RSI (14)**: ${tf.rsi.value} — ${tf.rsi.condition.toUpperCase()}${
    tf.rsi.value > 70 ? ' ⚠️ OVERBOUGHT' : tf.rsi.value < 30 ? ' ⚠️ OVERSOLD' : ''
  }
- **MACD**: Histogram ${tf.macd.histogram} (${tf.macd.trend.toUpperCase()})${
    tf.macd.histogramFlipping ? ' 🔄 FLIPPING' : ''
  } | Line: ${tf.macd.macdLine} Signal: ${tf.macd.signalLine}
- **BBands**: Upper $${tf.bollinger.upper.toLocaleString()} | Mid $${tf.bollinger.middle.toLocaleString()} | Lower $${tf.bollinger.lower.toLocaleString()} | %B: ${(
    tf.bollinger.percentB * 100
  ).toFixed(0)}%${tf.bollinger.squeeze ? ' 🔥 SQUEEZE' : ''}
- **ATR**: $${tf.atr.value.toLocaleString()} | **VWAP**: $${tf.vwap.value.toLocaleString()} (${tf.vwap.priceRelation})
- **Structure**: ${tf.structure.trend.toUpperCase()} | Swing H: $${tf.structure.swingHigh.toLocaleString()} | Swing L: $${tf.structure.swingLow.toLocaleString()}
${
  tf.structure.lastBoS
    ? `  - BoS: ${tf.structure.lastBoS.direction.toUpperCase()} at $${tf.structure.lastBoS.price.toLocaleString()}`
    : ''
}
${
  tf.structure.lastCHoCH
    ? `  - ⚠️ CHoCH: ${tf.structure.lastCHoCH.direction.toUpperCase()} at $${tf.structure.lastCHoCH.price.toLocaleString()} — REVERSAL SIGNAL`
    : ''
}
- **FVGs** (unfilled): ${
    tf.fvgs.length > 0
      ? tf.fvgs
          .map((f) => `${f.type === 'bullish' ? '🟢' : '🔴'} $${f.low.toLocaleString()}-$${f.high.toLocaleString()}`)
          .join(', ')
      : 'None'
  }
- **Order Blocks** (unmitigated): ${
    tf.orderBlocks.length > 0
      ? tf.orderBlocks
          .map(
            (ob) =>
              `${ob.type === 'bullish' ? '🟢' : '🔴'} $${ob.low.toLocaleString()}-$${ob.high.toLocaleString()} (${
                ob.strength
              }x vol)`,
          )
          .join(', ')
      : 'None'
  }`;
}

// =============================================================================
// STREAMING ANALYSIS PROMPT
// =============================================================================

function buildStreamingPrompt(symbol: string, data: Awaited<ReturnType<typeof collectMarketData>>): string {
  const { marketData, sentiment, technical, fearGreed, defi, macro, whales, indicators } = data;

  const distanceFromAth =
    marketData.ath > 0 ? (((marketData.price - marketData.ath) / marketData.ath) * 100).toFixed(2) : '0';

  // Build macro events string
  const macroEventsStr =
    macro.highImpactEvents.length > 0
      ? macro.highImpactEvents
          .slice(0, 8)
          .map((e) => {
            const parts = [`- ${e.event} (${e.time})`];
            if (e.estimate !== null) parts[0] += ` | Est: ${e.estimate}`;
            if (e.previous !== null) parts[0] += ` | Prev: ${e.previous}`;
            if (e.actual !== null) parts[0] += ` | **Actual: ${e.actual}**`;
            return parts[0];
          })
          .join('\n')
      : 'No high-impact US events in the next 7 days';

  return `You are an expert crypto and macro market analyst. Analyze the following real-time market data for ${symbol} with macro confluence and provide a comprehensive, well-formatted analysis using Markdown.

## CURRENT MARKET DATA
- Current Price: $${marketData.price.toLocaleString()}
- 24h Change: $${marketData.priceChange24h.toLocaleString()} (${marketData.priceChangePercentage24h.toFixed(2)}%)
- Market Cap: $${(marketData.marketCap / 1e9).toFixed(2)}B
- 24h Volume: $${(marketData.volume24h / 1e9).toFixed(2)}B
- Circulating Supply: ${marketData.circulatingSupply.toLocaleString()}
- All-Time High: $${marketData.ath.toLocaleString()} (${marketData.athDate})
- Distance from ATH: ${distanceFromAth}%

## TECHNICAL LEVELS
- 24h High: $${technical.dailyHigh.toLocaleString()}
- 24h Low: $${technical.dailyLow.toLocaleString()}
- Key Support (nearest swing low): $${technical.keySupport.toLocaleString()}
- Key Resistance (nearest swing high): $${technical.keyResistance.toLocaleString()}

## PIVOT POINTS (Previous Day)
- R3: $${technical.pivotPoints.r3.toLocaleString()} | R2: $${technical.pivotPoints.r2.toLocaleString()} | R1: $${technical.pivotPoints.r1.toLocaleString()}
- Pivot: $${technical.pivotPoints.pivot.toLocaleString()}
- S1: $${technical.pivotPoints.s1.toLocaleString()} | S2: $${technical.pivotPoints.s2.toLocaleString()} | S3: $${technical.pivotPoints.s3.toLocaleString()}

## SWING LEVELS (Multi-Timeframe: 1D, 4H, 1H - Clustered)
${
  technical.swingLevels
    .slice(0, 8)
    .map(
      (l) =>
        `- ${l.type === 'support' ? '🟢 Support' : '🔴 Resistance'}: $${l.price.toLocaleString()} (strength: ${
          l.strength
        }, from ${l.timeframe})`,
    )
    .join('\n') || 'No swing levels detected'
}

## RECENT DAILY OHLCV (Last 7 Days)
${
  technical.recentCandles
    .find((c) => c.timeframe === '1d')
    ?.candles.slice(-7)
    .map(
      (c) =>
        `- O: $${c.open.toLocaleString()} H: $${c.high.toLocaleString()} L: $${c.low.toLocaleString()} C: $${c.close.toLocaleString()} Vol: $${(
          (c.volume * ((c.open + c.close) / 2)) /
          1e9
        ).toFixed(2)}B`,
    )
    .join('\n') || 'N/A'
}

## MULTI-TIMEFRAME TECHNICAL INDICATORS (Computed from Binance Klines)

### CONFLUENCE SUMMARY
- Overall Trend: ${indicators.confluence.overallTrend.replace('_', ' ').toUpperCase()}
- Aligned Timeframes: ${indicators.confluence.alignedTimeframes}/3
${
  indicators.confluence.conflictingSignals.length > 0
    ? '⚠️ Conflicting Signals:\n' + indicators.confluence.conflictingSignals.map((s) => `  - ${s}`).join('\n')
    : '✅ No conflicting signals'
}

${formatTimeframe(indicators['1d'], marketData.price)}
${formatTimeframe(indicators['4h'], marketData.price)}
${formatTimeframe(indicators['1h'], marketData.price)}

## SENTIMENT DATA
- Fear & Greed Index: ${fearGreed.value} (${fearGreed.classification})
- Average Funding Rate: ${sentiment.avgFundingRate.toFixed(4)}%
- Long/Short Ratio: ${sentiment.longShortRatio.toFixed(2)}
- Market Bias: ${sentiment.marketBias}

## DXY (US DOLLAR INDEX) - MACRO CONFLUENCE
- DXY Price: ${macro.dxy.price > 0 ? macro.dxy.price.toString() : 'Unavailable'}
- EUR/USD: ${macro.dxy.eurusd || 'N/A'}
- GBP/USD: ${macro.dxy.gbpusd || 'N/A'}
- USD/JPY: ${macro.dxy.usdjpy || 'N/A'}
Note: DXY and crypto (especially BTC) typically have an inverse correlation. A rising DXY signals dollar strength, which often pressures risk assets including crypto. A falling DXY is typically bullish for crypto.

## UPCOMING HIGH-IMPACT US ECONOMIC EVENTS (Next 7 Days)
${macroEventsStr}

## WHALE & SMART MONEY ACTIVITY (Real Data from Binance Futures + Blockchain)
### Taker Buy/Sell Ratio (Aggressive Market Orders)
- Latest: ${whales.takerBuySellRatio.latest.toFixed(3)} (${
    whales.takerBuySellRatio.latest > 1 ? 'buyers aggressive' : 'sellers aggressive'
  })
- 24h Average: ${whales.takerBuySellRatio.avg24h} | Trend: ${whales.takerBuySellRatio.trend}
### Top Trader Positions (Binance Pro Traders)
- Long Accounts: ${(whales.topTraderPositions.longAccountRatio * 100).toFixed(1)}% | Short Accounts: ${(
    whales.topTraderPositions.shortAccountRatio * 100
  ).toFixed(1)}%
- L/S Ratio: ${whales.topTraderPositions.longShortRatio} | 24h Trend: ${whales.topTraderPositions.trend24h}
### Open Interest Flow
- Current OI: ${whales.openInterestFlow.currentOI.toLocaleString()} ${symbol} ($${(
    whales.openInterestFlow.currentOIValue / 1e9
  ).toFixed(2)}B)
- 24h Change: ${whales.openInterestFlow.change24h > 0 ? '+' : ''}${whales.openInterestFlow.change24h}% | Trend: ${
    whales.openInterestFlow.trend
  }
### On-Chain Whale Transactions (BTC Mempool)
- Large Txs (>10 BTC): ${whales.onChainWhales.largeTransactions}
- Total Volume: ${whales.onChainWhales.totalVolumeBTC} BTC (avg ${whales.onChainWhales.avgTransactionBTC} BTC/tx)
- Assessment: ${whales.onChainWhales.interpretation}

## DEFI CONTEXT
- Total DeFi TVL: $${(defi.totalTvl.totalTvl / 1e9).toFixed(1)}B
- Top Protocols: ${defi.protocols
    .slice(0, 5)
    .map((p) => `${p.name} ($${(p.tvl / 1e9).toFixed(1)}B)`)
    .join(', ')}

---

Please write a detailed analysis with the following sections using proper Markdown formatting:

## 📊 Market Overview
Summarize the current price action, volume, and market cap context.

## 📈 Technical Analysis
Analyze support/resistance levels, trend direction, and volatility. Be specific about price levels.

## 💵 DXY & Macro Confluence
**This is critical.** Analyze the DXY level and its implications for ${symbol}. Discuss:
- Current DXY trend and what it means for crypto
- How upcoming economic events (CPI, FOMC, NFP, etc.) could impact ${symbol}
- Dollar strength/weakness narrative and risk-on/risk-off dynamics
- Any divergence between DXY and crypto that traders should note

## 🐋 Whale & Smart Money Analysis
**Analyze the real whale data provided.** This is not estimated — it's from Binance Futures and on-chain data:
- What does the taker buy/sell ratio tell us? Are whales aggressively buying or selling?
- How are top traders positioned? Is the smart money long or short? Is the trend shifting?
- What does the open interest change mean? (Rising OI + rising price = strong trend. Rising OI + falling price = shorts loading up)
- On-chain whale transactions: Are large holders moving coins? What could this mean?
- **Overall smart money verdict**: Are whales accumulating or distributing?

## 🧠 Sentiment Analysis
Interpret the Fear & Greed Index, funding rates, and long/short ratio. What do they tell us?

## 🏦 DeFi Context
Brief assessment of the broader DeFi ecosystem health and its impact on ${symbol}.

## 🔍 Key Insights
- **Observations**: 3-4 data-driven observations (include macro + whale factors)
- **Risk Factors**: 2-3 key risks to watch (include macro event risks + whale divergences)
- **Opportunities**: 2-3 potential opportunities

## 🎯 Trading Considerations
Provide a specific trade setup if one exists:
- Direction (Long/Short/Neutral)
- Entry, Stop Loss, Take Profit levels
- Risk/Reward ratio
- Setup description
- **Macro risk warning** if any high-impact events are upcoming

## 📝 Summary & Outlook
- **Short-term (24-72h)**: Brief outlook considering upcoming macro events
- **Medium-term (1-4 weeks)**: Brief outlook
- **Verdict**: STRONG_BUY / BUY / NEUTRAL / SELL / STRONG_SELL with confidence score (0-100)
- **Key Level to Watch**: Specific price level with explanation

Be concise but thorough. Use bold for important numbers and levels. Format for readability.`;
}

// =============================================================================
// TRADE ALERT EXTRACTION (Structured output from streamed text)
// =============================================================================

const StreamedTradeAlertSchema = z.object({
  active: z.boolean(),
  direction: z.enum(['LONG', 'SHORT', 'NONE']),
  entryPrice: z.number().nullable(),
  stopLoss: z.number().nullable(),
  takeProfit: z.number().nullable(),
  riskRewardRatio: z.number().nullable(),
  tradeSetup: z.string(),
  reasoning: z.string(),
});

export async function extractTradeAlert(analysisText: string): Promise<{
  active: boolean;
  direction: 'LONG' | 'SHORT' | 'NONE';
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskRewardRatio: number | null;
  tradeSetup: string;
  reasoning: string;
}> {
  try {
    const { output } = (await generateText({
      model: google(MODEL_ID),
      output: Output.object({
        schema: StreamedTradeAlertSchema as any,
      }),
      prompt: `Extract the trade setup / trade alert from the following AI market analysis text.

If the analysis contains specific entry, stop loss, and take profit levels, set active to true and fill in all fields.
If no clear trade setup exists, set active to false and all numeric fields to null.

Rules:
- direction must be LONG, SHORT, or NONE
- entryPrice, stopLoss, takeProfit are dollar amounts (numbers) or null
- riskRewardRatio is the reward-to-risk ratio as a number (e.g. 2.5 means 2.5:1) or null
- tradeSetup is a brief description of the setup type (e.g. "Breakout retest", "Pullback to support")
- reasoning is a 1-2 sentence explanation

ANALYSIS TEXT:
${analysisText}`,
      temperature: 0,
    })) as { output: z.infer<typeof StreamedTradeAlertSchema> };

    return output;
  } catch (error: any) {
    logger.error('Trade alert extraction error:', error.message);
    return {
      active: false,
      direction: 'NONE',
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
      riskRewardRatio: null,
      tradeSetup: '',
      reasoning: '',
    };
  }
}

// =============================================================================
// STREAMING ANALYSIS FUNCTION
// =============================================================================

export async function streamAIAnalysis(symbol: string = 'BTC') {
  const data = await collectMarketData(symbol);
  const prompt = buildStreamingPrompt(symbol, data);

  const result = streamText({
    model: google(MODEL_ID),
    prompt,
    temperature: 0,
  });

  return {
    stream: result,
    marketData: {
      symbol,
      price: data.marketData.price,
      priceChange24h: data.marketData.priceChange24h,
      priceChangePercentage24h: data.marketData.priceChangePercentage24h,
      marketCap: data.marketData.marketCap,
      volume24h: data.marketData.volume24h,
      ath: data.marketData.ath,
      fearGreedIndex: data.fearGreed.value,
      fearGreedClassification: data.fearGreed.classification,
      keySupport: data.technical.keySupport,
      keyResistance: data.technical.keyResistance,
      // Macro data
      dxy: data.macro.dxy.price,
      eurusd: data.macro.dxy.eurusd,
      gbpusd: data.macro.dxy.gbpusd,
      usdjpy: data.macro.dxy.usdjpy,
      upcomingEvents: data.macro.highImpactEvents.slice(0, 5).map((e) => ({
        event: e.event,
        time: e.time,
        impact: e.impact,
        actual: e.actual,
        estimate: e.estimate,
        previous: e.previous,
      })),
      // Whale data
      whales: {
        takerRatio: data.whales.takerBuySellRatio.latest,
        takerTrend: data.whales.takerBuySellRatio.trend,
        topTraderLongPct: data.whales.topTraderPositions.longAccountRatio,
        topTraderTrend: data.whales.topTraderPositions.trend24h,
        oiValue: data.whales.openInterestFlow.currentOIValue,
        oiChange24h: data.whales.openInterestFlow.change24h,
        onChainLargeTxs: data.whales.onChainWhales.largeTransactions,
        onChainVolumeBTC: data.whales.onChainWhales.totalVolumeBTC,
      },
      // Indicators
      indicators: {
        // Use daily as primary, show all TFs
        rsi: data.indicators['1d'].rsi.value,
        rsiCondition: data.indicators['1d'].rsi.condition,
        rsi4h: data.indicators['4h'].rsi.value,
        rsi1h: data.indicators['1h'].rsi.value,
        macdHistogram: data.indicators['1d'].macd.histogram,
        macdTrend: data.indicators['1d'].macd.trend,
        emaTrend: data.indicators.confluence.overallTrend,
        alignedTimeframes: data.indicators.confluence.alignedTimeframes,
        bollingerSqueeze: data.indicators['1d'].bollinger.squeeze,
        bollingerPercentB: data.indicators['1d'].bollinger.percentB,
        atr: data.indicators['1d'].atr.value,
        vwapRelation: data.indicators['4h'].vwap.priceRelation,
        marketStructure: data.indicators['1d'].structure.trend,
        fvgCount: data.indicators['4h'].fvgs.length,
        obCount: data.indicators['4h'].orderBlocks.length,
        conflictingSignals: data.indicators.confluence.conflictingSignals,
      },
    },
  };
}
