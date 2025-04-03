import { Router } from 'express';
import { z } from 'zod';
import BinanceFunctions from '../services/binance';
import { NextFunction } from 'express';
import { Request } from 'express';
import { Response } from 'express';
import apiKeyMiddleware from '../middlewares/apikey';
import { FuturesAccountPosition, NewFuturesOrder } from 'binance-api-node';
import logger from '../utils/Logger';

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

      const trade_account_id = req.params.trade_account_id;

      if (!trade_account_id) throw new Error('trade_account_id is empty.');

      logger.info(`Processing ${action} for ${symbol} on account ${trade_account_id}`);
      
      const client = await BinanceFunctions.loadBinanceClient(trade_account_id);

      // cancel all open orders if there is no open position
      const positions = await BinanceFunctions.currentPositions(client, symbol);
      if (positions.length === 0) {
        logger.info(`Cancelling all open orders for ${symbol}`);
        await client.futuresCancelAllOpenOrders({
          symbol,
        });
      }

      switch (action) {
        case 'ENTRY': {
          if (!price) throw new Error('price is empty.');

          if (!stoploss_price) throw new Error('stoploss_price is empty.');

          if (!takeprofit_price) throw new Error('take_profit is empty.');

          if (!risk && !risk_amount) throw new Error('risk and risk_amount is empty.');

          logger.info(`Entry order for ${symbol}: ${side} at ${price} with SL ${stoploss_price} and TP ${takeprofit_price}`);
          
          const result = await BinanceFunctions.entry({
            client,
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

          logger.info(`Entry limit order for ${symbol}: ${side} at ${price} with SL ${stoploss_price} and TP ${takeprofit_price}`);
          
          const result = await BinanceFunctions.entryLimit({
            client,
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

          logger.info(`Moving stoploss for ${symbol} to ${stoploss_price}`);
          
          const result = await BinanceFunctions.setStoploss({
            client,
            symbol,
            side,
            price: parseFloat(stoploss_price),
          });

          return res.status(200).json(result);
        }

        case 'EXIT': {
          if (positions.length === 0) {
            logger.info(`Cancelling all open orders for ${symbol}`);
            await client.futuresCancelAllOpenOrders({
              symbol,
            });
          } else {
            logger.info(`Exiting position for ${symbol}, current position: ${positions[0].positionAmt}`);
            
            const closeOrder: NewFuturesOrder = {
              symbol: symbol,
              type: 'MARKET',
              side: side === 'BUY' ? 'SELL' : 'BUY',
              quantity: `${positions[0].positionAmt}`,
            };

            await client.futuresCancelAllOpenOrders({
              symbol,
            });

            await client.futuresOrder(closeOrder);
          }

          return res.status(200).json({ result: 'Cancelling all open orders' });
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error in Binance entry endpoint', error);
      res.status(500).json({ error: error?.message || '' });
    }
  }

  public async balance(req: Request, res: Response, _next: NextFunction) {
    try {
      const trade_account_id = req.params.trade_account_id;

      if (!trade_account_id) throw new Error('trade_account_id is empty.');

      logger.info(`Getting balance for account ${trade_account_id}`);
      
      const client = await BinanceFunctions.loadBinanceClient(trade_account_id);

      if (!client) throw new Error('client not found.');

      const result = await BinanceFunctions.getCurrentBalance(client);

      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error getting Binance balance', error);
      res.status(500).json({ error: error?.message || '' });
    }
  }

  public async balanceV3(req: Request, res: Response, _next: NextFunction) {
    try {
      const trade_account_id = req.params.trade_account_id;

      if (!trade_account_id) throw new Error('trade_account_id is empty.');

      logger.info(`Getting balance for account ${trade_account_id}`);
      
      const client = await BinanceFunctions.loadBinanceClient(trade_account_id);

      if (!client) throw new Error('client not found.');

      const result = await BinanceFunctions.getCurrentBalanceV3(client);

      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error getting Binance balance', error);
      res.status(500).json({ error: error?.message || '' });
    }
  }

  public async income(req: Request, res: Response, _next: NextFunction) {
    try {
      const trade_account_id = req.params.trade_account_id;

      if (!trade_account_id) throw new Error('trade_account_id is empty.');

      logger.info(`Getting income for account ${trade_account_id}`);
      
      const client = await BinanceFunctions.loadBinanceClient(trade_account_id);

      if (!client) throw new Error('client not found.');

      const result = await BinanceFunctions.getIncome(client);

      res.json(result);
    } catch (error: any) {
      logger.error('Error getting Binance income', error);
      res.status(500).json({ error: error?.message || '' });
    }
  }

  public async tradeHistory(req: Request, res: Response, _next: NextFunction) {
    try {
      const symbol = req.query.symbol as string;

      if (!symbol) throw new Error('symbol is empty.');

      const trade_account_id = req.params.trade_account_id;

      if (!trade_account_id) throw new Error('trade_account_id is empty.');

      logger.info(`Getting trade history for ${symbol} on account ${trade_account_id}`);
      
      const client = await BinanceFunctions.loadBinanceClient(trade_account_id);

      if (!client) throw new Error('client not found.');

      const result = await BinanceFunctions.getTradeHistory(client, symbol, 1000);

      res.json(result);
    } catch (error: any) {
      logger.error('Error getting Binance trade history', error);
      res.status(500).json({ error: error?.message || '' });
    }
  }

  public async currentPosition(req: Request, res: Response, _next: NextFunction) {
    try {


      const trade_account_id = req.params.trade_account_id;

      if (!trade_account_id) throw new Error('trade_account_id is empty.');

      logger.info(`Getting current positions on account ${trade_account_id}`);
      
      const client = await BinanceFunctions.loadBinanceClient(trade_account_id);

      if (!client) throw new Error('client not found.');

      const positions = await BinanceFunctions.currentPositions(client);

      const openOrders = await BinanceFunctions.getOpenOrders(client);

      // calculate stoploss and takeprofit amount for each position

      type ExtendedPosition = FuturesAccountPosition & { stoploss: string; takeprofit: string; stoplossAmount: number; takeprofitAmount: number };


      const extendedPositions: ExtendedPosition[] = positions.map((position) => {

        const stoploss = openOrders.find((order) => order.symbol === position.symbol && order.type === 'STOP_MARKET')?.stopPrice || '';
        const takeprofit = openOrders.find((order) => order.symbol === position.symbol && order.type === 'TAKE_PROFIT_MARKET')?.stopPrice || '';

        const size = parseFloat(position.positionAmt)

        const stoplossAmount = stoploss ? (parseFloat(position.entryPrice) * size) - (parseFloat(stoploss) * size) : 0;
        const takeprofitAmount = takeprofit ? (parseFloat(position.entryPrice) * size) - (parseFloat(takeprofit) * size) : 0;


        const extendedPosition: ExtendedPosition = {
          ...position,
          stoploss,
          takeprofit,
          stoplossAmount,
          takeprofitAmount,
        };

        return extendedPosition;
      });



      res.status(200).json({ positions: extendedPositions, openOrders });

    } catch (error: any) {
      logger.error('Error getting Binance current position', error);
      res.status(500).json({ error: error?.message || '' });
    }
  }

  

  public async openOrders(req: Request, res: Response, _next: NextFunction) {
    try {
      const trade_account_id = req.params.trade_account_id;

      if (!trade_account_id) throw new Error('trade_account_id is empty.');

      logger.info(`Getting open orders for account ${trade_account_id}`);
      
      const client = await BinanceFunctions.loadBinanceClient(trade_account_id);

      if (!client) throw new Error('client not found.');

      const result = await BinanceFunctions.getOpenOrders(client);

      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error getting Binance open orders', error);
      res.status(500).json({ error: error?.message || '' });
    }
  }

  public async getSnapshots(req: Request, res: Response, _next: NextFunction) {
    try {
      const startTime = parseFloat(req.query.startTime as string);
      const endTime = parseFloat(req.query.endTime as string);

      const trade_account_id = req.params.trade_account_id;

      if (!trade_account_id) throw new Error('trade_account_id is empty.');

      logger.info(`Getting snapshots for account ${trade_account_id} from ${startTime} to ${endTime}`);
      
      const client = await BinanceFunctions.loadBinanceClient(trade_account_id);

      if (!client) throw new Error('client not found.');

      const result = await BinanceFunctions.getSnapshot({ startTime, endTime, client });

      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error getting Binance snapshots', error);
      res.status(500).json({ error: error?.message || '' });
    }
  }
}

export default () => {
  const controller = new BinanceController();
  const router = Router();
  router.use(apiKeyMiddleware);

  router.post('/entry/:trade_account_id', controller.entry);
  router.get('/trade-history/:trade_account_id', controller.tradeHistory);
  router.get('/current-position/:trade_account_id', controller.currentPosition);
  router.get('/open-orders/:trade_account_id', controller.openOrders);
  router.get('/balance/:trade_account_id', controller.balance);
  router.get('/balance-v3/:trade_account_id', controller.balanceV3);
  router.get('/income/:trade_account_id', controller.income);
  router.get('/snapshot/:trade_account_id', controller.getSnapshots);

  return router;
};
