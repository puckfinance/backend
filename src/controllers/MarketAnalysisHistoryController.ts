/**
 * Market Analysis History Controller
 *
 * CRUD endpoints for saved AI Market Analysis records.
 * The streaming analysis auto-saves; these endpoints allow
 * browsing, reading, and deleting past analyses.
 *
 * @author AI Assistant
 * @createdDate 2026-04-08
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../infrastructure/prisma';
import logger from '../utils/Logger';

interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
}

async function fetchBinanceKlines(symbol: string, startTimeMs: number, endTimeMs: number): Promise<BinanceKline[]> {
  const binanceSymbol = `${symbol}USDT`;
  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1h&startTime=${startTimeMs}&endTime=${endTimeMs}&limit=1000`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }

  const data = (await response.json()) as unknown[][];
  return data.map((k) => ({
    openTime: Number(k[0]),
    open: k[1] as string,
    high: k[2] as string,
    low: k[3] as string,
    close: k[4] as string,
  }));
}

type TradeResult = 'WIN' | 'LOSS' | 'PENDING' | 'NO_TRADE';

function evaluateTrade(
  klines: BinanceKline[],
  direction: 'LONG' | 'SHORT',
  _entryPrice: number,
  stopLoss: number,
  takeProfit: number,
): TradeResult {
  if (klines.length === 0) return 'PENDING';

  for (const k of klines) {
    const high = parseFloat(k.high);
    const low = parseFloat(k.low);

    if (direction === 'LONG') {
      const hitSL = low <= stopLoss;
      const hitTP = high >= takeProfit;
      if (hitSL && hitTP) {
        return parseFloat(k.open) <= stopLoss ? 'LOSS' : 'WIN';
      }
      if (hitSL) return 'LOSS';
      if (hitTP) return 'WIN';
    } else {
      const hitSL = high >= stopLoss;
      const hitTP = low <= takeProfit;
      if (hitSL && hitTP) {
        return parseFloat(k.open) >= stopLoss ? 'LOSS' : 'WIN';
      }
      if (hitSL) return 'LOSS';
      if (hitTP) return 'WIN';
    }
  }

  return 'PENDING';
}

export default () => {
  const router = Router();

  // -------------------------------------------------------------------------
  // GET /api/v1/analysis-history — List analyses (paginated, filterable)
  // -------------------------------------------------------------------------
  router.get('/', async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        symbol: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        userId: z.string().optional(),
      });

      const { symbol, page, limit, userId } = querySchema.parse(req.query);
      const skip = (page - 1) * limit;

      const where: any = {};
      if (symbol) where.symbol = symbol.toUpperCase();
      if (userId) where.userId = userId;

      const [analyses, total] = await Promise.all([
        prisma.marketAnalysis.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          // Don't return the full analysisText in list view for performance
          select: {
            id: true,
            createdAt: true,
            symbol: true,
            price: true,
            priceChangePercentage24h: true,
            marketCap: true,
            fearGreedIndex: true,
            fearGreedClassification: true,
            dxyPrice: true,
            emaTrend: true,
            marketStructure: true,
            overallVerdict: true,
            confidenceScore: true,
            tradeAlertActive: true,
            tradeAlertDirection: true,
          },
        }),
        prisma.marketAnalysis.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: analyses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      logger.error('Error listing analysis history:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to list analysis history',
      });
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/analysis-history/:id/trade-result — Check if trade hit TP/SL
  // -------------------------------------------------------------------------
  router.get('/:id/trade-result', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const analysis = await prisma.marketAnalysis.findUnique({
        where: { id },
        select: {
          symbol: true,
          createdAt: true,
          tradeAlertActive: true,
          tradeAlertDirection: true,
          tradeAlertEntryPrice: true,
          tradeAlertStopLoss: true,
          tradeAlertTakeProfit: true,
        },
      });

      if (!analysis) {
        return res.status(404).json({ success: false, error: 'Analysis not found' });
      }

      if (
        !analysis.tradeAlertActive ||
        !analysis.tradeAlertEntryPrice ||
        !analysis.tradeAlertStopLoss ||
        !analysis.tradeAlertTakeProfit ||
        !analysis.tradeAlertDirection ||
        analysis.tradeAlertDirection === 'NONE'
      ) {
        return res.status(200).json({
          success: true,
          result: 'NO_TRADE' as TradeResult,
          direction: null,
          entryPrice: null,
          stopLoss: null,
          takeProfit: null,
          hitAt: null,
          currentPrice: null,
        });
      }

      const startTimeMs = new Date(analysis.createdAt).getTime();
      const nowMs = Date.now();

      let klines: BinanceKline[] = [];
      try {
        klines = await fetchBinanceKlines(analysis.symbol, startTimeMs, nowMs);
      } catch (err: any) {
        logger.error('Failed to fetch klines for trade result:', err.message);
        return res.status(200).json({
          success: true,
          result: 'PENDING' as TradeResult,
          direction: analysis.tradeAlertDirection,
          entryPrice: analysis.tradeAlertEntryPrice,
          stopLoss: analysis.tradeAlertStopLoss,
          takeProfit: analysis.tradeAlertTakeProfit,
          hitAt: null,
          currentPrice: null,
        });
      }

      const result = evaluateTrade(
        klines,
        analysis.tradeAlertDirection as 'LONG' | 'SHORT',
        analysis.tradeAlertEntryPrice,
        analysis.tradeAlertStopLoss,
        analysis.tradeAlertTakeProfit,
      );

      const hitKline = result === 'WIN' || result === 'LOSS'
        ? klines.find((k) => {
            const high = parseFloat(k.high);
            const low = parseFloat(k.low);
            if (analysis.tradeAlertDirection === 'LONG') {
              return (result === 'WIN' && high >= analysis.tradeAlertTakeProfit!) ||
                     (result === 'LOSS' && low <= analysis.tradeAlertStopLoss!);
            }
            return (result === 'WIN' && low <= analysis.tradeAlertTakeProfit!) ||
                   (result === 'LOSS' && high >= analysis.tradeAlertStopLoss!);
          })
        : null;

      const lastClose = klines.length > 0 ? parseFloat(klines[klines.length - 1].close) : null;

      return res.status(200).json({
        success: true,
        result,
        direction: analysis.tradeAlertDirection,
        entryPrice: analysis.tradeAlertEntryPrice,
        stopLoss: analysis.tradeAlertStopLoss,
        takeProfit: analysis.tradeAlertTakeProfit,
        hitAt: hitKline ? new Date(hitKline.openTime).toISOString() : null,
        currentPrice: lastClose,
      });
    } catch (error: any) {
      logger.error('Error checking trade result:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to check trade result',
      });
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/analysis-history/:id — Get single analysis with full data
  // -------------------------------------------------------------------------
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const analysis = await prisma.marketAnalysis.findUnique({
        where: { id },
      });

      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: analysis,
      });
    } catch (error: any) {
      logger.error('Error getting analysis:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get analysis',
      });
    }
  });

  // -------------------------------------------------------------------------
  // DELETE /api/v1/analysis-history/:id — Delete a single analysis
  // -------------------------------------------------------------------------
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await prisma.marketAnalysis.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found',
        });
      }

      await prisma.marketAnalysis.delete({ where: { id } });

      return res.status(200).json({
        success: true,
        message: 'Analysis deleted',
      });
    } catch (error: any) {
      logger.error('Error deleting analysis:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete analysis',
      });
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/analysis-history/stats/summary — Aggregate stats
  // -------------------------------------------------------------------------
  router.get('/stats/summary', async (_req: Request, res: Response) => {
    try {
      const [totalCount, symbolBreakdown, recentVerdicts] = await Promise.all([
        prisma.marketAnalysis.count(),
        prisma.marketAnalysis.groupBy({
          by: ['symbol'],
          _count: { symbol: true },
          orderBy: { _count: { symbol: 'desc' } },
        }),
        prisma.marketAnalysis.findMany({
          where: { overallVerdict: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            symbol: true,
            overallVerdict: true,
            confidenceScore: true,
            createdAt: true,
          },
        }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          totalAnalyses: totalCount,
          symbolBreakdown: symbolBreakdown.map((s) => ({
            symbol: s.symbol,
            count: s._count.symbol,
          })),
          recentVerdicts,
        },
      });
    } catch (error: any) {
      logger.error('Error getting analysis stats:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get stats',
      });
    }
  });

  return router;
};
