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
        risk: z.number().optional(),
        action: z.enum(['ENTRY', 'EXIT', 'MOVE_STOPLOSS']),
        takeprofit_price: z.string().optional(),
        stoploss_price: z.string().optional(),
      });

      let { symbol, side, price, risk, action, stoploss_price, takeprofit_price } = await entrySchema.parseAsync(
        req.body,
      );

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

          if (!risk) throw new Error('risk is empty.');

          await BinanceFunctions.entry({
            symbol,
            side,
            entryPrice: parseFloat(price),
            risk,
            stoplossPrice: parseFloat(stoploss_price),
            takeProfitPrice: parseFloat(takeprofit_price),
          });

          break;
        }

        case 'MOVE_STOPLOSS': {
          if (!stoploss_price) throw new Error('stoploss_price is empty.');

          await BinanceFunctions.setStoploss({ symbol, side, price: parseFloat(stoploss_price) });

          break;
        }
      }

      res.json({ success: true });
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

  return router;
};
