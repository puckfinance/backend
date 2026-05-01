import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createUIMessageStream, pipeUIMessageStreamToResponse, type UIMessageStreamWriter } from 'ai';
import { getAIAnalysis, getAIQuickSummary, streamAIAnalysis, streamBacktestAnalysis, extractTradeAlert, type TimeframeSet } from '../services/aiAnalysis';
import { evaluateTrade, fetchBinanceKlines } from './MarketAnalysisHistoryController';
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
                rsi: 0,
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

    // POST /api/v1/ai/analysis/stream - Streaming AI analysis via AI SDK UI Message Stream
    router.post('/analysis/stream', async (req: Request, res: Response) => {
        try {
            const bodySchema = z.object({
                symbol: z.string().optional().default('BTC'),
                timeframe: z.enum(['higher', 'lower', 'all']).optional().default('all'),
            });

            const { symbol, timeframe } = bodySchema.parse(req.body);
            logger.info(`Streaming AI analysis for ${symbol} (timeframe: ${timeframe})`);

            if (req.clearTimeout) req.clearTimeout();

            const { stream, marketData } = await streamAIAnalysis(symbol.toUpperCase(), timeframe as TimeframeSet);

            const uiStream = createUIMessageStream({
                execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
                    writer.write({
                        type: 'data-marketData',
                        data: marketData,
                    } as any);

                    let fullAnalysisText = '';

                    const textStream = stream.toUIMessageStream();
                    const reader = textStream.getReader();

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            if ((value as any).type === 'text-delta') {
                                fullAnalysisText += (value as any).textDelta;
                            }
                            writer.write(value);
                        }
                    } finally {
                        reader.releaseLock();
                    }

                    const tradeAlert = await extractTradeAlert(fullAnalysisText);

                    writer.write({
                        type: 'data-tradeAlert',
                        data: tradeAlert,
                    } as any);

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
                        tradeAlertActive: tradeAlert.active,
                        tradeAlertDirection: tradeAlert.direction,
                        tradeAlertEntryPrice: tradeAlert.entryPrice,
                        tradeAlertStopLoss: tradeAlert.stopLoss,
                        tradeAlertTakeProfit: tradeAlert.takeProfit,
                        tradeAlertRiskReward: tradeAlert.riskRewardRatio,
                        tradeAlertSetup: tradeAlert.tradeSetup,
                        tradeAlertReasoning: tradeAlert.reasoning,
                    });

                    writer.write({
                        type: 'data-done',
                        data: { analysisId: savedId },
                    } as any);
                },
                onError: (error: unknown) => {
                    logger.error('Stream error:', error);
                    return error instanceof Error ? error.message : 'Stream error';
                },
            });

            pipeUIMessageStreamToResponse({
                response: res,
                stream: uiStream,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            });
        } catch (error: any) {
            logger.error('Error streaming AI analysis:', error);
            Log.sendLog({ error });

            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to stream AI analysis',
                });
            }
        }
    });

    // POST /api/v1/ai/backtest/stream - Streaming backtest analysis via AI SDK UI Message Stream
    router.post('/backtest/stream', async (req: Request, res: Response) => {
        try {
            const bodySchema = z.object({
                symbol: z.string().optional().default('BTC'),
                date: z.string().min(1),
                timeframe: z.enum(['higher', 'lower', 'all']).optional().default('all'),
            });

            const { symbol, date, timeframe } = bodySchema.parse(req.body);
            const targetDate = new Date(date);
            if (isNaN(targetDate.getTime())) {
                return res.status(400).json({ success: false, error: 'Invalid date format' });
            }
            if (targetDate >= new Date()) {
                return res.status(400).json({ success: false, error: 'Date must be in the past' });
            }

            logger.info(`Streaming backtest analysis for ${symbol} at ${date}`);

            if (req.clearTimeout) req.clearTimeout();

            const { stream, marketData } = await streamBacktestAnalysis(symbol.toUpperCase(), targetDate, timeframe as TimeframeSet);

            const uiStream = createUIMessageStream({
                execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
                    writer.write({
                        type: 'data-marketData',
                        data: { ...marketData, isBacktest: true, targetDate: date },
                    } as any);

                    let fullAnalysisText = '';

                    const textStream = stream.toUIMessageStream();
                    const reader = textStream.getReader();

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            if ((value as any).type === 'text-delta') {
                                fullAnalysisText += (value as any).textDelta;
                            }
                            writer.write(value);
                        }
                    } finally {
                        reader.releaseLock();
                    }

                    const tradeAlert = await extractTradeAlert(fullAnalysisText);

                    writer.write({
                        type: 'data-tradeAlert',
                        data: tradeAlert,
                    } as any);

                    let tradeResult = null;
                    if (
                        tradeAlert.active &&
                        tradeAlert.direction !== 'NONE' &&
                        tradeAlert.entryPrice != null &&
                        tradeAlert.stopLoss != null &&
                        tradeAlert.takeProfit != null
                    ) {
                        const startTimeMs = targetDate.getTime();
                        const nowMs = Date.now();
                        try {
                            const klines = await fetchBinanceKlines(symbol.toUpperCase(), startTimeMs, nowMs);
                            const result = evaluateTrade(
                                klines,
                                tradeAlert.direction as 'LONG' | 'SHORT',
                                tradeAlert.entryPrice,
                                tradeAlert.stopLoss,
                                tradeAlert.takeProfit,
                            );
                            const hitKline = result === 'WIN' || result === 'LOSS'
                                ? klines.find((k) => {
                                    const high = parseFloat(k.high);
                                    const low = parseFloat(k.low);
                                    if (tradeAlert.direction === 'LONG') {
                                        return (result === 'WIN' && high >= tradeAlert.takeProfit!) ||
                                            (result === 'LOSS' && low <= tradeAlert.stopLoss!);
                                    }
                                    return (result === 'WIN' && low <= tradeAlert.takeProfit!) ||
                                        (result === 'LOSS' && high >= tradeAlert.stopLoss!);
                                })
                                : null;
                            const lastClose = klines.length > 0 ? parseFloat(klines[klines.length - 1].close) : null;
                            tradeResult = {
                                result,
                                hitAt: hitKline ? new Date(hitKline.openTime).toISOString() : null,
                                currentPrice: lastClose,
                            };
                        } catch (err: any) {
                            logger.error('Backtest trade result evaluation failed:', err.message);
                        }
                    }

                    writer.write({
                        type: 'data-tradeResult',
                        data: tradeResult,
                    } as any);

                    saveAnalysis({
                        symbol: symbol.toUpperCase(),
                        price: marketData.price,
                        priceChange24h: marketData.priceChange24h,
                        priceChangePercentage24h: marketData.priceChangePercentage24h,
                        marketCap: 0,
                        volume24h: 0,
                        keySupport: marketData.keySupport,
                        keyResistance: marketData.keyResistance,
                        fearGreedIndex: marketData.fearGreedIndex,
                        fearGreedClassification: marketData.fearGreedClassification,
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
                        tradeAlertActive: tradeAlert.active,
                        tradeAlertDirection: tradeAlert.direction,
                        tradeAlertEntryPrice: tradeAlert.entryPrice,
                        tradeAlertStopLoss: tradeAlert.stopLoss,
                        tradeAlertTakeProfit: tradeAlert.takeProfit,
                        tradeAlertRiskReward: tradeAlert.riskRewardRatio,
                        tradeAlertSetup: tradeAlert.tradeSetup,
                        tradeAlertReasoning: tradeAlert.reasoning,
                        isBacktest: true,
                        backtestDate: date,
                    }).catch((err) => logger.error('Backtest save failed:', err));
                },
                onError: (error: unknown) => {
                    logger.error('Backtest stream error:', error);
                    return error instanceof Error ? error.message : 'Stream error';
                },
            });

            pipeUIMessageStreamToResponse({
                response: res,
                stream: uiStream,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            });
        } catch (error: any) {
            logger.error('Error streaming backtest analysis:', error);
            Log.sendLog({ error });

            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to stream backtest analysis',
                });
            }
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
