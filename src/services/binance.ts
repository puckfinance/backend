import Binance, { Binance as BinanceType, FuturesIncomeType, NewFuturesOrder, OrderSide_LT } from 'binance-api-node';

import moment from 'moment';
import { cache } from '../app';
import prisma from '../infrastructure/prisma';
import { CryptoService } from './crypto';
import logger from '../utils/Logger';

export const loadBinanceClient = async (tradeAccountId: string): Promise<BinanceType> => {
  const tradeAccount = await prisma.tradeAccount.findUnique({
    where: {
      id: tradeAccountId,
    },
  });

  if (!tradeAccount) throw new Error('tradeAccount not found.');

  // decrypt keys
  const apiKey = CryptoService.decrypt(tradeAccount.apiKey);
  const secretKey = CryptoService.decrypt(tradeAccount.secretKey);

  logger.info('Connecting to Binance');
  logger.info(`Environment: ${process.env.NODE_ENV}`);

  return Binance({
    apiKey: apiKey,
    apiSecret: secretKey,
    getTime: () => moment().unix() * 1000,
    ...(process.env.NODE_ENV === 'development' && {
      httpFutures: 'https://testnet.binancefuture.com',
      wsFutures: 'wss://stream.binancefuture.com',
    }),
  });
};

export const countDecimals = (num: number) => {
  if (Math.floor(num) === num) return 0;
  return num.toString().split('.')[1].length || 0;
};

export const convertToPrecision = (num: number, precision: number) => {
  return Math.trunc(num * Math.pow(10, precision)) / Math.pow(10, precision);
};

const checkConnection = (client: BinanceType) => {
  return client.ping();
};

const currentPositions = async (client: BinanceType, symbol?: string) => {
  const accountInfo = await client.futuresAccountInfo();

  const positions = accountInfo.positions.filter((item) => parseFloat(item.entryPrice) > 0);

  if (symbol) {
    return positions.filter((item) => item.symbol === symbol);
  }

  return positions;
};

interface EntryProps {
  symbol: string;
  risk: number;
  risk_amount: number;
  entryPrice: number;
  side: OrderSide_LT;
  stoplossPrice: number;
  takeProfitPrice: number;
  partialProfits?: {
    where: number;
    qty: number;
  }[];
  client: BinanceType;
}

const getTradeEntryInformationOptimized = async ({
  symbol,
  risk_amount,
  risk,
  entryPrice,
  stoplossPrice,
  client,
}: Pick<EntryProps, 'symbol' | 'risk' | 'risk_amount' | 'entryPrice' | 'stoplossPrice' | 'client'>): Promise<{
  qty: number;
  tickSize: number;
  quantityPrecision: number;
}> => {
  // Cache exchange info for 1 hour (it rarely changes)
  const cacheKey = `exchange-info-${symbol}`;
  let cachedExchangeInfo = cache.get(cacheKey);

  // Parallelize independent API calls
  const [accountInfo, balances, trades] = await Promise.all([
    client.futuresAccountInfo(),
    client.futuresAccountBalance(),
    client.futuresTrades({ symbol, limit: 1 }),
  ]);

  // Fetch exchange info if not cached
  let exchangeInfo = cachedExchangeInfo;
  if (!cachedExchangeInfo) {
    exchangeInfo = await client.futuresExchangeInfo();
    cache.set(cacheKey, exchangeInfo, 60 * 60); // Cache for 1 hour
  }

  // Check positions from account info
  const positions = accountInfo.positions.filter(
    (item: any) => parseFloat(item.entryPrice) > 0 && item.symbol === symbol,
  );

  if (positions.length > 0) {
    console.log('Cancelled opening position');
    throw new Error('Currently in a trade.');
  }

  const balance = balances.find((item: any) => item.asset === process.env.CURRENCY);
  const symbolInfo = (exchangeInfo as any).symbols.find((item: any) => item.symbol === symbol);

  const { quantityPrecision } = symbolInfo as unknown as Symbol & {
    pricePrecision: number;
    quantityPrecision: number;
  };

  if (!symbolInfo) throw new Error('symbol info is undefined');

  const priceFilter = symbolInfo.filters.find((item: any) => item.filterType === 'PRICE_FILTER');
  const tickSize = countDecimals(parseFloat((priceFilter as any).tickSize as string));

  if (!balance) throw new Error('balance is undefined.');

  const currentPrice = parseFloat(trades[0].price);
  const riskAmount = risk_amount || parseFloat(balance.balance) * (risk / 100);
  const qty = convertToPrecision(riskAmount / Math.abs(entryPrice - stoplossPrice), quantityPrecision);

  let setLeverage = Math.ceil(((qty * currentPrice) / parseFloat(balance.availableBalance)) * 1.1);
  setLeverage = setLeverage === 0 ? 1 : setLeverage;

  console.log({ riskAmount, setLeverage, qty });

  // Set leverage (this has to be done before placing orders)
  const leverage = await client.futuresLeverage({
    symbol: symbol,
    leverage: setLeverage,
  });

  console.log({
    qty,
    balance: balance.balance,
    leverage: leverage.leverage,
    price: currentPrice,
    quantityPrecision,
  });

  return { qty, tickSize, quantityPrecision };
};

const entryOptimized = async ({
  symbol,
  entryPrice,
  partialProfits,
  risk,
  risk_amount,
  side,
  stoplossPrice,
  takeProfitPrice,
  client,
}: EntryProps) => {
  const { qty, tickSize, quantityPrecision } = await getTradeEntryInformationOptimized({
    symbol,
    risk,
    risk_amount,
    entryPrice,
    stoplossPrice,
    client,
  });

  const entryOrder: NewFuturesOrder = {
    symbol: symbol,
    type: 'MARKET',
    side,
    quantity: `${qty}`,
  };

  // Execute entry order first (critical timing)
  const executedEntryOrder = await client.futuresOrder(entryOrder);
  console.log(`ENTRY`, { executedEntryOrder });

  const origQty = parseFloat(executedEntryOrder.origQty);
  const currentQty = Math.abs(origQty);

  // Prepare all protection orders
  const stopLossOrder: NewFuturesOrder = {
    symbol: symbol,
    stopPrice: convertToPrecision(stoplossPrice, tickSize) as any,
    closePosition: 'true',
    type: 'STOP_MARKET',
    side: side === 'BUY' ? 'SELL' : 'BUY',
    quantity: `${currentQty}`,
    workingType: 'CONTRACT_PRICE',
  };

  const takeProfitOrder: NewFuturesOrder = {
    symbol: symbol,
    price: convertToPrecision(takeProfitPrice, tickSize) as any,
    type: 'LIMIT',
    side: side === 'BUY' ? 'SELL' : 'BUY',
    quantity: `${currentQty}`,
    timeInForce:'GTX' as any ,
    reduceOnly: 'true',
  };

  // Prepare partial profit orders
  const partialProfitOrders: NewFuturesOrder[] = [];
  const previousQtys: number[] = [];

  if (partialProfits) {
    partialProfits.forEach((item) => {
      const price = entryPrice + ((side === 'BUY' ? takeProfitPrice : -takeProfitPrice) - entryPrice) * item.where;

      let qty = convertToPrecision(currentQty * item.qty, quantityPrecision);

      if (item.where === 1) {
        qty = convertToPrecision(origQty - previousQtys.reduce((acc, cur) => acc + cur, 0), quantityPrecision);
      } else {
        previousQtys.push(qty);
      }

      partialProfitOrders.push({
        symbol: symbol,
        price: convertToPrecision(price, tickSize) as any,
        type: 'LIMIT',
        side: side === 'BUY' ? 'SELL' : 'BUY',
        quantity: `${qty}`,
        timeInForce: 'GTC',
      });
    });
  }

  // Execute all protection orders in parallel
  const orderPromises = [
    client.futuresOrder(stopLossOrder).catch((error) => {
      console.error('Stop loss failed:', error);
      return null;
    }),
    client.futuresOrder(takeProfitOrder).catch((error) => {
      console.error('Take profit failed:', error);
      return null;
    }),
    // Execute partial profits in parallel
    ...partialProfitOrders.map((order) =>
      client.futuresOrder(order).catch((error) => {
        console.error('Partial profit failed:', error);
        return null;
      }),
    ),
  ];

  const [executedStoplossOrder, executedTakeProfitOrder, ...executedPartialProfits] = await Promise.all(orderPromises);

  // Log results
  console.log(`STOPLOSS`, { executedStoplossOrder });
  console.log(`TAKEPROFIT`, { executedTakeProfitOrder });
  executedPartialProfits.forEach((order, index) => {
    if (order) {
      console.log(`PARTIAL PROFIT ${index + 1}`, { order });
    }
  });

  // If stop loss failed, close position immediately
  if (!executedStoplossOrder) {
    const closeOrder: NewFuturesOrder = {
      symbol: symbol,
      type: 'MARKET',
      side: side === 'BUY' ? 'SELL' : 'BUY',
      quantity: `${qty}`,
    };
    await client.futuresOrder(closeOrder);
  }

  if (!executedTakeProfitOrder) {
     const takeProfitOrder: NewFuturesOrder = {
       symbol: symbol,
       price: convertToPrecision(takeProfitPrice, tickSize) as any,
       type: 'LIMIT',
       side: side === 'BUY' ? 'SELL' : 'BUY',
       quantity: `${currentQty}`,
       timeInForce: 'GTC',
       reduceOnly: 'true',
     };
    await client.futuresOrder(takeProfitOrder);
  }

  return {
    success: true,
    entry: entryPrice,
    stoploss: executedStoplossOrder?.stopPrice,
    takeprofit: executedTakeProfitOrder?.stopPrice,
    qty: executedEntryOrder.origQty,
    partialProfits: executedPartialProfits.filter(Boolean),
  };
};

const entryLimit = async ({
  symbol,
  entryPrice,
  risk,
  risk_amount,
  side,
  stoplossPrice,
  takeProfitPrice,
  client,
}: EntryProps) => {
  const { qty, tickSize } = await getTradeEntryInformationOptimized({
    symbol,
    risk,
    risk_amount,
    entryPrice,
    stoplossPrice,
    client,
  });

  const entryOrder: NewFuturesOrder = {
    symbol: symbol,
    type: 'LIMIT',
    side,
    quantity: `${qty}`,
    timeInForce: 'GTC',
    price: `${convertToPrecision(entryPrice, tickSize)}`,
  };

  // entry
  let origQty: number = 0;

  console.log(`ENTRY`);

  // stoploss
  let price = stoplossPrice;

  const currentQty = Math.abs(origQty);

  const stopLossOrder: NewFuturesOrder = {
    symbol: symbol,
    stopPrice: convertToPrecision(price, tickSize) as any,
    closePosition: 'true',
    type: 'STOP_MARKET',
    side: side === 'BUY' ? 'SELL' : 'BUY',
    quantity: `${currentQty}`,
    workingType: 'CONTRACT_PRICE',
  };

  // set take_profit order
  price = takeProfitPrice;

  const takeProfitOrder: NewFuturesOrder = {
    symbol: symbol,
    stopPrice: convertToPrecision(price, tickSize) as any,
    closePosition: 'true',
    type: 'TAKE_PROFIT_MARKET',
    side: side === 'BUY' ? 'SELL' : 'BUY',
    quantity: `${currentQty}`,
  };

  const executedOrders = await client.futuresBatchOrders({
    batchOrders: [entryOrder, stopLossOrder, takeProfitOrder],
  });

  return {
    success: true,
    executedOrders,
    qty: executedOrders[0].origQty,
  };
};

const setStoploss = async ({
  symbol,
  price,
  side,
  client,
}: {
  symbol: string;
  price: number;
  side: OrderSide_LT;
  client: BinanceType;
}) => {
  /* get precisions */
  const info = await client.futuresExchangeInfo();
  const symbolInfo = info.symbols.find((item) => item.symbol === symbol);

  if (!symbolInfo) throw new Error('symbolInfo is undefined.');

  const priceFilter = symbolInfo.filters.find((item) => item.filterType === 'PRICE_FILTER');
  const tickSize = countDecimals(parseFloat((priceFilter as any).tickSize as string));

  const currentPosition = await getPosition(symbol, client);

  if (!currentPosition) throw new Error('currentPosition is undefined.');

  const currentQty = Math.abs(parseFloat(currentPosition.positionAmt));

  if (!price) throw new Error('price is undefined.');

  // remove previous stop market orders

  // list previous orders
  const orders = await client.futuresOpenOrders({ symbol });
  // cancel orders
  const orderIdList = orders?.flatMap(({ orderId, origType }) => {
    if (origType === 'STOP_MARKET') return orderId;
    return [];
  });

  console.log({ orderIdList, string: JSON.stringify(orderIdList) });

  if (Array.isArray(orderIdList) && orderIdList.length > 0)
    await client.futuresCancelBatchOrders({ symbol, orderIdList: JSON.stringify(orderIdList) });

  const stopLossOrder: NewFuturesOrder = {
    symbol: symbol,
    stopPrice: convertToPrecision(price, tickSize) as any,
    closePosition: 'true',
    type: 'STOP_MARKET',
    side: side === 'BUY' ? 'SELL' : 'BUY',
    quantity: `${currentQty}`,
  };

  try {
    const executedStopLossOrder = await client.futuresOrder(stopLossOrder);

    console.log('MOVE STOPLOSS');
    console.log({ executedStopLossOrder });
    console.log('--------');
  } catch (error) {
    console.error(error);
  }
};

const getPosition = async (symbol: string, client: BinanceType) => {
  console.log({ symbol });

  const positions = await currentPositions(client, symbol);

  return positions.find((item) => item.symbol === symbol) || undefined;
};

const getCurrentBalance = async (client: BinanceType) => {
  const balances = await client.futuresAccountBalance();
  const balance = balances.find((item) => item.asset === process.env.CURRENCY);
  return balance;
};

const getCurrentBalanceV3 = async (client: BinanceType) => {
  const balances = await client.futuresAccountBalance();
  return balances;
};

const getTradeHistory = async (
  client: BinanceType,
  symbol: string,
  limit: number,
  startTime?: number,
  endTime?: number,
) => {
  // default last 3 months
  if (!startTime) startTime = moment().subtract(7, 'day').unix() * 1000;
  if (!endTime) endTime = moment().unix() * 1000;

  const trade = await client.futuresUserTrades({
    symbol,
    limit,
    ...(startTime && { startTime }),
    ...(endTime && { endTime }),
  });

  return trade.flatMap((each) => {
    if (parseFloat(each.realizedPnl) === 0) return [];

    return each;
  });
};

const getIncome = async (
  client: BinanceType,
  options?: {
    symbol?: string;
    incomeType?: FuturesIncomeType;
    startTime?: number;
    endTime?: number;
    limit?: number;
  },
  cacheId?: string,
) => {
  // default last 3 months
  const startTime = options?.startTime || moment().endOf('day').subtract(3, 'month').unix() * 1000;
  const endTime = options?.endTime || moment().endOf('day').unix() * 1000;
  const limit = options?.limit || 1000;

  // Create cache key based on all parameters that affect the result
  const cacheKey = [
    cacheId || client.accountInfo.name,
    'income',
    options?.symbol || 'all',
    options?.incomeType || 'all',
    startTime,
    endTime,
    limit,
  ].join('-');

  // Check cache first
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  const result = await client.futuresIncome({
    ...options,
    startTime,
    endTime,
    limit,
  });

  // Cache for 5 minutes (300 seconds)
  cache.set(cacheKey, result, 60 * 5);

  return result;
};

const getOpenOrders = async (client: BinanceType) => {
  const orders = await client.futuresOpenOrders({});
  return orders;
};

const getPnl = async (client: BinanceType) => {
  const orders = await client.futuresIncome({
    symbol: process.env.TRADE_PAIR,
    startTime: moment().subtract(3, 'month').unix() * 1000,
    endTime: moment().unix() * 1000,
    limit: 1000,
    incomeType: 'REALIZED_PNL',
  });
  return orders;
};

const getSnapshot = async ({
  startTime = moment().subtract(1, 'month').unix() * 1000,
  endTime = moment().unix() * 1000,
  client,
}: {
  startTime: number;
  endTime: number;
  client: BinanceType;
}) => {
  const cacheKey = ['snapshot', startTime, endTime].join('-');

  const cacheData = cache.get(cacheKey);

  if (cacheData) return cacheData;

  const snapshots = await client.accountSnapshot({
    type: 'FUTURES',
    startTime,
    endTime,
    limit: 30,
  });

  cache.set(cacheKey, snapshots, 60 * 60 * 24);

  return snapshots;
};

const BinanceFunctions = {
  checkConnection,
  currentPositions,
  entry: entryOptimized, // Use optimized version as default
  entryOptimized,
  entryLimit,
  getPnl,
  getPosition,
  setStoploss,
  getCurrentBalance,
  getTradeHistory,
  getOpenOrders,
  getIncome,
  getSnapshot,
  loadBinanceClient,
  getCurrentBalanceV3,
};

export default BinanceFunctions;
