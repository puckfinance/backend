import { RestClientV5 } from 'bybit-api';
import { convertToPrecision, countDecimals } from './binance';
import Log from './log';

const API_KEY = process.env.BYBIT_API_KEY;
const API_SECRET = process.env.BYBIT_SECRET_KEY;
const useTestnet = process.env.NODE_ENV === 'development';

console.info({
  API_KEY,
  API_SECRET,
  useTestnet: useTestnet,
});

export const bybitClient = new RestClientV5({
  key: API_KEY,
  secret: API_SECRET,
  testnet: useTestnet,
  demoTrading: true,
});

interface EntryProps {
  symbol: string;
  risk: number;
  risk_amount: number;
  entryPrice: number;
  side: 'Buy' | 'Sell';
  stoplossPrice: number;
  takeProfitPrice: number;
  partialProfits?: {
    where: number;
    qty: number;
  }[];
}

const entry = async ({
  symbol,
  // entryPrice,
  // partialProfits,
  risk,
  risk_amount,
  side,
  stoplossPrice,
  takeProfitPrice,
}: EntryProps) => {
  /* no entry on current position */
  const positions = await bybitClient.getPositionInfo({
    category: 'linear',
    symbol,
  });

  if (positions.result.list[0].avgPrice !== '0' && positions.result.list[0].avgPrice !== '') {
    console.log('Cancelled opening position');
    throw new Error('Currently in a trade.');
  }

  const balances = await bybitClient.getWalletBalance({
    accountType: 'UNIFIED',
  });

  const balance = balances.result.list[0].coin.find((item) => item.coin === 'USDT');

  /* get precisions */
  const info = await bybitClient.getInstrumentsInfo({
    category: 'linear',
    symbol,
  });

  const quantityPrecision = countDecimals(parseFloat(info.result.list[0].lotSizeFilter.qtyStep));

  if (!balance) throw new Error('balance is undefined.');

  const ticker = await bybitClient.getTickers({
    category: 'linear',
    symbol,
  });

  const currentPrice = parseFloat(ticker.result.list[0].markPrice);

  const riskAmount = risk_amount || parseFloat(balance.walletBalance) * (risk / 100);

  console.log({ riskAmount, currentPrice, stoplossPrice });

  const qty = convertToPrecision(riskAmount / Math.abs(currentPrice - stoplossPrice), quantityPrecision);

  console.log({ riskAmount, qty });

  // set leverage
  await bybitClient.setLeverage({
    category: 'linear',
    symbol,
    buyLeverage: '20',
    sellLeverage: '20',
  });
  // entry
  const executedEntryOrder = await bybitClient.submitOrder({
    category: 'linear',
    symbol,
    side,
    orderType: 'Market',
    qty: qty.toString(),
    stopLoss: stoplossPrice.toString(),
    takeProfit: takeProfitPrice.toString(),
  });

  console.log('ENTRY');
  console.dir(executedEntryOrder, { depth: null });
  Log.sendLog({ executedEntryOrder, riskAmount, qty });

  return {
    success: true,
    entry: currentPrice,
    stoploss: stoplossPrice,
    takeprofit: takeProfitPrice,
    qty,
  };
};

const setStoploss = async ({ symbol, price }: { symbol: string; price: number }) => {
  const positions = await bybitClient.getPositionInfo({
    category: 'linear',
    symbol,
  });

  if (positions.result.list[0].avgPrice === '0' || positions.result.list[0].avgPrice === '') {
    throw new Error('current position is undefined');
  }

  try {
    const executedStopLossOrder = await bybitClient.setTradingStop({
      category: 'linear',
      symbol,
      stopLoss: price.toString(),
      positionIdx: 0,
    });

    console.log('MOVE STOPLOSS');
    console.log({ executedStopLossOrder });
    Log.sendLog({ executedStopLossOrder });

    console.log('--------');
  } catch (error) {
    console.error(error);
    Log.sendLog({ error });

  }
};

const BybitFunctions = {
  entry,
  setStoploss,
};

export default BybitFunctions;
