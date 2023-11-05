import { Router } from 'express';
import { z } from 'zod';
import BinanceFunctions, { binanceClient } from '../services/binance';
import { NextFunction } from 'express';
import { Request } from 'express';
import { Response } from 'express';
import apiKeyMiddleware from '../middlewares/apikey';

class BinanceController {
  public async entry(req: Request, res: Response, _next: NextFunction) {
    try {
      const entrySchema = z.object({
        symbol: z.string(),
        side: z.enum(['BUY', 'SELL']),
        price: z.string().optional(),
        risk: z.any().optional(),
        risk_amount: z.any().optional(),
        action: z.enum(['ENTRY', 'EXIT', 'MOVE_STOPLOSS']),
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
        case 'MOVE_STOPLOSS': {
          if (!stoploss_price) throw new Error('stoploss_price is empty.');

          const result = await BinanceFunctions.setStoploss({ symbol, side, price: parseFloat(stoploss_price) });

          return res.status(200).json(result);
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
}

export default () => {
  const controller = new BinanceController();
  const router = Router();
  router.use(apiKeyMiddleware);

  router.post('/entry', controller.entry);
  router.get('/trade-history', controller.tradeHistory);
  router.get('/current-position', controller.currentPosition);
  router.get('/balance', controller.balance);
  router.get('/income', controller.income);

  return router;
};
