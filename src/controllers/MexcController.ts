import { Router } from 'express';
import { z } from 'zod';
import MexcFunctions from '../services/mexc';
import { NextFunction } from 'express';
import { Request } from 'express';
import { Response } from 'express';
import apiKeyMiddleware from '../middlewares/apikey';
import logger from '../utils/Logger';

class MexcController {
    public async entry(req: Request, res: Response, _next: NextFunction) {
        try {
            const entrySchema = z.object({
                symbol: z.string(),
                side: z.enum(['BUY', 'SELL']),
                price: z.string().optional(),
                risk: z.any().optional(),
                risk_amount: z.any().optional(),
                action: z.enum(['ENTRY', 'ENTRY_LIMIT', 'EXIT', 'MOVE_STOPLOSS']),
                takeprofit_price: z.string().optional(),
                stoploss_price: z.string().optional(),
            });

            let { symbol, side, price, risk, risk_amount, action, stoploss_price, takeprofit_price } =
                await entrySchema.parseAsync(req.body);

            console.log({ symbol, side, price, risk, risk_amount, action, stoploss_price, takeprofit_price });

            symbol = symbol?.split('.')?.[0];
            if (symbol && !symbol.includes('_')) {
                const usdtMatch = symbol.match(/^(.+?)(USDT)$/);
                if (usdtMatch) {
                    symbol = `${usdtMatch[1]}_USDT`;
                }
            }

            if (!symbol) throw new Error(`Symbol error ${symbol}`);

            const trade_account_id = req.params.trade_account_id;

            if (!trade_account_id) throw new Error('trade_account_id is empty.');

            logger.info(`Processing ${action} for ${symbol} on MEXC account ${trade_account_id}`);

            const client = await MexcFunctions.loadMexcClient(trade_account_id);

            const positions = await MexcFunctions.currentPositions(client, symbol);
            if (positions.length === 0) {
                logger.info(`Cancelling all open orders for ${symbol}`);
                try {
                    await client.post('/api/v1/private/order/cancel_all', { symbol });
                } catch (e) {
                    console.error('Failed to cancel open orders:', e);
                }
            }

            switch (action) {
                case 'ENTRY': {
                    if (!price) throw new Error('price is empty.');

                    if (!stoploss_price) throw new Error('stoploss_price is empty.');

                    if (!takeprofit_price) throw new Error('take_profit is empty.');

                    if (!risk && !risk_amount) throw new Error('risk and risk_amount is empty.');

                    logger.info(
                        `MEXC Entry order for ${symbol}: ${side} at ${price} with SL ${stoploss_price} and TP ${takeprofit_price}`,
                    );

                    const result = await MexcFunctions.entry({
                        client,
                        symbol,
                        side: side,
                        entryPrice: parseFloat(price),
                        risk: parseFloat(risk),
                        risk_amount: parseFloat(risk_amount),
                        stoplossPrice: parseFloat(stoploss_price),
                        takeProfitPrice: parseFloat(takeprofit_price),
                    });

                    return res.status(200).json(result);
                }
                case 'MOVE_STOPLOSS': {
                    if (!stoploss_price) throw new Error('stoploss_price is empty.');

                    logger.info(`MEXC Moving stoploss for ${symbol} to ${stoploss_price}`);

                    const result = await MexcFunctions.setStoploss({
                        client,
                        symbol,
                        side,
                        price: parseFloat(stoploss_price),
                    });

                    return res.status(200).json(result);
                }

                case 'EXIT': {
                    logger.info(`MEXC Cancelling all open orders for ${symbol}`);
                    try {
                        await client.post('/api/v1/private/order/cancel_all', { symbol });
                    } catch (e) {
                        console.error('Failed to cancel open orders:', e);
                    }

                    const currentPositions = await MexcFunctions.currentPositions(client, symbol);

                    if (currentPositions.length === 0) {
                        logger.info(`No open position found for ${symbol} after cancelling orders`);
                    } else {
                        const currentPosition = currentPositions[0];

                        const positionVol = currentPosition.holdVol;
                        const isLongPosition = currentPosition.positionType === 1;
                        const originalSideWasLong = side === 'BUY';

                        if (positionVol > 0 && isLongPosition === originalSideWasLong) {
                            await client.post('/api/v1/private/order/create', {
                                symbol: symbol,
                                price: currentPosition.holdAvgPrice.toString(),
                                vol: positionVol.toString(),
                                leverage: currentPosition.leverage,
                                side: isLongPosition ? 4 : 2, // 4=close_long, 2=close_short
                                type: 5, // market
                                openType: currentPosition.openType,
                            });
                            logger.info(`MEXC Close order placed for ${symbol}`);
                        } else if (positionVol > 0) {
                            logger.warn(
                                `Position side mismatch for ${symbol}. Current: ${isLongPosition ? 'LONG' : 'SHORT'}, Expected: ${
                                    originalSideWasLong ? 'LONG' : 'SHORT'
                                }. Skipping position close to avoid race condition.`,
                            );
                        }
                    }

                    return res.status(200).json({ result: 'Orders cancelled and position checked for safe exit' });
                }
            }

            res.json({ success: true });
        } catch (error: any) {
            logger.error('Error in MEXC entry endpoint', error);
            res.status(500).json({ error: error?.message || '' });
        }
    }

    public async balance(req: Request, res: Response, _next: NextFunction) {
        try {
            const trade_account_id = req.params.trade_account_id;

            if (!trade_account_id) throw new Error('trade_account_id is empty.');

            logger.info(`Getting MEXC balance for account ${trade_account_id}`);

            const client = await MexcFunctions.loadMexcClient(trade_account_id);

            const result = await MexcFunctions.getCurrentBalance(client);

            res.status(200).json(result);
        } catch (error: any) {
            logger.error('Error getting MEXC balance', error);
            res.status(500).json({ error: error?.message || '' });
        }
    }

    public async balanceV3(req: Request, res: Response, _next: NextFunction) {
        try {
            const trade_account_id = req.params.trade_account_id;

            if (!trade_account_id) throw new Error('trade_account_id is empty.');

            logger.info(`Getting MEXC balance for account ${trade_account_id}`);

            const client = await MexcFunctions.loadMexcClient(trade_account_id);

            const result = await MexcFunctions.getCurrentBalanceV3(client);

            res.status(200).json(result);
        } catch (error: any) {
            logger.error('Error getting MEXC balance', error);
            res.status(500).json({ error: error?.message || '' });
        }
    }

    public async income(req: Request, res: Response, _next: NextFunction) {
        try {
            const trade_account_id = req.params.trade_account_id;

            if (!trade_account_id) throw new Error('trade_account_id is empty.');

            logger.info(`Getting MEXC income for account ${trade_account_id}`);

            const client = await MexcFunctions.loadMexcClient(trade_account_id);

            const result = await MexcFunctions.getIncome(client, {}, trade_account_id);

            res.json(result);
        } catch (error: any) {
            logger.error('Error getting MEXC income', error);
            res.status(500).json({ error: error?.message || '' });
        }
    }

    public async tradeHistory(req: Request, res: Response, _next: NextFunction) {
        try {
            let symbol = req.query.symbol as string;

            if (!symbol) throw new Error('symbol is empty.');

            const trade_account_id = req.params.trade_account_id;

            if (!trade_account_id) throw new Error('trade_account_id is empty.');

            if (symbol && !symbol.includes('_')) {
                const usdtMatch = symbol.match(/^(.+?)(USDT)$/);
                if (usdtMatch) {
                    symbol = `${usdtMatch[1]}_USDT`;
                }
            }

            logger.info(`Getting MEXC trade history for ${symbol} on account ${trade_account_id}`);

            const client = await MexcFunctions.loadMexcClient(trade_account_id);

            const result = await MexcFunctions.getTradeHistory(client, symbol, 1000);

            res.json(result);
        } catch (error: any) {
            logger.error('Error getting MEXC trade history', error);
            res.status(500).json({ error: error?.message || '' });
        }
    }

    public async currentPosition(req: Request, res: Response, _next: NextFunction) {
        try {
            const trade_account_id = req.params.trade_account_id;

            if (!trade_account_id) throw new Error('trade_account_id is empty.');

            logger.info(`Getting MEXC current positions on account ${trade_account_id}`);

            const client = await MexcFunctions.loadMexcClient(trade_account_id);

            const positions = await MexcFunctions.currentPositions(client);

            let stopOrders: any[] = [];
            try {
                stopOrders = await MexcFunctions.getStopOrders(client);
            } catch (e) {
                console.error('Failed to fetch stop orders:', e);
            }

            type ExtendedPosition = (typeof positions)[number] & {
                stoploss: string;
                takeprofit: string;
                stoplossAmount: number;
                takeprofitAmount: number;
                unrealizedProfit: number;
            };

            const extendedPositions: ExtendedPosition[] = await Promise.all(
                positions.map(async (position) => {
                    const stopOrder = stopOrders.find(
                        (order) => order.symbol === position.symbol && String(order.positionId) === String(position.positionId),
                    );

                    const stoploss = stopOrder?.stopLossPrice?.toString() || '';
                    const takeprofit = stopOrder?.takeProfitPrice?.toString() || '';

                    const contractInfo = await MexcFunctions.getContractInfo(client, position.symbol);
                    const contractSizeNum = parseFloat(contractInfo.contractSize);
                    const size = position.holdVol * contractSizeNum;
                    const entryPrice = Number(position.holdAvgPrice);

                    const stoplossAmount = stoploss ? Number(stoploss) * size - entryPrice * size : 0;
                    const takeprofitAmount = takeprofit ? Number(takeprofit) * size - entryPrice * size : 0;

                    let markPrice = entryPrice;
                    try {
                        markPrice = await MexcFunctions.getTickerPrice(client, position.symbol);
                    } catch {}
                    const unrealizedProfit = position.positionType === 1
                        ? (markPrice - entryPrice) * size
                        : (entryPrice - markPrice) * size;

                    const extendedPosition: ExtendedPosition = {
                        ...position,
                        stoploss,
                        takeprofit,
                        stoplossAmount,
                        takeprofitAmount,
                        unrealizedProfit,
                    };

                    return extendedPosition;
                }),
            );

            res.status(200).json(extendedPositions);
        } catch (error: any) {
            logger.error('Error getting MEXC current position', error);
            res.status(500).json({ error: error?.message || '' });
        }
    }

    public async openOrders(req: Request, res: Response, _next: NextFunction) {
        try {
            const trade_account_id = req.params.trade_account_id;

            if (!trade_account_id) throw new Error('trade_account_id is empty.');

            logger.info(`Getting MEXC open orders for account ${trade_account_id}`);

            const client = await MexcFunctions.loadMexcClient(trade_account_id);

            const result = await MexcFunctions.getOpenOrders(client);

            res.status(200).json(result);
        } catch (error: any) {
            logger.error('Error getting MEXC open orders', error);
            res.status(500).json({ error: error?.message || '' });
        }
    }
}

export default () => {
    const controller = new MexcController();
    const router = Router();
    router.use(apiKeyMiddleware);

    router.post('/entry/:trade_account_id', controller.entry);
    router.get('/trade-history/:trade_account_id', controller.tradeHistory);
    router.get('/current-position/:trade_account_id', controller.currentPosition);
    router.get('/open-orders/:trade_account_id', controller.openOrders);
    router.get('/balance/:trade_account_id', controller.balance);
    router.get('/balance-v3/:trade_account_id', controller.balanceV3);
    router.get('/income/:trade_account_id', controller.income);

    return router;
};
