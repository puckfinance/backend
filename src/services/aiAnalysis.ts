/**
 * AI-Powered Market Analysis Service
 * 
 * Uses Vercel AI SDK with Google Gemini Flash 3.0 for detailed
 * market analysis, sentiment interpretation, and trading insights.
 * 
 * @author AI Assistant
 * @createdDate 2026-04-06
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { getCoinGeckoMarketData, getDeFiLlamaProtocols, getTotalDeFiTVL } from './whaleTracker';
import { getFearAndGreedIndex, getTechnicalLevels, getMarketSentiment } from './whaleTracker';
import logger from '../utils/Logger';

// Google Gemini model - Flash 3.0 Preview
const MODEL_ID = 'gemini-2.0-flash-preview';

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
}> {
  const [marketData, sentiment, technical, fearGreedData, defiProtocols, totalTvl] = await Promise.all([
    getCoinGeckoMarketData(symbol),
    getMarketSentiment(symbol),
    getTechnicalLevels(symbol),
    getFearAndGreedIndex(),
    getDeFiLlamaProtocols(5),
    getTotalDeFiTVL(),
  ]);

  return {
    marketData,
    sentiment,
    technical,
    fearGreed: fearGreedData,
    defi: {
      protocols: defiProtocols,
      totalTvl,
    },
  };
}

// =============================================================================
// AI PROMPT BUILDER
// =============================================================================

function buildAnalysisPrompt(symbol: string, data: Awaited<ReturnType<typeof collectMarketData>>): string {
  const { marketData, sentiment, technical, fearGreed, defi } = data;
  
  const distanceFromAth = marketData.ath > 0 
    ? ((marketData.price - marketData.ath) / marketData.ath * 100).toFixed(2)
    : '0';

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
${defi.protocols.slice(0, 5).map((p, i) => `  ${i + 1}. ${p.name}: $${(p.tvl / 1e9).toFixed(1)}B (${p.category})`).join('\n')}

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
// AI ANALYSIS FUNCTION
// =============================================================================

export async function getAIAnalysis(symbol: string = 'BTC'): Promise<AIDetailedAnalysis> {
  try {
    // Collect all market data in parallel
    const data = await collectMarketData(symbol);
    
    // Build prompt
    const prompt = buildAnalysisPrompt(symbol, data);
    
    // Generate analysis using Google Gemini Flash
    const { text } = await generateText({
      model: google(MODEL_ID) as any,
      prompt,
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    // Parse the JSON response
    let parsedAnalysis: any;
    try {
      // Try to parse directly
      parsedAnalysis = JSON.parse(text);
    } catch {
      // Try to extract JSON from potential markdown
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    const { marketData, sentiment, technical, defi } = data;
    
    // Calculate distance from ATH
    const distanceFromAth = marketData.ath > 0 
      ? ((marketData.price - marketData.ath) / marketData.ath * 100)
      : 0;

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
        supportBreakdown: parsedAnalysis.technicalAnalysis?.supportBreakdown || 'Not available',
        resistanceBreakdown: parsedAnalysis.technicalAnalysis?.resistanceBreakdown || 'Not available',
        volatilityAssessment: parsedAnalysis.technicalAnalysis?.volatilityAssessment || 'Not available',
        trendDirection: parsedAnalysis.technicalAnalysis?.trendDirection || 'neutral',
      },
      
      sentimentAnalysis: {
        fearGreedIndex: sentiment.fearGreedIndex,
        fearGreedClassification: sentiment.fearGreedClassification,
        fundingRate: sentiment.avgFundingRate,
        fundingInterpretation: parsedAnalysis.sentimentAnalysis?.fundingInterpretation || 'Not available',
        longShortRatio: sentiment.longShortRatio,
        marketBias: sentiment.marketBias,
        sentimentVerdict: parsedAnalysis.sentimentAnalysis?.sentimentVerdict || 'Not available',
      },
      
      defiContext: {
        totalDeFiTVL: defi.totalTvl.totalTvl,
        topProtocols: defi.protocols.slice(0, 5).map(p => ({
          name: p.name,
          tvl: p.tvl,
          category: p.category,
        })),
        defiHealth: parsedAnalysis.defiContext?.defiHealth || 'Not available',
      },
      
      aiInsights: {
        keyObservations: parsedAnalysis.aiInsights?.keyObservations || [],
        riskFactors: parsedAnalysis.aiInsights?.riskFactors || [],
        opportunities: parsedAnalysis.aiInsights?.opportunities || [],
        tradingConsiderations: parsedAnalysis.aiInsights?.tradingConsiderations || [],
      },
      
      summary: {
        shortTermOutlook: parsedAnalysis.summary?.shortTermOutlook || 'Not available',
        mediumTermOutlook: parsedAnalysis.summary?.mediumTermOutlook || 'Not available',
        keyLevelToWatch: parsedAnalysis.summary?.keyLevelToWatch || `$${technical.keySupport.toLocaleString()} - $${technical.keyResistance.toLocaleString()}`,
        recommendedStrategy: parsedAnalysis.summary?.recommendedStrategy || 'Not available',
        confidenceScore: parsedAnalysis.summary?.confidenceScore || 50,
        overallVerdict: parsedAnalysis.summary?.overallVerdict || 'NEUTRAL',
      },
      
      tradeAlert: {
        active: parsedAnalysis.tradeAlert?.active || false,
        direction: parsedAnalysis.tradeAlert?.direction || 'NONE',
        entryPrice: parsedAnalysis.tradeAlert?.entryPrice || null,
        stopLoss: parsedAnalysis.tradeAlert?.stopLoss || null,
        takeProfit: parsedAnalysis.tradeAlert?.takeProfit || null,
        riskRewardRatio: parsedAnalysis.tradeAlert?.riskRewardRatio || null,
        tradeSetup: parsedAnalysis.tradeAlert?.tradeSetup || 'No active trade setup',
        reasoning: parsedAnalysis.tradeAlert?.reasoning || 'Market conditions not favorable for trade',
      },
    };

    return analysis;
  } catch (error: any) {
    logger.error('AI Analysis error:', error.message);
    throw error;
  }
}

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

    const { text } = await generateText({
      model: google(MODEL_ID) as any,
      prompt: `Give a one-sentence trading insight for ${symbol} at $${marketData.price.toLocaleString()}, 
      up ${marketData.priceChangePercentage24h.toFixed(2)}% in 24h.
      Fear & Greed Index is ${fearGreed.value} (${fearGreed.classification}).
      Market bias from funding rates: ${sentiment.marketBias}.
      
      Respond ONLY with a JSON object: {"verdict": "BUY/SELL/NEUTRAL", "confidence": 0-100, "insight": "one sentence explanation"}
      No markdown, just JSON.`,
      temperature: 0.5,
      maxOutputTokens: 200,
    });

    let parsed: any = { verdict: 'NEUTRAL', confidence: 50, insight: 'Analysis unavailable' };
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    return {
      symbol,
      timestamp: Date.now(),
      price: marketData.price,
      change24h: marketData.priceChangePercentage24h,
      sentiment: fearGreed.classification,
      verdict: parsed.verdict || 'NEUTRAL',
      confidence: parsed.confidence || 50,
      insight: parsed.insight || 'Not available',
    };
  } catch (error: any) {
    logger.error('AI Quick Summary error:', error.message);
    throw error;
  }
}
