/**
 * Market Analysis Save Service
 *
 * Saves AI Market Analysis data to the database.
 * Called after streaming completes or when the full analysis is generated.
 *
 * @author AI Assistant
 * @createdDate 2026-04-08
 */

import prisma from '../infrastructure/prisma';
import logger from '../utils/Logger';

// Matches the marketData object sent in SSE stream events
export interface SaveAnalysisPayload {
  symbol: string;
  userId?: string;

  // Market Overview
  price: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  marketCap: number;
  volume24h: number;
  circulatingSupply?: number;
  ath?: number;
  athDate?: string;
  distanceFromAth?: number;

  // DXY / Macro
  dxy?: number;
  eurusd?: number;
  gbpusd?: number;
  usdjpy?: number;
  macroEvents?: any[];

  // Technical Levels
  keySupport: number;
  keyResistance: number;
  dailyHigh?: number;
  dailyLow?: number;

  // Sentiment
  fearGreedIndex: number;
  fearGreedClassification: string;
  fundingRate?: number;
  longShortRatio?: number;
  marketBias?: string;

  // Whale Activity
  whaleData?: any;

  // Technical Indicators
  rsi: number;
  rsiCondition: string;
  macdHistogram: number;
  macdTrend: string;
  emaTrend: string;
  marketStructure: string;
  bollingerSqueeze: boolean;
  bollingerPercentB: number;
  atr: number;
  vwapRelation: string;

  // Full indicator suite
  indicators?: any;

  // DeFi Context
  defiTvl?: number;
  defiProtocols?: any[];
  defiHealth?: string;

  // AI Analysis Text (markdown)
  analysisText?: string;

  // Summary
  overallVerdict?: string;
  confidenceScore?: number;
}

/**
 * Save a completed analysis to the database.
 * Safe to call in fire-and-forget mode — errors are logged, not thrown.
 */
export async function saveAnalysis(payload: SaveAnalysisPayload): Promise<string | null> {
  try {
    const record = await prisma.marketAnalysis.create({
      data: {
        symbol: payload.symbol,
        userId: payload.userId || null,

        price: payload.price,
        priceChange24h: payload.priceChange24h,
        priceChangePercentage24h: payload.priceChangePercentage24h,
        marketCap: payload.marketCap,
        volume24h: payload.volume24h,
        circulatingSupply: payload.circulatingSupply ?? 0,
        ath: payload.ath ?? 0,
        athDate: payload.athDate ?? '',
        distanceFromAth: payload.distanceFromAth ?? 0,

        dxyPrice: payload.dxy ?? null,
        eurusd: payload.eurusd ?? null,
        gbpusd: payload.gbpusd ?? null,
        usdjpy: payload.usdjpy ?? null,
        macroEvents: payload.macroEvents ?? undefined,

        keySupport: payload.keySupport,
        keyResistance: payload.keyResistance,
        dailyHigh: payload.dailyHigh ?? 0,
        dailyLow: payload.dailyLow ?? 0,

        fearGreedIndex: payload.fearGreedIndex,
        fearGreedClassification: payload.fearGreedClassification,
        fundingRate: payload.fundingRate ?? 0,
        longShortRatio: payload.longShortRatio ?? 0,
        marketBias: payload.marketBias ?? '',

        whaleData: payload.whaleData ?? undefined,

        rsi: payload.rsi,
        rsiCondition: payload.rsiCondition,
        macdHistogram: payload.macdHistogram,
        macdTrend: payload.macdTrend,
        emaTrend: payload.emaTrend,
        marketStructure: payload.marketStructure,
        bollingerSqueeze: payload.bollingerSqueeze,
        bollingerPercentB: payload.bollingerPercentB,
        atr: payload.atr,
        vwapRelation: payload.vwapRelation,

        indicators: payload.indicators ?? undefined,

        defiTvl: payload.defiTvl ?? null,
        defiProtocols: payload.defiProtocols ?? undefined,
        defiHealth: payload.defiHealth ?? null,

        analysisText: payload.analysisText ?? null,

        overallVerdict: payload.overallVerdict ?? null,
        confidenceScore: payload.confidenceScore ?? null,
      },
    });

    logger.info(`Saved analysis ${record.id} for ${payload.symbol}`);
    return record.id;
  } catch (error: any) {
    logger.error('Failed to save analysis to database:', error.message);
    return null;
  }
}
