import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

export interface MexcResponse<T> {
  success: boolean;
  code: number;
  data: T;
  message?: string;
}

export interface MexcPosition {
  id: string;
  positionId: number;
  symbol: string;
  type: number; // 1=long, 2=short
  openType: number; // 1=cross, 2=isolated
  volume: number;
  holdVolume: number;
  frozenVolume: number;
  closeVolume: number;
  averageOpenPrice: string;
  averageOpenPriceUsd: string;
  closeAveragePrice: string;
  closeAveragePriceUsd: string;
  leverage: number;
  holdFee: string;
  holdFeeRate: string;
  stopLossPrice: string;
  takeProfitPrice: string;
  period: number;
  realizeProfit: string;
  realizeProfitUsd: string;
  unrealizedProfit: string;
  unrealizedProfitUsd: string;
  positionMargin: string;
  initialMargin: string;
  initialMarginUsd: string;
  maintainMargin: string;
  liquidatePrice: string;
  liquidateRate: string;
  createTime: number;
  updateTime: number;
}

export interface MexcBalance {
  currency: string;
  positionEquity: string;
  frozenBalance: string;
  availableBalance: string;
  cashBalance: string;
  unrealized: string;
  maxTransferable: string;
  equity: string;
  bonus: string;
  crossUnrealized: string;
  isolatedUnrealized: string;
  longTotalUnrealized: string;
  shortTotalUnrealized: string;
  longTotalPosition: string;
  shortTotalPosition: string;
  totalPoint: string;
  availablePoint: string;
  frozenPoint: string;
  cumRealizedPnl: string;
  dailyRealizedPnl: string;
}

export interface MexcOrder {
  id: string;
  symbol: string;
  type: number; // 1=market, 2=limit, 3=stop, 5=take_profit
  price: string;
  vol: string;
  leverage: number;
  dealVol: string;
  openType: number;
  side: number; // 1=open_long, 2=close_long, 3=open_short, 4=close_short
  triggerPrice: string;
  triggerType: number;
  status: number;
  stopLossPrice: string;
  takeProfitPrice: string;
  triggerSource: number;
  outerId: string;
  createTime: number;
  updateTime: number;
}

export interface MexcContractInfo {
  symbol: string;
  displayName: string;
  baseCoin: string;
  quoteCoin: string;
  settlementCoin: string;
  contractSize: string;
  minVol: string;
  maxVol: string;
  priceUnit: string;
  volUnit: string;
  leverageMin: number;
  leverageMax: number;
  priceScale: number;
  volScale: number;
  valueScale: number;
  maxHoldVol: string;
  maintenanceRatio: string;
  initialMargin: string;
  riskLimitBase: string;
  riskLimitStep: string;
  maxPosition: string;
  fundingInterval: number;
  status: string;
}

export interface MexcHistoryOrder {
  id: string;
  symbol: string;
  type: number;
  price: string;
  vol: string;
  dealVol: string;
  openType: number;
  side: number;
  profit: string;
  fee: string;
  triggerPrice: string;
  triggerType: number;
  triggerSource: number;
  status: number;
  stopLossPrice: string;
  takeProfitPrice: string;
  outerId: string;
  createTime: number;
  updateTime: number;
}

export interface MexcHistoryPosition {
  id: string;
  positionId: number;
  symbol: string;
  type: number;
  openType: number;
  holdVolume: number;
  closeVolume: number;
  averageOpenPrice: string;
  closeAveragePrice: string;
  leverage: number;
  realizeProfit: string;
  realizeProfitUsd: string;
  stopLossPrice: string;
  takeProfitPrice: string;
  triggerSource: number;
  createTime: number;
  updateTime: number;
}

export class MexcClient {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private axiosInstance: AxiosInstance;

  constructor(apiKey: string, secretKey: string, testnet?: boolean) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseUrl = testnet ? 'https://contract.mexc.com' : 'https://contract.mexc.com';

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  private sign(params: string, timestamp: string): string {
    const message = this.apiKey + timestamp + params;
    return crypto.createHmac('sha256', this.secretKey).update(message).digest('hex');
  }

  private buildHeaders(params: string): Record<string, string> {
    const timestamp = Date.now().toString();
    const signature = this.sign(params, timestamp);

    return {
      'ApiKey': this.apiKey,
      'Request-Time': timestamp,
      'Signature': signature,
      'Recv-Window': '5000',
      'Content-Type': 'application/json',
    };
  }

  private static sortParams(params: Record<string, any>): string {
    return Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
  }

  public async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    const queryString = params ? MexcClient.sortParams(params) : '';
    const headers = this.buildHeaders(queryString);
    const url = params ? `${path}?${queryString}` : path;

    const response = await this.axiosInstance.get<MexcResponse<T>>(url, { headers });

    if (!response.data.success) {
      throw new Error(`MEXC API error: ${response.data.message || response.data.code}`);
    }

    return response.data.data;
  }

  public async post<T>(path: string, body: Record<string, any>): Promise<T> {
    const bodyString = JSON.stringify(body);
    const headers = this.buildHeaders(bodyString);

    const response = await this.axiosInstance.post<MexcResponse<T>>(path, body, { headers });

    if (!response.data.success) {
      throw new Error(`MEXC API error: ${response.data.message || response.data.code}`);
    }

    return response.data.data;
  }

  public async delete<T>(path: string, params?: Record<string, any>): Promise<T> {
    const queryString = params ? MexcClient.sortParams(params) : '';
    const headers = this.buildHeaders(queryString);
    const url = params ? `${path}?${queryString}` : path;

    const response = await this.axiosInstance.delete<MexcResponse<T>>(url, { headers });

    if (!response.data.success) {
      throw new Error(`MEXC API error: ${response.data.message || response.data.code}`);
    }

    return response.data.data;
  }
}
