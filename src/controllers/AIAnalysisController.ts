/**
 * AI Analysis Controller
 * 
 * Endpoints for AI-powered market analysis using Google Gemini Flash 3.0
 * Auto-saves every analysis to the database for history tracking.
 * 
 * @author AI Assistant
 * @createdDate 2026-04-06
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getAIAnalysis, getAIQuickSummary, streamAIAnalysis } from '../services/aiAnalysis';
import { saveAnalysis } from '../services/analysisHistory';
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

      // Auto-save to database (fire-and-forget)
      saveAnalysis({
        symbol: analysis.symbol,
        price: analysis.marketOverview.price,
        priceChange24h: analysis.marketOverview.priceChange24h,
        priceChangePercentage24h: analysis.marketOverview.priceChangePercentage24h,
        marketCap: analysis.marketOverview.marketCap,
        volume24h: analysis.marketOverview.volume24h,
        circulatingSupply: analysis.marketOverview.circulatingSupply,
        ath: analysis.marketOverview.ath,
        athDate: analysis.marketOverview.athDate,
        distanceFromAth: analysis.marketOverview.distanceFromAth,
        keySupport: analysis.technicalAnalysis.keySupport,
        keyResistance: analysis.technicalAnalysis.keyResistance,
        dailyHigh: analysis.technicalAnalysis.dailyHigh,
        dailyLow: analysis.technicalAnalysis.dailyLow,
        fearGreedIndex: analysis.sentimentAnalysis.fearGreedIndex,
        fearGreedClassification: analysis.sentimentAnalysis.fearGreedClassification,
        fundingRate: analysis.sentimentAnalysis.fundingRate,
        longShortRatio: analysis.sentimentAnalysis.longShortRatio,
        marketBias: analysis.sentimentAnalysis.marketBias,
        rsi: 0, // Not available in structured analysis
        rsiCondition: 'neutral',
        macdHistogram: 0,
        macdTrend: 'neutral',
        emaTrend: analysis.technicalAnalysis.trendDirection,
        marketStructure: analysis.technicalAnalysis.trendDirection,
        bollingerSqueeze: false,
        bollingerPercentB: 0.5,
        atr: 0,
        vwapRelation: 'below',
        overallVerdict: analysis.summary.overallVerdict,
        confidenceScore: analysis.summary.confidenceScore,
      }).catch((err) => logger.error('Background save failed:', err));

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

  // GET /api/v1/ai/analysis/stream - Streaming AI analysis via SSE (auto-saves)
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

      // Collect the full streamed text for saving
      let fullAnalysisText = '';

      // Stream text chunks
      for await (const chunk of stream.textStream) {
        fullAnalysisText += chunk;
        res.write(`data: ${JSON.stringify({ type: 'text-delta', data: chunk })}\n\n`);
      }

      // Send completion event with the saved analysis ID
      const savedId = await saveAnalysis({
        symbol: symbol.toUpperCase(),
        price: marketData.price,
        priceChange24h: marketData.priceChange24h,
        priceChangePercentage24h: marketData.priceChangePercentage24h,
        marketCap: marketData.marketCap,
        volume24h: marketData.volume24h,
        ath: marketData.ath,
        fearGreedIndex: marketData.fearGreedIndex,
        fearGreedClassification: marketData.fearGreedClassification,
        keySupport: marketData.keySupport,
        keyResistance: marketData.keyResistance,
        dxy: marketData.dxy,
        eurusd: marketData.eurusd,
        gbpusd: marketData.gbpusd,
        usdjpy: marketData.usdjpy,
        macroEvents: marketData.upcomingEvents,
        whaleData: marketData.whales,
        rsi: marketData.indicators.rsi,
        rsiCondition: marketData.indicators.rsiCondition,
        macdHistogram: marketData.indicators.macdHistogram,
        macdTrend: marketData.indicators.macdTrend,
        emaTrend: marketData.indicators.emaTrend,
        marketStructure: marketData.indicators.marketStructure,
        bollingerSqueeze: marketData.indicators.bollingerSqueeze,
        bollingerPercentB: marketData.indicators.bollingerPercentB,
        atr: marketData.indicators.atr,
        vwapRelation: marketData.indicators.vwapRelation,
        indicators: marketData.indicators,
        analysisText: fullAnalysisText,
      });

      res.write(`data: ${JSON.stringify({ type: 'done', analysisId: savedId })}\n\n`);
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
