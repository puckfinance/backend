import { Router } from 'express';
import { z } from 'zod';
import BybitFunctions, { bybitClient } from '../services/bybit';
import { NextFunction } from 'express';
import { Request } from 'express';
import { Response } from 'express';
import apiKeyMiddleware from '../middlewares/apikey';

class BybitController {
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

      const bybitSides = {
        BUY: 'Buy' as const,
        SELL: 'Sell' as const,
      };

      let { symbol, side, price, risk, risk_amount, action, stoploss_price, takeprofit_price } =
        await entrySchema.parseAsync(req.body);

      symbol = symbol?.split('.')?.[0];

      if (!symbol) throw new Error(`Symbol error ${symbol}`);

      // cancel all open orders if there is no open position
      const positions = await bybitClient.getPositionInfo({
        category: 'linear',
        symbol,
      });

      if (positions.result.list.length === 0) {
        console.log('Cancelling all open orders');
        await bybitClient.cancelAllOrders({
          category: 'linear',
        });
      }

      switch (action) {
        case 'ENTRY': {
          if (!price) throw new Error('price is empty.');

          if (!stoploss_price) throw new Error('stoploss_price is empty.');

          if (!takeprofit_price) throw new Error('take_profit is empty.');

          if (!risk && !risk_amount) throw new Error('risk and risk_amount is empty.');

          

          const result = await BybitFunctions.entry({
            symbol,
            side: bybitSides[side],
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

          const result = await BybitFunctions.setStoploss({ symbol, price: parseFloat(stoploss_price) });

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
      const result = await bybitClient.getAccountInfo();

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || '' });
    }
  }


}

export default () => {
  const controller = new BybitController();
  const router = Router();
  router.use(apiKeyMiddleware);

  router.post('/entry', controller.entry);
  // router.get('/trade-history', controller.tradeHistory);
  // router.get('/current-position', controller.currentPosition);
  // router.get('/open-orders', controller.openOrders);
  // router.get('/balance', controller.balance);
  // router.get('/income', controller.income);
  // router.get('/snapshot', controller.getSnapshots);

  return router;
};
