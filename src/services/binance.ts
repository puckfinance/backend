import Binance, { NewFuturesOrder, OrderSide_LT } from 'binance-api-node';

import * as moment from 'moment';
import { cache } from '../app';

const config = {
  apiKey: process.env.BINANCE_API_KEY,
  apiSecret: process.env.BINANCE_SECRET_KEY,
  getTime: () => moment().unix() * 1000,
  ...(process.env.NODE_ENV === 'development' && {
    httpFutures: 'https://testnet.binancefuture.com',
    wsFutures: 'wss://stream.binancefuture.com',
  }),
};

console.log({ config });

export const binanceClient = Binance(config);

const countDecimals = (num: number) => {
  if (Math.floor(num) === num) return 0;
  return num.toString().split('.')[1].length || 0;
};

const convertToPrecision = (num: number, precision: number) => {
  return Math.trunc(num * Math.pow(10, precision)) / Math.pow(10, precision);
};

const checkConnection = () => {
  return binanceClient.ping();
};

const currentPositions = async (symbol: string) => {
  const accountInfo = await binanceClient.futuresAccountInfo();

  const positions = accountInfo.positions.filter((item) => parseFloat(item.entryPrice) > 0 && item.symbol === symbol);
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
}

const entry = async ({
  symbol,
  entryPrice,
  partialProfits,
  risk,
  risk_amount,
  side,
  stoplossPrice,
  takeProfitPrice,
}: EntryProps) => {
  /* no entry on current position */
  const positions = await currentPositions(symbol);

  if (positions.length > 0) {
    console.log('Cancelled opening position');
    throw new Error('Currently in a trade.');
  }

  const balances = await binanceClient.futuresAccountBalance();

  const balance = balances.find((item) => item.asset === process.env.CURRENCY);

  /* get precisions */
  const info = await binanceClient.futuresExchangeInfo();

  const symbolInfo = info.symbols.find((item) => item.symbol === symbol);

  const { quantityPrecision } = symbolInfo as unknown as Symbol & {
    pricePrecision: number;
    quantityPrecision: number;
  };

  if (!symbolInfo) throw new Error('symbol info is undefined');

  const priceFilter = symbolInfo.filters.find((item) => item.filterType === 'PRICE_FILTER');

  const tickSize = countDecimals(parseFloat((priceFilter as any).tickSize as string));

  if (!balance) throw new Error('balance is undefined.');

  const trade = await binanceClient.futuresTrades({
    symbol: symbol,
    limit: 1,
  });

  const currentPrice = parseFloat(trade[0].price);

  const riskAmount = risk_amount || parseFloat(balance.balance) * (risk / 100);

  const qty = convertToPrecision(riskAmount / Math.abs(entryPrice - stoplossPrice), quantityPrecision);

  let setLeverage = Math.ceil(((qty * currentPrice) / parseFloat(balance.availableBalance)) * 1.1);

  // leverage cannot be 0 so update to 1
  setLeverage = setLeverage === 0 ? 1 : setLeverage;

  console.log({ riskAmount, setLeverage, qty });

  const leverage = await binanceClient.futuresLeverage({
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

  const entryOrder: NewFuturesOrder = {
    symbol: symbol,
    type: 'MARKET',
    side,
    quantity: `${qty}`,
  };

  // entry
  let origQty: number = 0;
  const executedEntryOrder = await binanceClient.futuresOrder(entryOrder);

  console.log(`ENTRY`);
  console.log({ executedEntryOrder });

  origQty = parseFloat(executedEntryOrder.origQty);

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

  let executedStoplossOrder;

  try {
    executedStoplossOrder = await binanceClient.futuresOrder(stopLossOrder);

    console.log(`STOPLOSS`);
    console.log({ executedStoplossOrder });
  } catch (error) {
    console.error(error);
  }

  // takeprofit

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

  let executedTakeProfitOrder;

  try {
    executedTakeProfitOrder = await binanceClient.futuresOrder(takeProfitOrder);
    console.log(`TAKEPROFIT`);
    console.log({ executedTakeProfitOrder });
  } catch (error) {
    console.error(error);
  }

  const previousQtys: number[] = [];

  partialProfits?.forEach(async (item) => {
    const price = entryPrice + ((side === 'BUY' ? takeProfitPrice : -takeProfitPrice) - entryPrice) * item.where;

    let qty = convertToPrecision(currentQty * item.qty, quantityPrecision);

    if (item.where === 1) {
      /* to remove any left size in open orders */
      qty = convertToPrecision(origQty - previousQtys.reduce((acc, cur) => acc + cur, 0), quantityPrecision);
    } else {
      previousQtys.push(qty);
    }

    const takeProfitOrder = {
      symbol: symbol,
      price: convertToPrecision(price, tickSize) as any,
      type: 'LIMIT',
      side: side === 'BUY' ? 'SELL' : 'BUY',
      quantity: `${qty}`,
    };

    try {
      const executedTakeProfitOrder = await binanceClient.futuresOrder(takeProfitOrder as any);

      console.log(`TAKEPROFIT ${item.where} - ${item.qty}`);
      console.log({ executedTakeProfitOrder });
      console.log('--------');
    } catch (error) {
      console.error(error);
    }
  });

  return {
    success: true,
    entry: price,
    stoploss: executedStoplossOrder?.stopPrice,
    takeprofit: executedTakeProfitOrder?.stopPrice,
    qty: executedEntryOrder.origQty,
  };
};

const setStoploss = async ({ symbol, price, side }: { symbol: string; price: number; side: OrderSide_LT }) => {
  /* get precisions */
  const info = await binanceClient.futuresExchangeInfo();
  const symbolInfo = info.symbols.find((item) => item.symbol === symbol);

  if (!symbolInfo) throw new Error('symbolInfo is undefined.');

  const priceFilter = symbolInfo.filters.find((item) => item.filterType === 'PRICE_FILTER');
  const tickSize = countDecimals(parseFloat((priceFilter as any).tickSize as string));

  const currentPosition = await getPosition(symbol);

  if (!currentPosition) throw new Error('currentPosition is undefined.');

  const currentQty = Math.abs(parseFloat(currentPosition.positionAmt));

  if (!price) throw new Error('price is undefined.');

  // remove previous stop market orders

  // list previous orders
  const orders = await binanceClient.futuresOpenOrders({ symbol });
  // cancel orders
  const orderIdList = orders?.flatMap(({ orderId, origType }) => {
    if (origType === 'STOP_MARKET') return orderId;
    return [];
  });

  console.log({ orderIdList, string: JSON.stringify(orderIdList) });

  if (Array.isArray(orderIdList) && orderIdList.length > 0)
    await binanceClient.futuresCancelBatchOrders({ symbol, orderIdList: JSON.stringify(orderIdList) });

  const stopLossOrder: NewFuturesOrder = {
    symbol: symbol,
    stopPrice: convertToPrecision(price, tickSize) as any,
    closePosition: 'true',
    type: 'STOP_MARKET',
    side: side === 'BUY' ? 'SELL' : 'BUY',
    quantity: `${currentQty}`,
  };

  try {
    const executedStopLossOrder = await binanceClient.futuresOrder(stopLossOrder);

    console.log('MOVE STOPLOSS');
    console.log({ executedStopLossOrder });
    console.log('--------');
  } catch (error) {
    console.error(error);
  }
};

const getPosition = async (symbol: string) => {
  console.log({ symbol });

  const positions = await currentPositions(symbol);

  return positions.find((item) => item.symbol === symbol) || undefined;
};

const getCurrentBalance = async () => {
  const balances = await binanceClient.futuresAccountBalance();
  const balance = balances.find((item) => item.asset === process.env.CURRENCY);
  return balance;
};

const getTradeHistory = async (symbol: string, limit: number) => {
  const trade = await binanceClient.futuresUserTrades({
    symbol,
    limit,
  });

  return trade.flatMap((each) => {
    if (parseFloat(each.realizedPnl) === 0) return [];

    return each;
  });
};

const getIncome = async () => {
  const result = await binanceClient.futuresIncome({
    incomeType: 'REALIZED_PNL',
    limit: 1000,
  });

  return result;
};

const getOpenOrders = async () => {
  const orders = await binanceClient.futuresOpenOrders({});
  return orders;
};

const getPnl = async () => {
  const orders = await binanceClient.futuresIncome({
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
}: {
  startTime: number;
  endTime: number;
}) => {
  const cacheKey = ['snapshot', startTime, endTime].join('-');

  const cacheData = cache.get(cacheKey);

  if (cacheData) return cacheData;

  const snapshots = await binanceClient.accountSnapshot({
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
  entry,
  getPnl,
  getPosition,
  setStoploss,
  getCurrentBalance,
  getTradeHistory,
  getOpenOrders,
  getIncome,
  getSnapshot,
};

export default BinanceFunctions;
