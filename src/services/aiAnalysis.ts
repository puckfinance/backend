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
import { computeAllIndicators, type IndicatorSuite, type Timeframe, type TimeframeIndicators, type Candle } from './technicalIndicators';
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

export type TimeframeSet = 'higher' | 'lower' | 'all';

const HIGHER_TFS: Timeframe[] = ['1d', '4h', '1h'];
const LOWER_TFS: Timeframe[] = ['15m', '5m'];
const ALL_TFS: Timeframe[] = ['1d', '4h', '1h', '15m', '5m'];

function getTimeframesForSet(tfSet: TimeframeSet): Timeframe[] {
  switch (tfSet) {
    case 'higher': return HIGHER_TFS;
    case 'lower': return LOWER_TFS;
    case 'all': return ALL_TFS;
  }
}

async function collectMarketData(symbol: string, tfSet: TimeframeSet = 'all'): Promise<{
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
  tfSet: TimeframeSet;
  selectedTimeframes: Timeframe[];
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

  const selectedTimeframes = getTimeframesForSet(tfSet);
  const candleMap: Partial<Record<Timeframe, Candle[]>> = {};
  for (const tf of selectedTimeframes) {
    const candles = technical.recentCandles.find((c) => c.timeframe === tf)?.candles || [];
    if (candles.length > 0) candleMap[tf] = candles;
  }
  const indicators = computeAllIndicators(candleMap);

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
    tfSet,
    selectedTimeframes,
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
  const { marketData, sentiment, technical, fearGreed, defi, macro, whales, indicators, tfSet, selectedTimeframes } = data;

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
${tfSet === 'lower' ? '\n**FOCUS: Lower Timeframe Scalping Analysis (15m, 5m)**\n' : tfSet === 'higher' ? '\n**FOCUS: Higher Timeframe Swing Analysis (1D, 4H, 1H)**\n' : ''}

### CONFLUENCE SUMMARY
- Overall Trend: ${indicators.confluence.overallTrend.replace('_', ' ').toUpperCase()}
- Aligned Timeframes: ${indicators.confluence.alignedTimeframes}/${selectedTimeframes.length}
${
  indicators.confluence.conflictingSignals.length > 0
    ? '⚠️ Conflicting Signals:\n' + indicators.confluence.conflictingSignals.map((s) => `  - ${s}`).join('\n')
    : '✅ No conflicting signals'
}

${selectedTimeframes.map((tf) => {
  const tfData = indicators.timeframes[tf];
  return tfData ? formatTimeframe(tfData, marketData.price) : '';
}).filter(Boolean).join('\n\n')}

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
${
  tfSet === 'lower'
    ? `**Focus on scalping and short-term price action using 15m and 5m timeframes.**
Analyze micro support/resistance levels, intraday trend direction, and short-term volatility.
Identify precise entry/exit zones for quick trades. Highlight any 15m/5m chart patterns (flags, wedges, etc.).
Comment on intraday momentum and whether the short-term trend aligns with or diverges from the bigger picture.`
    : tfSet === 'higher'
    ? `Analyze support/resistance levels, trend direction, and volatility. Be specific about price levels.
Focus on swing trading setups using daily, 4H, and 1H timeframes.`
    : `Analyze support/resistance levels, trend direction, and volatility. Be specific about price levels.
Include BOTH swing trading perspective (1D/4H/1H) and scalping perspective (15m/5m).
Highlight any divergences between higher and lower timeframes.`
}

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
${
  tfSet === 'lower'
    ? `- Suggested holding time (minutes to hours) and ideal take-profit increments`
    : tfSet === 'higher'
    ? `- Suggested holding time (days to weeks)`
    : `- Suggested holding time based on the dominant timeframe`
}

## 📝 Summary & Outlook
- **Short-term (${tfSet === 'lower' ? '1-4 hours' : '24-72h'})**: Brief outlook considering upcoming macro events
- **Medium-term (${tfSet === 'lower' ? '1-24 hours' : '1-4 weeks'})**: Brief outlook
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
        prompt: `You are a trade signal extractor. Read the following market analysis and extract ANY trade signal, recommendation, or setup mentioned.

IMPORTANT: Even if the analysis is cautious or conditional, if it mentions ANY direction (bullish/bearish/long/short), entry zone, support/resistance levels, or stop loss / take profit targets, you MUST extract them into a trade alert with active=true.

If the analysis says "NEUTRAL" or explicitly says "no trade" or "stay out", then set active=false.
If the analysis provides a direction (long/short), entry price or zone, stop loss, or take profit targets — even conditionally — set active=true.

Rules:
- direction: LONG if bullish/long recommended, SHORT if bearish/short recommended, NONE only if truly no directional bias
- entryPrice: Use the current price or the entry level mentioned (a number, not null, if active)
- stopLoss: Use the stop loss level mentioned or nearest support (for long) / resistance (for short)
- takeProfit: Use the take profit target mentioned or next resistance (for long) / support (for short)
- riskRewardRatio: Calculate (TP - Entry) / (Entry - SL) as a number
- tradeSetup: Brief description of the setup
- reasoning: 1-2 sentence explanation from the analysis

ANALYSIS TEXT:
${analysisText}`,
      temperature: 0,
    })) as { output: z.infer<typeof StreamedTradeAlertSchema> };

    return output;
  } catch (error: any) {
    logger.error('Trade alert extraction error (attempt 1):', error.message);
    try {
      const { output } = (await generateText({
        model: google(MODEL_ID),
        output: Output.object({
          schema: StreamedTradeAlertSchema as any,
        }),
      prompt: `You are a trade signal extractor. Read the following market analysis and extract ANY trade signal, recommendation, or setup mentioned.

IMPORTANT: Even if the analysis is cautious or conditional, if it mentions ANY direction (bullish/bearish/long/short), entry zone, support/resistance levels, or stop loss / take profit targets, you MUST extract them into a trade alert with active=true.

If the analysis says "NEUTRAL" or explicitly says "no trade" or "stay out", then set active=false.
If the analysis provides a direction (long/short), entry price or zone, stop loss, or take profit targets — even conditionally — set active=true.

Rules:
- direction: LONG if bullish/long recommended, SHORT if bearish/short recommended, NONE only if truly no directional bias
- entryPrice: Use the current price or the entry level mentioned (a number, not null, if active)
- stopLoss: Use the stop loss level mentioned or nearest support (for long) / resistance (for short)
- takeProfit: Use the take profit target mentioned or next resistance (for long) / support (for short)
- riskRewardRatio: Calculate (TP - Entry) / (Entry - SL) as a number
- tradeSetup: Brief description of the setup
- reasoning: 1-2 sentence explanation from the analysis

ANALYSIS TEXT:
${analysisText}`,
        temperature: 0,
      })) as { output: z.infer<typeof StreamedTradeAlertSchema> };
      return output;
    } catch (retryError: any) {
      logger.error('Trade alert extraction retry failed:', retryError.message);
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
}

// =============================================================================
// STREAMING ANALYSIS FUNCTION
// =============================================================================

export async function streamAIAnalysis(symbol: string = 'BTC', tfSet: TimeframeSet = 'all') {
  const data = await collectMarketData(symbol, tfSet);
  const { selectedTimeframes } = data;
  const primary = selectedTimeframes[0];
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
      indicators: {
        rsi: data.indicators.timeframes[primary]?.rsi.value ?? 50,
        rsiCondition: data.indicators.timeframes[primary]?.rsi.condition ?? 'neutral',
        rsi4h: data.indicators.timeframes['4h']?.rsi.value,
        rsi1h: data.indicators.timeframes['1h']?.rsi.value,
        rsi15m: data.indicators.timeframes['15m']?.rsi.value,
        rsi5m: data.indicators.timeframes['5m']?.rsi.value,
        macdHistogram: data.indicators.timeframes[primary]?.macd.histogram ?? 0,
        macdTrend: data.indicators.timeframes[primary]?.macd.trend ?? 'neutral',
        emaTrend: data.indicators.confluence.overallTrend,
        alignedTimeframes: data.indicators.confluence.alignedTimeframes,
        totalCheckedTimeframes: selectedTimeframes.length,
        bollingerSqueeze: data.indicators.timeframes[primary]?.bollinger.squeeze ?? false,
        bollingerPercentB: data.indicators.timeframes[primary]?.bollinger.percentB ?? 0.5,
        atr: data.indicators.timeframes[primary]?.atr.value ?? 0,
        vwapRelation: data.indicators.timeframes['4h']?.vwap.priceRelation ?? data.indicators.timeframes['15m']?.vwap.priceRelation ?? 'below',
        marketStructure: data.indicators.timeframes[primary]?.structure.trend ?? 'ranging',
        fvgCount: data.indicators.timeframes['4h']?.fvgs.length ?? data.indicators.timeframes['15m']?.fvgs.length ?? 0,
        obCount: data.indicators.timeframes['4h']?.orderBlocks.length ?? data.indicators.timeframes['15m']?.orderBlocks.length ?? 0,
        conflictingSignals: data.indicators.confluence.conflictingSignals,
      },
    },
  };
}

// =============================================================================
// BACKTEST: Historical data collection & streaming
// =============================================================================

const BINANCE_API = 'https://api.binance.com/api/v3';

interface HistCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
}

async function fetchHistoricalKlines(symbol: string, interval: string, endTimeMs: number, limit: number): Promise<HistCandle[]> {
  try {
    const response = await fetch(`${BINANCE_API}/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}&endTime=${endTimeMs}`);
    if (!response.ok) return [];
    const data = await response.json() as any[][];
    return data.map((k) => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      time: k[0],
    }));
  } catch (error: any) {
    logger.error(`Historical klines fetch error (${interval}):`, error.message);
    return [];
  }
}

function findSwingHighsLows(candles: HistCandle[], lookback: number = 3, timeframe: string = '1d'): Array<{ price: number; type: 'support' | 'resistance'; strength: number; timeframe: string }> {
  const levels: Array<{ price: number; type: 'support' | 'resistance'; strength: number; timeframe: string }> = [];
  if (candles.length < lookback * 2 + 1) return levels;
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isSwingHigh = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isSwingLow = false;
    }
    if (isSwingHigh) levels.push({ price: candles[i].high, type: 'resistance', strength: 1, timeframe });
    if (isSwingLow) levels.push({ price: candles[i].low, type: 'support', strength: 1, timeframe });
  }
  return levels;
}

function computePivotPoints(high: number, low: number, close: number) {
  const pivot = (high + low + close) / 3;
  return {
    pivot,
    r1: 2 * pivot - low,
    r2: pivot + (high - low),
    r3: high + 2 * (pivot - low),
    s1: 2 * pivot - high,
    s2: pivot - (high - low),
    s3: low - 2 * (high - pivot),
  };
}

export interface BacktestMarketData {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  dailyHigh: number;
  dailyLow: number;
  keySupport: number;
  keyResistance: number;
  pivotPoints: ReturnType<typeof computePivotPoints>;
  swingLevels: Array<{ price: number; type: string; strength: number; timeframe: string }>;
  recentDailyOHLCV: HistCandle[];
  allDailyKlines: HistCandle[];
  indicators: IndicatorSuite;
  selectedTimeframes: Timeframe[];
  targetDate: string;
}

export async function collectHistoricalMarketData(
  symbol: string,
  targetDate: Date,
  tfSet: TimeframeSet = 'all',
): Promise<BacktestMarketData> {
  const endTimeMs = targetDate.getTime();
  const selectedTimeframes = getTimeframesForSet(tfSet);

  const [daily, h4, h1, m15, m5] = await Promise.all([
    fetchHistoricalKlines(symbol, '1d', endTimeMs, 250),
    fetchHistoricalKlines(symbol, '4h', endTimeMs, 100),
    fetchHistoricalKlines(symbol, '1h', endTimeMs, 200),
    fetchHistoricalKlines(symbol, '15m', endTimeMs, 200),
    fetchHistoricalKlines(symbol, '5m', endTimeMs, 200),
  ]);

  const currentPrice = daily.length > 0 ? daily[daily.length - 1].close : 0;
  const prevDay = daily.length >= 2 ? daily[daily.length - 2] : daily[daily.length - 1];
  const dailyHigh = daily.length > 0 ? daily[daily.length - 1].high : 0;
  const dailyLow = daily.length > 0 ? daily[daily.length - 1].low : 0;
  const pricePrevDay = daily.length >= 2 ? daily[daily.length - 2].close : currentPrice;
  const priceChange24h = currentPrice - pricePrevDay;
  const priceChangePercentage24h = pricePrevDay > 0 ? (priceChange24h / pricePrevDay) * 100 : 0;

  const pivotPoints = prevDay
    ? computePivotPoints(prevDay.high, prevDay.low, prevDay.close)
    : computePivotPoints(dailyHigh, dailyLow, currentPrice);

  const dailySwings = findSwingHighsLows(daily, 2, '1d');
  const h4Swings = findSwingHighsLows(h4, 3, '4h');
  const h1Swings = findSwingHighsLows(h1, 3, '1h');
  const allSwings = [...dailySwings, ...h4Swings, ...h1Swings];

  const supports = allSwings.filter((l) => l.price < currentPrice).sort((a, b) => b.price - a.price);
  const resistances = allSwings.filter((l) => l.price > currentPrice).sort((a, b) => a.price - b.price);

  const keySupport = supports.length > 0 ? supports[0].price : pivotPoints.s1;
  const keyResistance = resistances.length > 0 ? resistances[0].price : pivotPoints.r1;
  const swingLevels = allSwings.slice(0, 10);

  const candleMap: Partial<Record<Timeframe, import('./technicalIndicators').Candle[]>> = {};
  const tfCandleMap: Array<{ timeframe: string; candles: HistCandle[] }> = [
    { timeframe: '1d', candles: daily },
    { timeframe: '4h', candles: h4 },
    { timeframe: '1h', candles: h1 },
    { timeframe: '15m', candles: m15 },
    { timeframe: '5m', candles: m5 },
  ];
  for (const tf of selectedTimeframes) {
    const candles = tfCandleMap.find((c) => c.timeframe === tf)?.candles || [];
    if (candles.length > 0) candleMap[tf] = candles as any;
  }
  const indicators = computeAllIndicators(candleMap);

  return {
    symbol,
    price: currentPrice,
    priceChange24h,
    priceChangePercentage24h,
    dailyHigh,
    dailyLow,
    keySupport,
    keyResistance,
    pivotPoints,
    swingLevels,
    recentDailyOHLCV: daily.slice(-7),
    allDailyKlines: daily.slice(-90),
    indicators,
    selectedTimeframes,
    targetDate: targetDate.toISOString(),
  };
}

function buildBacktestPrompt(symbol: string, data: BacktestMarketData, tfSet: TimeframeSet): string {
  const ind = data.indicators;

  const recentOHLCV = data.recentDailyOHLCV
    .map((c) => `- O: $${c.open.toLocaleString()} H: $${c.high.toLocaleString()} L: $${c.low.toLocaleString()} C: $${c.close.toLocaleString()} Vol: ${c.volume.toLocaleString()}`)
    .join('\n');

  const swingStr = data.swingLevels
    .slice(0, 8)
    .map((l) => `- ${l.type === 'support' ? '🟢 Support' : '🔴 Resistance'}: $${l.price.toLocaleString()} (from ${l.timeframe})`)
    .join('\n') || 'No swing levels detected';

  let indicatorsStr = '';
  for (const tf of data.selectedTimeframes) {
    const tfData = ind.timeframes[tf];
    if (!tfData) continue;
    indicatorsStr += `
### ${tf.toUpperCase()} Timeframe
- RSI: ${tfData.rsi.value.toFixed(1)} (${tfData.rsi.condition})
- MACD Histogram: ${tfData.macd.histogram > 0 ? '+' : ''}${tfData.macd.histogram.toFixed(2)} | Trend: ${tfData.macd.trend}
- EMA Trend: ${ind.confluence.overallTrend.replace('_', ' ').toUpperCase()} (${ind.confluence.alignedTimeframes}/${data.selectedTimeframes.length} aligned)
- Bollinger %B: ${(tfData.bollinger.percentB * 100).toFixed(0)}%${tfData.bollinger.squeeze ? ' ⚠️ SQUEEZE' : ''}
- ATR: $${tfData.atr.value.toFixed(2)}
- VWAP: ${tfData.vwap.priceRelation}
- Structure: ${tfData.structure.trend}
`;
  }

  return `You are an expert crypto market analyst performing a **BACKTEST ANALYSIS**.

This is NOT live data. This is a historical snapshot for ${symbol} at **${data.targetDate}**.
The price at that time was $${data.price.toLocaleString()}.
You do NOT know what happened after this date. Analyze as if you are at this point in time.

## MARKET DATA (Historical Snapshot)
- Price: $${data.price.toLocaleString()}
- 24h Change: $${data.priceChange24h.toLocaleString()} (${data.priceChangePercentage24h.toFixed(2)}%)
- 24h High: $${data.dailyHigh.toLocaleString()}
- 24h Low: $${data.dailyLow.toLocaleString()}

## TECHNICAL LEVELS
- Key Support: $${data.keySupport.toLocaleString()}
- Key Resistance: $${data.keyResistance.toLocaleString()}

## PIVOT POINTS
- R3: $${data.pivotPoints.r3.toLocaleString()} | R2: $${data.pivotPoints.r2.toLocaleString()} | R1: $${data.pivotPoints.r1.toLocaleString()}
- Pivot: $${data.pivotPoints.pivot.toLocaleString()}
- S1: $${data.pivotPoints.s1.toLocaleString()} | S2: $${data.pivotPoints.s2.toLocaleString()} | S3: $${data.pivotPoints.s3.toLocaleString()}

## SWING LEVELS
${swingStr}

## RECENT DAILY OHLCV
${recentOHLCV}

## TECHNICAL INDICATORS (Computed from Binance Historical Klines)
${tfSet === 'lower' ? '\n**FOCUS: Lower Timeframe Scalping (15m, 5m)**\n' : tfSet === 'higher' ? '\n**FOCUS: Higher Timeframe Swing (1D, 4H, 1H)**\n' : ''}
### CONFLUENCE
- Overall Trend: ${ind.confluence.overallTrend.replace('_', ' ').toUpperCase()}
- Aligned: ${ind.confluence.alignedTimeframes}/${data.selectedTimeframes.length}
${ind.confluence.conflictingSignals.length > 0 ? '⚠️ Conflicts:\n' + ind.confluence.conflictingSignals.map((s) => `  - ${s}`).join('\n') : '✅ No conflicts'}

${indicatorsStr}

---

Analyze this historical data as a market analyst would at that moment. Provide:

## 📊 Market Overview
Summarize the price action and context at this snapshot.

## 📈 Technical Analysis
${tfSet === 'lower' ? 'Focus on scalping setups using 15m and 5m timeframes.' : tfSet === 'higher' ? 'Focus on swing trading setups using daily, 4H, and 1H timeframes.' : 'Cover both swing and scalping perspectives.'}

## 🔍 Key Insights
- 3-4 observations from the data
- 2-3 risk factors
- 2-3 potential opportunities

## 🎯 Trading Considerations
Provide a specific trade setup:
- Direction (Long/Short/Neutral)
- Entry, Stop Loss, Take Profit levels
- Risk/Reward ratio
- Setup description

## 📝 Summary
- Short-term outlook
- Medium-term outlook
- **Verdict**: STRONG_BUY / BUY / NEUTRAL / SELL / STRONG_SELL with confidence (0-100)
- Key level to watch

Be concise. Use bold for key levels.`;
}

export async function streamBacktestAnalysis(symbol: string, targetDate: Date, tfSet: TimeframeSet = 'all') {
  const data = await collectHistoricalMarketData(symbol, targetDate, tfSet);
  const primary = data.selectedTimeframes[0];
  const prompt = buildBacktestPrompt(symbol, data, tfSet);

  const result = streamText({
    model: google(MODEL_ID),
    prompt,
    temperature: 0,
  });
  return {
    stream: result,
    marketData: {
      symbol,
      price: data.price,
      priceChange24h: data.priceChange24h,
      priceChangePercentage24h: data.priceChangePercentage24h,
      marketCap: 0,
      volume24h: 0,
      ath: 0,
      fearGreedIndex: 0,
      fearGreedClassification: 'N/A (Backtest)',
      keySupport: data.keySupport,
      keyResistance: data.keyResistance,
      dxy: 0,
      eurusd: 'N/A',
      gbpusd: 'N/A',
      usdjpy: 'N/A',
      upcomingEvents: [],
      whales: {
        takerRatio: 0,
        takerTrend: 'N/A',
        topTraderLongPct: 0,
        topTraderTrend: 'N/A',
        oiValue: 0,
        oiChange24h: 0,
        onChainLargeTxs: 0,
        onChainVolumeBTC: 0,
      },
      indicators: {
        rsi: data.indicators.timeframes[primary]?.rsi.value ?? 50,
        rsiCondition: data.indicators.timeframes[primary]?.rsi.condition ?? 'neutral',
        rsi4h: data.indicators.timeframes['4h']?.rsi.value,
        rsi1h: data.indicators.timeframes['1h']?.rsi.value,
        rsi15m: data.indicators.timeframes['15m']?.rsi.value,
        rsi5m: data.indicators.timeframes['5m']?.rsi.value,
        macdHistogram: data.indicators.timeframes[primary]?.macd.histogram ?? 0,
        macdTrend: data.indicators.timeframes[primary]?.macd.trend ?? 'neutral',
        emaTrend: data.indicators.confluence.overallTrend,
        alignedTimeframes: data.indicators.confluence.alignedTimeframes,
        totalCheckedTimeframes: data.selectedTimeframes.length,
        bollingerSqueeze: data.indicators.timeframes[primary]?.bollinger.squeeze ?? false,
        bollingerPercentB: data.indicators.timeframes[primary]?.bollinger.percentB ?? 0.5,
        atr: data.indicators.timeframes[primary]?.atr.value ?? 0,
        vwapRelation: data.indicators.timeframes['4h']?.vwap.priceRelation ?? data.indicators.timeframes['15m']?.vwap.priceRelation ?? 'below',
        marketStructure: data.indicators.timeframes[primary]?.structure.trend ?? 'ranging',
        fvgCount: data.indicators.timeframes['4h']?.fvgs.length ?? data.indicators.timeframes['15m']?.fvgs.length ?? 0,
        obCount: data.indicators.timeframes['4h']?.orderBlocks.length ?? data.indicators.timeframes['15m']?.orderBlocks.length ?? 0,
        conflictingSignals: data.indicators.confluence.conflictingSignals,
      },
      dailyKlines: data.allDailyKlines.map((k) => ({
        time: Math.floor(k.time / 1000),
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      })),
    },
  };
}
