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
