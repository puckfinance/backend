/**
 * Whale Controller
 * 
 * API endpoints for whale tracking and crypto market analysis
 * 
 * @author AI Assistant
 * @createdDate 2026-04-05
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  fetchWhaleAlerts,
  getWhaleStats,
  getFearAndGreedIndex,
  getExchangeFlows,
  getComprehensiveAnalysis,
  getMarketSentiment,
  formatWhaleAlertForDisplay,
} from '../services/whaleTracker';
import logger from '../utils/Logger';
import Log from '../services/log';

export default () => {
  const router = Router();

  // GET /api/v1/whale/alerts - Get recent whale alerts
  router.get('/alerts', async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        symbol: z.string().optional().default('BTC'),
        limit: z.string().optional().default('10'),
        min_value: z.string().optional().default('1000000'),
      });

      const { symbol, limit, min_value } = querySchema.parse(req.query);
      
      logger.info(`Fetching whale alerts for ${symbol}, limit: ${limit}`);
      
      const { alerts, isMock } = await fetchWhaleAlerts(
        parseFloat(min_value),
        parseInt(limit, 10)
      );

      const filteredAlerts = symbol && symbol !== 'ALL'
        ? alerts.filter(a => a.symbol.toUpperCase() === symbol.toUpperCase())
        : alerts;

      const formattedAlerts = filteredAlerts.map(formatWhaleAlertForDisplay);

      return res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        count: filteredAlerts.length,
        isMockData: isMock,
        alerts: filteredAlerts,
        formatted: formattedAlerts,
      });
    } catch (error: any) {
      logger.error('Error fetching whale alerts:', error);
      Log.sendLog({ error });

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch whale alerts',
      });
    }
  });

  // GET /api/v1/whale/stats - Get whale statistics
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        symbol: z.string().optional().default('BTC'),
      });

      const { symbol } = querySchema.parse(req.query);
      
      logger.info(`Fetching whale stats for ${symbol}`);
      
      const stats = await getWhaleStats(symbol.toUpperCase());

      // Determine sentiment based on exchange net flow
      // Positive = inflow to exchanges (bearish - selling pressure)
      // Negative = outflow from exchanges (bullish - accumulation)
      let sentiment = 'neutral';
      let interpretation = '';
      
      if (stats.exchangeNetFlow > 100000000) {
        sentiment = 'strongly_bearish';
        interpretation = 'Extreme distribution - whales moving coins to exchanges';
      } else if (stats.exchangeNetFlow > 50000000) {
        sentiment = 'bearish';
        interpretation = 'Net inflow to exchanges - selling pressure';
      } else if (stats.exchangeNetFlow < -100000000) {
        sentiment = 'strongly_bullish';
        interpretation = 'Extreme accumulation - whales removing coins from exchanges';
      } else if (stats.exchangeNetFlow < -50000000) {
        sentiment = 'bullish';
        interpretation = 'Net outflow from exchanges - accumulation';
      } else {
        interpretation = 'No strong directional flow';
      }

      return res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        stats: {
          totalInflow24h: formatUsd(stats.totalInflow24h),
          totalOutflow24h: formatUsd(stats.totalOutflow24h),
          largeTransactionsCount: stats.largeTransactionsCount,
          exchangeNetFlow: formatUsd(stats.exchangeNetFlow),
          exchangeNetFlowRaw: stats.exchangeNetFlow,
          whaleCount: stats.whaleCount,
          sentiment,
          interpretation,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching whale stats:', error);
      Log.sendLog({ error });

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch whale stats',
      });
    }
  });

  // GET /api/v1/whale/sentiment - Get market sentiment data
  router.get('/sentiment', async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        symbol: z.string().optional().default('BTC'),
      });

      const { symbol } = querySchema.parse(req.query);
      
      logger.info(`Fetching sentiment for ${symbol}`);
      
      const sentiment = await getMarketSentiment(symbol.toUpperCase());

      return res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        sentiment: {
          fearGreedIndex: sentiment.fearGreedIndex,
          fearGreedClassification: sentiment.fearGreedClassification,
          fundingRate: {
            binance: `${sentiment.fundingRateBinance.toFixed(4)}%`,
            bybit: `${sentiment.fundingRateBybit.toFixed(4)}%`,
            average: `${sentiment.avgFundingRate.toFixed(4)}%`,
          },
          openInterest: formatUsd(sentiment.openInterest),
          longShortRatio: sentiment.longShortRatio.toFixed(2),
          marketBias: sentiment.marketBias,
          confidence: sentiment.confidence,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching sentiment:', error);
      Log.sendLog({ error });

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch sentiment',
      });
    }
  });

  // GET /api/v1/whale/flows - Get exchange flows
  router.get('/flows', async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        symbol: z.string().optional().default('BTC'),
      });

      const { symbol } = querySchema.parse(req.query);
      
      logger.info(`Fetching exchange flows for ${symbol}`);
      
      const flows = await getExchangeFlows(symbol.toUpperCase());

      return res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        flows: flows.map(f => ({
          exchange: f.exchange,
          inflow24h: formatUsd(f.inflow24h),
          outflow24h: formatUsd(f.outflow24h),
          netFlow: formatUsd(f.netFlow),
          netFlowRaw: f.netFlow,
          velocity: formatUsd(f.velocity),
          interpretation: f.netFlow > 0 ? 'Net inflow - selling pressure' : 'Net outflow - accumulation',
        })),
      });
    } catch (error: any) {
      logger.error('Error fetching exchange flows:', error);
      Log.sendLog({ error });

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch exchange flows',
      });
    }
  });

  // GET /api/v1/whale/analysis - Get comprehensive AI analysis
  router.get('/analysis', async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        symbol: z.string().optional().default('BTC'),
      });

      const { symbol } = querySchema.parse(req.query);
      
      logger.info(`Generating comprehensive analysis for ${symbol}`);
      
      const analysis = await getComprehensiveAnalysis(symbol.toUpperCase());

      return res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        analysis: {
          recommendation: analysis.recommendation,
          confidence: analysis.confidence,
          summary: analysis.summary,
          
          whaleMetrics: {
            exchangeNetFlow: formatUsd(analysis.whaleStats.exchangeNetFlow),
            exchangeNetFlowRaw: analysis.whaleStats.exchangeNetFlow,
            totalTransactions: analysis.whaleStats.largeTransactionsCount,
            uniqueWhales: analysis.whaleStats.whaleCount,
          },
          
          sentiment: {
            fearGreed: {
              value: analysis.sentiment.fearGreedIndex,
              classification: analysis.sentiment.fearGreedClassification,
            },
            fundingRate: {
              average: `${analysis.sentiment.avgFundingRate.toFixed(4)}%`,
              binance: `${analysis.sentiment.fundingRateBinance.toFixed(4)}%`,
              bybit: `${analysis.sentiment.fundingRateBybit.toFixed(4)}%`,
            },
            longShortRatio: analysis.sentiment.longShortRatio.toFixed(2),
            bias: analysis.sentiment.marketBias,
          },
          
          technical: {
            currentPrice: `$${analysis.technicalLevels.currentPrice.toLocaleString()}`,
            dailyHigh: `$${analysis.technicalLevels.dailyHigh.toLocaleString()}`,
            dailyLow: `$${analysis.technicalLevels.dailyLow.toLocaleString()}`,
            keySupport: `$${analysis.technicalLevels.keySupport.toLocaleString()}`,
            keyResistance: `$${analysis.technicalLevels.keyResistance.toLocaleString()}`,
          },
          
          signals: analysis.signals.map(s => ({
            type: s.type,
            direction: s.direction,
            strength: s.strength,
            description: s.description,
          })),
          
          bullishSignals: analysis.signals.filter(s => s.direction === 'bullish').length,
          bearishSignals: analysis.signals.filter(s => s.direction === 'bearish').length,
        },
      });
    } catch (error: any) {
      logger.error('Error generating analysis:', error);
      Log.sendLog({ error });

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate analysis',
      });
    }
  });

  // GET /api/v1/whale/summary - Get daily whale summary (legacy endpoint)
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        symbol: z.string().optional().default('BTC'),
      });

      const { symbol } = querySchema.parse(req.query);
      
      logger.info(`Generating whale summary for ${symbol}`);
      
      const [whaleStats, fearGreed, flows] = await Promise.all([
        getWhaleStats(symbol.toUpperCase()),
        getFearAndGreedIndex(),
        getExchangeFlows(symbol.toUpperCase()),
      ]);

      return res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        summary: {
          fearGreedIndex: fearGreed.value,
          fearGreedClassification: fearGreed.classification,
          whaleActivity: {
            totalTransactions: whaleStats.largeTransactionsCount,
            totalVolume: formatUsd(whaleStats.totalInflow24h + whaleStats.totalOutflow24h),
            exchangeNetFlow: formatUsd(whaleStats.exchangeNetFlow),
            interpretation: whaleStats.exchangeNetFlow < 0 
              ? 'Bullish - whales accumulating (coins leaving exchanges)'
              : whaleStats.exchangeNetFlow > 0 
                ? 'Bearish - whales distributing (coins going to exchanges)'
                : 'Neutral - no strong flow',
          },
          topExchanges: flows.slice(0, 3).map(f => ({
            name: f.exchange,
            netFlow: formatUsd(f.netFlow),
          })),
        },
      });
    } catch (error: any) {
      logger.error('Error generating summary:', error);
      Log.sendLog({ error });

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate summary',
      });
    }
  });

  return router;
};

function formatUsd(amount: number): string {
  if (Math.abs(amount) >= 1000000000) return `$${(amount / 1000000000).toFixed(2)}B`;
  if (Math.abs(amount) >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (Math.abs(amount) >= 1000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${amount.toFixed(2)}`;
}
