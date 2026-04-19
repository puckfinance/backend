import { MexcClient, MexcPosition, MexcBalance, MexcOrder, MexcContractInfo, MexcHistoryPosition } from './mexc/client';
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

    return new MexcClient(apiKey, secretKey);
};

export const countDecimals = (num: number) => {
    if (Math.floor(num) === num) return 0;
    return num.toString().split('.')[1].length || 0;
};

export const convertToPrecision = (num: number, precision: number) => {
    return Math.trunc(num * Math.pow(10, precision)) / Math.pow(10, precision);
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

    const result = await client.get<any>('/api/v1/contract/detail', { symbol });
    const contractInfo: MexcContractInfo = Array.isArray(result) ? result[0] : result;

    cache.set(cacheKey, contractInfo, 60 * 60);
    return contractInfo;
};

const currentPositions = async (client: MexcClient, symbol?: string): Promise<MexcPosition[]> => {
    const params: Record<string, any> = {};
    if (symbol) params.symbol = symbol;

    const positions = await client.get<MexcPosition[]>('/api/v1/private/position/open_positions', params);

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
    const contractInfo = await getContractInfo(client, symbol);
    const { priceScale, volScale, contractSize } = contractInfo;

    const balance = await getCurrentBalance(client);
    if (!balance) throw new Error('balance is undefined.');

    const positions = await currentPositions(client, symbol);
    const positionSide = side === 'BUY' ? 1 : 2;
    const existingPosition = positions.find((p) => p.positionType === positionSide);

    if (existingPosition) {
        console.log('Cancelled opening position');
        throw new Error('Currently in a trade.');
    }

    const availableBalance = Number(balance.availableBalance);
    const riskAmount = risk_amount || availableBalance * (risk / 100);
    const contractSizeNum = parseFloat(contractSize);
    const qty = convertToPrecision((riskAmount / Math.abs(entryPrice - stoplossPrice)) / contractSizeNum, volScale);

    let setLeverage = Math.ceil(((qty * entryPrice * contractSizeNum) / availableBalance) * 1.1);
    setLeverage = setLeverage === 0 ? 1 : setLeverage;

    console.log({ riskAmount, setLeverage, qty });

    // Set leverage using change_leverage endpoint
    await client.post('/api/v1/private/position/change_leverage', {
        symbol,
        leverage: setLeverage,
        openType: 2,
        positionType: side === 'BUY' ? 1 : 2,
    });

    console.log({
        qty,
        balance: balance.equity,
        leverage: setLeverage,
        price: entryPrice,
        volScale,
    });

    // Place market entry order
    const executedEntryOrder = await client.post<any>('/api/v1/private/order/create', {
        symbol,
        price: entryPrice.toString(),
        vol: qty.toString(),
        leverage: setLeverage,
        side: mapSide(side),
        type: 5, // market
        openType: 2, // cross
    });

    console.log('ENTRY', { executedEntryOrder });

    // Get the newly opened position to retrieve positionId for TP/SL
    const openPositions = await currentPositions(client, symbol);
    const targetPositionSide = side === 'BUY' ? 1 : 2;
    const newPosition = openPositions.find((p) => p.positionType === targetPositionSide);

    if (newPosition) {
        try {
            await client.post('/api/v1/private/stoporder/place', {
                positionId: newPosition.positionId,
                vol: newPosition.holdVol,
                lossTrend: 1,
                profitTrend: 1,
                stopLossPrice: convertToPrecision(stoplossPrice, priceScale).toString(),
                takeProfitPrice: convertToPrecision(takeProfitPrice, priceScale).toString(),
                stopLossType: 0,
                takeProfitType: 0,
                stopLossOrderPrice: convertToPrecision(stoplossPrice, priceScale).toString(),
                takeProfitOrderPrice: convertToPrecision(takeProfitPrice, priceScale).toString(),
            });
            console.log('TP/SL placed via stoporder');
        } catch (error) {
            console.error('Failed to place TP/SL:', error);
        }
    }

    return {
        success: true,
        entry: entryPrice,
        stoploss: stoplossPrice,
        takeprofit: takeProfitPrice,
        qty,
    };
};

const setStoploss = async ({
    symbol,
    price,
    side: _side,
    client,
}: {
    symbol: string;
    price: number;
    side: 'BUY' | 'SELL';
    client: MexcClient;
}) => {
    const contractInfo = await getContractInfo(client, symbol);
    const { priceScale } = contractInfo;

    const positions = await currentPositions(client, symbol);
    const currentPosition = positions[0];

    if (!currentPosition) throw new Error('currentPosition is undefined.');

    // Get existing TP price to preserve it
    let existingTP = '';
    try {
        const stopOrders = await getStopOrders(client, symbol);
        const existing = stopOrders.find(
            (o) => String(o.positionId) === String(currentPosition.positionId),
        );
        if (existing?.takeProfitPrice) {
            existingTP = existing.takeProfitPrice.toString();
        }
    } catch (e) {
        console.error('Failed to fetch existing stop orders:', e);
    }

    // Cancel existing TP/SL orders for this position
    try {
        await client.post('/api/v1/private/stoporder/cancel_all', { positionId: currentPosition.positionId });
    } catch (e) {
        console.error('Failed to cancel existing stop orders:', e);
    }

    // Place new SL with preserved TP
    try {
        const params: Record<string, any> = {
            positionId: currentPosition.positionId,
            vol: currentPosition.holdVol,
            lossTrend: 1,
            profitTrend: 1,
            stopLossPrice: convertToPrecision(price, priceScale).toString(),
            stopLossType: 0,
            stopLossOrderPrice: convertToPrecision(price, priceScale).toString(),
        };

        if (existingTP) {
            params.takeProfitPrice = convertToPrecision(parseFloat(existingTP), priceScale).toString();
            params.takeProfitType = 0;
            params.takeProfitOrderPrice = convertToPrecision(parseFloat(existingTP), priceScale).toString();
        }

        await client.post('/api/v1/private/stoporder/place', params);

        console.log('MOVE STOPLOSS to', price, 'TP preserved:', existingTP || 'none');
    } catch (error) {
        console.error(error);
        throw error;
    }
};

const getPosition = async (symbol: string, client: MexcClient) => {
    const positions = await currentPositions(client, symbol);
    return positions[0] || undefined;
};

interface MexcHistoryOrder {
    orderId: string;
    symbol: string;
    price: number;
    vol: number;
    dealVol: number;
    dealAvgPrice: number;
    side: number;
    orderType: number;
    openType: number;
    leverage: number;
    profit: number;
    fee: number;
    status: number;
    createTime: number;
    updateTime: number;
    [key: string]: any;
}

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
        page_size: Math.min(limit, 100),
        start_time: startTime,
        end_time: endTime,
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

    const result = await client.get<MexcHistoryPosition[]>('/api/v1/private/position/list/history_positions', {
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

interface MexcStopOrder {
    stopPlanOrderId: number;
    positionId: number;
    symbol: string;
    stopLossPrice: number;
    takeProfitPrice: number;
    vol: number;
    [key: string]: any;
}

const getStopOrders = async (client: MexcClient, symbol?: string): Promise<MexcStopOrder[]> => {
    const params: Record<string, any> = { page_num: 1, page_size: 100, is_finished: 0 };
    if (symbol) params.symbol = symbol;

    const orders = await client.get<MexcStopOrder[]>('/api/v1/private/stoporder/list/orders', params);
    return orders;
};

const getTickerPrice = async (client: MexcClient, symbol: string): Promise<number> => {
    const ticker = await client.get<any>('/api/v1/contract/ticker', { symbol });
    const data = Array.isArray(ticker) ? ticker[0] : ticker;
    return parseFloat(data.lastPrice || data.fairPrice || data.indexPrice || '0');
};

const MexcFunctions = {
    entry,
    currentPositions,
    getCurrentBalance,
    getCurrentBalanceV3,
    getTradeHistory,
    getOpenOrders,
    getStopOrders,
    getIncome,
    loadMexcClient,
    getContractInfo,
    getTickerPrice,
    setStoploss,
    getPosition,
};

export default MexcFunctions;
