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
import { getAIAnalysis, getAIQuickSummary, streamAIAnalysis } from '../services/aiAnalysis';
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

  // GET /api/v1/ai/analysis/stream - Streaming AI analysis via SSE
  router.get('/analysis/stream', async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        symbol: z.string().optional().default('BTC'),
      });

      const { symbol } = querySchema.parse(req.query);

      logger.info(`Streaming AI analysis for ${symbol}`);

      const { stream, marketData } = await streamAIAnalysis(symbol.toUpperCase());

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Send market data as the first event
      res.write(`data: ${JSON.stringify({ type: 'market-data', data: marketData })}\n\n`);

      // Stream text chunks
      for await (const chunk of stream.textStream) {
        res.write(`data: ${JSON.stringify({ type: 'text-delta', data: chunk })}\n\n`);
      }

      // Send completion event
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (error: any) {
      logger.error('Error streaming AI analysis:', error);
      Log.sendLog({ error });

      // If headers haven't been sent yet, send error as JSON
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to stream AI analysis',
        });
      }
      // If streaming already started, send error as SSE event
      res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
      res.end();
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
