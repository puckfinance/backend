import { Router } from 'express';
import { z } from 'zod';
import BinanceFunctions from '../services/binance';
import { NextFunction } from 'express';
import { Request } from 'express';
import { Response } from 'express';

class BinanceController {
  public async entry(req: Request, res: Response, _next: NextFunction) {
    const schema = z.object({
      symbol: z.string(),
      side: z.enum(['BUY', 'SELL']),
      entry_price: z.string(),
      risk: z.number(),
      details: z.object({
        action: z.enum(['buy', 'sell', 'set_stoploss']),
        takeprofit_price: z.string(),
        stoploss_price: z.string(),
      }),
      partial_profits: z.array(
        z.object({
          where: z.number(),
          qty: z.number(),
        }),
      ),
    });

    const { symbol, side, entry_price, risk, details, partial_profits } = await schema.parseAsync(req.body);

    switch (details.action) {
      case 'buy':
      case 'sell':
        await BinanceFunctions.entry({
          symbol,
          side,
          entryPrice: parseFloat(entry_price),
          risk,
          stoplossPrice: parseFloat(details.stoploss_price),
          takeProfitPrice: parseFloat(details.takeprofit_price),
          partialProfits: partial_profits,
        });
    }

    res.json({ success: true });
  }
}

export default () => {
  const controller = new BinanceController();
  const router = Router();
  router.put('/entry', controller.entry);

  return router;
};
