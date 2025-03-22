import { Router } from 'express';
import { z } from 'zod';
import BinanceFunctions, { binanceClient } from '../services/binance';
import { NextFunction } from 'express';
import { Request } from 'express';
import { Response } from 'express';
import apiKeyMiddleware from '../middlewares/apikey';
import { NewFuturesOrder } from 'binance-api-node';
import { getClient as getRedisClient, isConnected as isRedisConnected } from '../infrastructure/redis';

class BinanceController {
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

      symbol = symbol?.split('.')?.[0];

      if (!symbol) throw new Error(`Symbol error ${symbol}`);

      // cancel all open orders if there is no open position
      const positions = await BinanceFunctions.currentPositions(symbol);
      if (positions.length === 0) {
        console.log('Cancelling all open orders');
        await binanceClient.futuresCancelAllOpenOrders({
          symbol,
        });
      }

      switch (action) {
        case 'ENTRY': {
          if (!price) throw new Error('price is empty.');

          if (!stoploss_price) throw new Error('stoploss_price is empty.');

          if (!takeprofit_price) throw new Error('take_profit is empty.');

          if (!risk && !risk_amount) throw new Error('risk and risk_amount is empty.');

          const result = await BinanceFunctions.entry({
            symbol,
            side,
            entryPrice: parseFloat(price),
            risk: parseFloat(risk),
            risk_amount: parseFloat(risk_amount),
            stoplossPrice: parseFloat(stoploss_price),
            takeProfitPrice: parseFloat(takeprofit_price),
          });

          return res.status(200).json(result);
        }
        case 'ENTRY_LIMIT': {
          if (!price) throw new Error('price is empty.');

          if (!stoploss_price) throw new Error('stoploss_price is empty.');

          if (!takeprofit_price) throw new Error('take_profit is empty.');

          if (!risk && !risk_amount) throw new Error('risk and risk_amount is empty.');

          const result = await BinanceFunctions.entryLimit({
            symbol,
            side,
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

          const result = await BinanceFunctions.setStoploss({ symbol, side, price: parseFloat(stoploss_price) });

          return res.status(200).json(result);
        }

        case 'EXIT': {
          if (positions.length === 0) {
            console.log('Cancelling all open orders');
            await binanceClient.futuresCancelAllOpenOrders({
              symbol,
            });
          } else {
            const closeOrder: NewFuturesOrder = {
              symbol: symbol,
              type: 'MARKET',
              side: side === 'BUY' ? 'SELL' : 'BUY',
              quantity: `${positions[0].positionAmt}`,
            };

            await binanceClient.futuresCancelAllOpenOrders({
              symbol,
            });

            await binanceClient.futuresOrder(closeOrder);
          }

          return res.status(200).json({ result: 'Cancelling all open orders' });
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.log({ error: error?.message });
      res.status(500).json({ error: error?.message || '' });
    }
  }

  public async balance(_req: Request, res: Response, _next: NextFunction) {
    try {
      const result = await BinanceFunctions.getCurrentBalance();

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || '' });
    }
  }

  public async income(_req: Request, res: Response, _next: NextFunction) {
    try {
      const result = await BinanceFunctions.getIncome();

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || '' });
    }
  }

  public async tradeHistory(req: Request, res: Response, _next: NextFunction) {
    try {
      const symbol = req.query.symbol as string;

      if (!symbol) throw new Error('symbol is empty.');

      const result = await BinanceFunctions.getTradeHistory(symbol, 1000);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || '' });
    }
  }

  public async currentPosition(req: Request, res: Response, _next: NextFunction) {
    try {
      const symbol = req.query.symbol as string;

      if (!symbol) throw new Error('symbol is empty.');

      const result = await BinanceFunctions.currentPositions(symbol);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || '' });
    }
  }

  public async openOrders(_req: Request, res: Response, _next: NextFunction) {
    try {
      // const symbol = req.query.symbol as string;

      // if (!symbol) throw new Error('symbol is empty.');

      const result = await BinanceFunctions.getOpenOrders();

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || '' });
    }
  }

  public async getSnapshots(req: Request, res: Response, _next: NextFunction) {
    try {
      const snapshotSchema = z.object({
        startTime: z.string().optional(),
        endTime: z.string().optional(),
      });

      const cacheKey = `snapshots_${req.query.startTime || ''}_${req.query.endTime || ''}`;
      
      // Try to get data from Redis first if connected
      if (isRedisConnected) {
        try {
          const redisClient = getRedisClient();
          const cachedData = await redisClient.get(cacheKey);
          if (cachedData) {
            return res.json(JSON.parse(cachedData));
          }
        } catch (redisErr) {
          console.error('Redis error in snapshots:', redisErr);
          // Continue with normal flow if Redis fails
        }
      }
      
      const { startTime, endTime } = await snapshotSchema.parseAsync(req.query);

      const response = await BinanceFunctions.getSnapshot({
        startTime: startTime ? parseInt(startTime) : Math.floor(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to 30 days ago
        endTime: endTime ? parseInt(endTime) : Math.floor(Date.now()), // Default to now
      });
      
      // Cache in Redis if connected
      if (isRedisConnected) {
        try {
          const redisClient = getRedisClient();
          await redisClient.set(cacheKey, JSON.stringify(response), {
            EX: 60 * 5 // 5 minutes cache
          });
        } catch (redisErr) {
          console.error('Failed to cache snapshots in Redis:', redisErr);
        }
      }

      return res.json(response);
    } catch (error) {
      console.error('Error getting snapshots:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch snapshots', 
        message: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}

export default () => {
  const controller = new BinanceController();
  const router = Router();
  router.use(apiKeyMiddleware);

  router.post('/entry', controller.entry);
  router.get('/trade-history', controller.tradeHistory);
  router.get('/current-position', controller.currentPosition);
  router.get('/open-orders', controller.openOrders);
  router.get('/balance', controller.balance);
  router.get('/income', controller.income);
  router.get('/snapshot', controller.getSnapshots);

  return router;
};
