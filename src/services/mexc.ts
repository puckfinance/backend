import { MexcClient, MexcPosition, MexcBalance, MexcOrder, MexcContractInfo, MexcHistoryOrder, MexcHistoryPosition } from './mexc/client';
import moment from 'moment';
import { cache } from '../app';
import prisma from '../infrastructure/prisma';
import { CryptoService } from '../services/crypto';
import logger from '../utils/Logger';

export const loadMexcClient = async (tradeAccountId: string): Promise<MexcClient> => {
  const tradeAccount = await prisma.tradeAccount.findUnique({
    where: {
      id: tradeAccountId,
    },
  });

  if (!tradeAccount) throw new Error('tradeAccount not found.');

  const apiKey = CryptoService.decrypt(tradeAccount.apiKey);
  const secretKey = CryptoService.decrypt(tradeAccount.secretKey);

  logger.info('Connecting to MEXC');
  logger.info(`Environment: ${process.env.NODE_ENV}`);

  return new MexcClient(
    apiKey,
    secretKey,
    process.env.NODE_ENV === 'development',
  );
};

export const countDecimals = (num: number) => {
  if (Math.floor(num) === num) return 0;
  return num.toString().split('.')[1].length || 0;
};

export const convertToPrecision = (num: number, precision: number) => {
  return Math.trunc(num * Math.pow(10, precision)) / Math.pow(10, precision);
};

const checkConnection = async (client: MexcClient) => {
  return client.get<{ serverTime: number }>('/api/v1/contract/ping');
};

interface EntryProps {
  symbol: string;
  risk: number;
  risk_amount: number;
  entryPrice: number;
  side: 'BUY' | 'SELL';
  stoplossPrice: number;
  takeProfitPrice: number;
  client: MexcClient;
}

const getContractInfo = async (client: MexcClient, symbol: string): Promise<MexcContractInfo> => {
  const cacheKey = `mexc-contract-info-${symbol}`;
  const cached = cache.get(cacheKey) as MexcContractInfo | undefined;
  if (cached) return cached;

  const contracts = await client.get<MexcContractInfo[]>('/api/v1/contract/detail', { symbol });
  const contractInfo: MexcContractInfo = Array.isArray(contracts) ? contracts[0] : (contracts as any);

  cache.set(cacheKey, contractInfo, 60 * 60);
  return contractInfo;
};

const currentPositions = async (client: MexcClient, symbol?: string): Promise<MexcPosition[]> => {
  const positions = await client.get<MexcPosition[]>('/api/v1/private/position/open_positions');

  if (symbol) {
    return positions.filter((item) => item.symbol === symbol);
  }

  return positions;
};

const getCurrentBalance = async (client: MexcClient): Promise<MexcBalance | undefined> => {
  const assets = await client.get<MexcBalance[]>('/api/v1/private/account/assets');
  const balance = assets.find((item) => item.currency === (process.env.CURRENCY || 'USDT'));
  return balance;
};

const getCurrentBalanceV3 = async (client: MexcClient): Promise<MexcBalance[]> => {
  const assets = await client.get<MexcBalance[]>('/api/v1/private/account/assets');
  return assets;
};

const mapSide = (side: 'BUY' | 'SELL'): number => {
  return side === 'BUY' ? 1 : 3; // 1=open_long, 3=open_short
};

const mapCloseSide = (side: 'BUY' | 'SELL'): number => {
  return side === 'BUY' ? 2 : 4; // 2=close_long, 4=close_short
};

const entry = async ({
  symbol,
  entryPrice,
  risk,
  risk_amount,
  side,
  stoplossPrice,
  takeProfitPrice,
  client,
}: EntryProps) => {
  // Get contract info for precision
  const contractInfo = await getContractInfo(client, symbol);
  const { priceScale, volScale, contractSize } = contractInfo;

  // Get account balance
  const balance = await getCurrentBalance(client);
  if (!balance) throw new Error('balance is undefined.');

  // Check for existing position
  const positions = await currentPositions(client, symbol);
  const positionSide = side === 'BUY' ? 1 : 2; // 1=long, 2=short
  const existingPosition = positions.find((p) => p.type === positionSide);

  if (existingPosition) {
    console.log('Cancelled opening position');
    throw new Error('Currently in a trade.');
  }

  // Calculate position size
  const availableBalance = parseFloat(balance.availableBalance);
  const riskAmount = risk_amount || availableBalance * (risk / 100);
  const contractSizeNum = parseFloat(contractSize);
  const qty = convertToPrecision(riskAmount / Math.abs(entryPrice - stoplossPrice), volScale);

  // Calculate leverage
  let setLeverage = Math.ceil(((qty * entryPrice * contractSizeNum) / availableBalance) * 1.1);
  setLeverage = setLeverage === 0 ? 1 : setLeverage;

  console.log({ riskAmount, setLeverage, qty });

  // Set leverage
  await client.post('/api/v1/private/position/leverage', {
    symbol,
    leverage: setLeverage,
    openType: 1, // cross
  });

  console.log({
    qty,
    balance: balance.equity,
    leverage: setLeverage,
    price: entryPrice,
    volScale,
  });

  // Place market entry order
  const executedEntryOrder = await client.post<MexcOrder>('/api/v1/private/order/submit', {
    symbol,
    price: entryPrice.toString(),
    vol: qty.toString(),
    leverage: setLeverage,
    side: mapSide(side),
    type: 1, // market
    openType: 1, // cross
  });

  console.log('ENTRY', { executedEntryOrder });

  const currentQty = parseFloat(executedEntryOrder.vol || qty.toString());

  // Place stop-loss order
  let executedStoplossOrder: any = null;
  try {
    executedStoplossOrder = await client.post<MexcOrder>('/api/v1/private/order/stop_order', {
      symbol,
      price: convertToPrecision(stoplossPrice, priceScale).toString(),
      vol: currentQty.toString(),
      side: mapCloseSide(side),
      type: 3, // stop
      triggerPrice: convertToPrecision(stoplossPrice, priceScale).toString(),
      triggerType: 1, // deal price
      executeCycle: 1,
      executeDirection: side === 'BUY' ? 2 : 1,
    });
    console.log('STOPLOSS', { executedStoplossOrder });
  } catch (error) {
    console.error('Stop loss failed:', error);
  }

  // Place take-profit order
  let executedTakeProfitOrder: any = null;
  try {
    executedTakeProfitOrder = await client.post<MexcOrder>('/api/v1/private/order/stop_order', {
      symbol,
      price: convertToPrecision(takeProfitPrice, priceScale).toString(),
      vol: currentQty.toString(),
      side: mapCloseSide(side),
      type: 5, // take_profit
      triggerPrice: convertToPrecision(takeProfitPrice, priceScale).toString(),
      triggerType: 1, // deal price
      executeCycle: 1,
      executeDirection: side === 'BUY' ? 2 : 1,
    });
    console.log('TAKEPROFIT', { executedTakeProfitOrder });
  } catch (error) {
    console.error('Take profit failed:', error);
  }

  // If stop loss failed, close position immediately
  if (!executedStoplossOrder) {
    await client.post<MexcOrder>('/api/v1/private/order/submit', {
      symbol,
      price: entryPrice.toString(),
      vol: currentQty.toString(),
      leverage: setLeverage,
      side: mapCloseSide(side),
      type: 1, // market
      openType: 1,
    });
  }

  return {
    success: true,
    entry: entryPrice,
    stoploss: stoplossPrice,
    takeprofit: takeProfitPrice,
    qty: currentQty,
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
  side: 'BUY' | 'SELL';
  client: MexcClient;
}) => {
  const contractInfo = await getContractInfo(client, symbol);
  const { priceScale } = contractInfo;

  // Get current position
  const positionSide = side === 'BUY' ? 1 : 2;
  const positions = await currentPositions(client, symbol);
  const currentPosition = positions.find((p) => p.type === positionSide);

  if (!currentPosition) throw new Error('currentPosition is undefined.');

  const currentQty = parseFloat(currentPosition.holdVolume.toString());

  // Cancel existing stop orders for this symbol
  try {
    const openOrders = await client.get<MexcOrder[]>('/api/v1/private/order/list/open_orders', { symbol });
    const stopOrders = openOrders.filter((o) => o.type === 3); // type 3 = stop

    for (const order of stopOrders) {
      try {
        await client.delete(`/api/v1/private/order/cancel`, { orderId: order.id });
      } catch (e) {
        console.error('Failed to cancel stop order:', e);
      }
    }
  } catch (e) {
    console.error('Failed to fetch open orders for SL cancel:', e);
  }

  // Place new stop-loss order
  try {
    const executedStopLossOrder = await client.post<MexcOrder>('/api/v1/private/order/stop_order', {
      symbol,
      price: convertToPrecision(price, priceScale).toString(),
      vol: currentQty.toString(),
      side: mapCloseSide(side),
      type: 3, // stop
      triggerPrice: convertToPrecision(price, priceScale).toString(),
      triggerType: 1,
      executeCycle: 1,
      executeDirection: side === 'BUY' ? 2 : 1,
    });

    console.log('MOVE STOPLOSS');
    console.log({ executedStopLossOrder });
    console.log('--------');
  } catch (error) {
    console.error(error);
  }
};

const getPosition = async (symbol: string, client: MexcClient) => {
  const positions = await currentPositions(client, symbol);
  return positions[0] || undefined;
};

const getTradeHistory = async (
  client: MexcClient,
  symbol: string,
  limit: number,
  startTime?: number,
  endTime?: number,
) => {
  if (!startTime) startTime = moment().subtract(7, 'day').unix() * 1000;
  if (!endTime) endTime = moment().unix() * 1000;

  const result = await client.get<MexcHistoryOrder[]>('/api/v1/private/order/list/history_orders', {
    symbol,
    page_num: 1,
    page_size: limit,
    ...(startTime && { start_time: startTime }),
    ...(endTime && { end_time: endTime }),
  });

  return result;
};

const getIncome = async (
  client: MexcClient,
  options?: {
    symbol?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  },
  cacheId?: string,
) => {
  const startTime = options?.startTime || moment().endOf('day').subtract(3, 'month').unix() * 1000;
  const endTime = options?.endTime || moment().endOf('day').unix() * 1000;

  const cacheKey = [
    cacheId || 'mexc',
    'income',
    options?.symbol || 'all',
    startTime,
    endTime,
  ].join('-');

  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  const result = await client.get<MexcHistoryPosition[]>('/api/v1/private/position/history_positions', {
    ...(options?.symbol && { symbol: options.symbol }),
    start_time: startTime,
    end_time: endTime,
    page_num: 1,
    page_size: options?.limit || 100,
  });

  cache.set(cacheKey, result, 60 * 5);
  return result;
};

const getOpenOrders = async (client: MexcClient, symbol?: string) => {
  const params: Record<string, any> = {};
  if (symbol) params.symbol = symbol;

  const orders = await client.get<MexcOrder[]>('/api/v1/private/order/list/open_orders', params);
  return orders;
};

const MexcFunctions = {
  checkConnection,
  currentPositions,
  entry,
  getPosition,
  setStoploss,
  getCurrentBalance,
  getCurrentBalanceV3,
  getTradeHistory,
  getOpenOrders,
  getIncome,
  loadMexcClient,
  getContractInfo,
};

export default MexcFunctions;
