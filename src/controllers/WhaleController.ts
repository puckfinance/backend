/**
 * Whale Controller
 * 
 * API endpoints for whale tracking data
 * 
 * @author AI Assistant
 * @createdDate 2026-04-05
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  fetchWhaleAlerts,
  getWhaleStats,
  getNotableWhaleWallets,
  formatWhaleAlertForDisplay,
  WhaleAlert,
  WhaleStats,
} from '../services/whaleTracker';
import logger from '../utils/Logger';
import Log from '../services/log';

/**
 * Analyze whale trends from alerts
 */
function analyzeWhaleTrends(alerts: WhaleAlert[], stats: WhaleStats): {
  trend: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  keyObservations: string[];
} {
  const observations: string[] = [];
  let bullishSignals = 0;
  let bearishSignals = 0;

  // Check exchange flow
  if (stats.exchangeNetFlow > 50000000) {
    observations.push('Large net outflows from exchanges (bullish - accumulation)');
    bullishSignals += 2;
  } else if (stats.exchangeNetFlow < -50000000) {
    observations.push('Large net inflows to exchanges (bearish - distribution)');
    bearishSignals += 2;
  }

  // Check transaction types
  const exchangeTxs = alerts.filter(a => a.transactionType === 'exchange');
  if (exchangeTxs.length > alerts.length * 0.7) {
    observations.push('High exchange activity - institutional movement');
  }

  // Check for notable exchanges
  const binanceTxs = alerts.filter(a => a.exchange === 'Binance');
  const coinbaseTxs = alerts.filter(a => a.exchange === 'Coinbase');
  
  if (binanceTxs.length > 3) {
    observations.push(`Binance active with ${binanceTxs.length} large transactions`);
  }
  if (coinbaseTxs.length > 3) {
    observations.push(`Coinbase active with ${coinbaseTxs.length} large transactions`);
  }

  // Check for large single transactions
  const largeTxs = alerts.filter(a => a.amountUsd > 50000000);
  if (largeTxs.length > 0) {
    observations.push(`${largeTxs.length} mega-whale transactions (>$50M) detected`);
  }

  // Determine trend
  let trend = 'neutral';
  let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';

  if (bullishSignals > bearishSignals) {
    trend = 'Accumulation phase';
    sentiment = 'bullish';
    observations.push('Overall: Bullish whale sentiment');
  } else if (bearishSignals > bullishSignals) {
    trend = 'Distribution phase';
    sentiment = 'bearish';
    observations.push('Overall: Bearish whale sentiment');
  }

  return {
    trend,
    sentiment,
    keyObservations: observations,
  };
}

/**
 * Get sentiment interpretation
 */
function getSentimentInterpretation(stats: WhaleStats): string {
  if (stats.exchangeNetFlow > 100000000) {
    return 'Strong bearish signal - whales are moving coins to exchanges for selling';
  }
  if (stats.exchangeNetFlow > 50000000) {
    return 'Moderate bearish signal - some distribution detected';
  }
  if (stats.exchangeNetFlow < -100000000) {
    return 'Strong bullish signal - whales accumulating, taking coins off exchanges';
  }
  if (stats.exchangeNetFlow < -50000000) {
    return 'Moderate bullish signal - accumulation detected';
  }
  return 'Neutral - no strong directional whale flow';
}

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
      
      const alerts = await fetchWhaleAlerts(
        parseFloat(min_value),
        parseInt(limit, 10)
      );

      // Filter by symbol if specified
      const filteredAlerts = symbol && symbol !== 'ALL'
        ? alerts.filter(a => a.symbol.toUpperCase() === symbol.toUpperCase())
        : alerts;

      const formattedAlerts = filteredAlerts.map(formatWhaleAlertForDisplay);

      return res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        count: filteredAlerts.length,
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

      return res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        stats: {
          totalInflow24h: `$${(stats.totalInflow24h / 1000000).toFixed(2)}M`,
          totalOutflow24h: `$${(stats.totalOutflow24h / 1000000).toFixed(2)}M`,
          largeTransactionsCount: stats.largeTransactionsCount,
          exchangeNetFlow: `$${(stats.exchangeNetFlow / 1000000).toFixed(2)}M`,
          whaleCount: stats.whaleCount,
          sentiment: stats.exchangeNetFlow > 0 ? 'bearish' : 'bullish',
          interpretation: getSentimentInterpretation(stats),
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

  // GET /api/v1/whale/wallets - Get notable whale wallets
  router.get('/wallets', async (_req: Request, res: Response) => {
    try {
      const wallets = getNotableWhaleWallets();

      return res.status(200).json({
        success: true,
        wallets,
      });
    } catch (error: any) {
      logger.error('Error fetching notable wallets:', error);
      Log.sendLog({ error });

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch notable wallets',
      });
    }
  });

  // GET /api/v1/whale/summary - Get daily whale summary
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        symbol: z.string().optional().default('BTC'),
      });

      const { symbol } = querySchema.parse(req.query);
      
      logger.info(`Generating whale daily summary for ${symbol}`);
      
      // Fetch recent alerts and stats
      const [alerts, stats] = await Promise.all([
        fetchWhaleAlerts(500000, 20), // $500K minimum for summary
        getWhaleStats(symbol.toUpperCase()),
      ]);

      const filteredAlerts = symbol !== 'ALL'
        ? alerts.filter(a => a.symbol.toUpperCase() === symbol.toUpperCase())
        : alerts;

      // Analyze trends
      const analysis = analyzeWhaleTrends(filteredAlerts, stats);

      return res.status(200).json({
        success: true,
        symbol: symbol.toUpperCase(),
        summary: {
          alertsCount: filteredAlerts.length,
          totalVolume: `$${((stats.totalInflow24h + stats.totalOutflow24h) / 1000000).toFixed(2)}M`,
          ...stats,
          analysis,
          topAlerts: filteredAlerts.slice(0, 5).map(formatWhaleAlertForDisplay),
        },
      });
    } catch (error: any) {
      logger.error('Error generating whale daily summary:', error);
      Log.sendLog({ error });

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate summary',
      });
    }
  });

  return router;
};
