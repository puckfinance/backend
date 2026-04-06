/**
 * AI Analysis Controller
 * 
 * Endpoints for AI-powered market analysis using Google Gemini Flash 3.0
 * 
 * @author AI Assistant
 * @createdDate 2026-04-06
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getAIAnalysis, getAIQuickSummary } from '../services/aiAnalysis';
import logger from '../utils/Logger';
import Log from '../services/log';

export default () => {
  const router = Router();

  // GET /api/v1/ai/analysis - Full AI-powered market analysis
  router.get('/analysis', async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        symbol: z.string().optional().default('BTC'),
      });

      const { symbol } = querySchema.parse(req.query);
      
      logger.info(`Generating AI analysis for ${symbol}`);
      
      const analysis = await getAIAnalysis(symbol.toUpperCase());

      return res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        analysis,
      });
    } catch (error: any) {
      logger.error('Error generating AI analysis:', error);
      Log.sendLog({ error });

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate AI analysis',
      });
    }
  });

  // GET /api/v1/ai/summary - Quick AI-powered summary
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        symbol: z.string().optional().default('BTC'),
      });

      const { symbol } = querySchema.parse(req.query);
      
      logger.info(`Generating AI quick summary for ${symbol}`);
      
      const summary = await getAIQuickSummary(symbol.toUpperCase());

      return res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        summary,
      });
    } catch (error: any) {
      logger.error('Error generating AI summary:', error);
      Log.sendLog({ error });

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate AI summary',
      });
    }
  });

  return router;
};
