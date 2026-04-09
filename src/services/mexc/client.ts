import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

export interface MexcResponse<T> {
    success: boolean;
    code: number;
    data: T;
    message?: string;
}

export interface MexcPosition {
    positionId: number;
    symbol: string;
    positionType: number; // 1=long, 2=short
    openType: number; // 1=isolated, 2=cross
    state: number; // 1=holding, 2=system-held, 3=closed
    holdVol: number;
    frozenVol: number;
    closeVol: number;
    holdAvgPrice: number;
    holdAvgPriceFullyScale: string;
    openAvgPrice: number;
    openAvgPriceFullyScale: string;
    closeAvgPrice: number;
    liquidatePrice: number;
    oim: number;
    im: number;
    holdFee: number;
    realised: number;
    leverage: number;
    marginRatio: number;
    autoAddIm: boolean;
    profitRatio: number;
    newOpenAvgPrice: number;
    newCloseAvgPrice: number;
    closeProfitLoss: number;
    fee: number;
    totalFee: number;
    createTime: number;
    updateTime: number;
    [key: string]: any;
}

export interface MexcBalance {
    currency: string;
    positionMargin: number;
    frozenBalance: number;
    availableBalance: number;
    cashBalance: number;
    equity: number;
    unrealized: number;
    bonus: number;
    bonusExpireTime?: number;
    availableCash: number;
    availableOpen: number;
    debtAmount: number;
    contributeMarginAmount: number;
    vcoinId: string;
    [key: string]: any;
}

export interface MexcOrder {
    orderId: string;
    symbol: string;
    positionId: number;
    price: number;
    priceStr: string;
    vol: number;
    leverage: number;
    side: number; // 1=open_long, 2=close_short, 3=open_short, 4=close_long
    category: number;
    orderType: number; // 1=limit, 2=post_only, 3=IOC, 4=FOK, 5=market
    dealAvgPrice: number;
    dealAvgPriceStr: string;
    dealVol: number;
    orderMargin: number;
    takerFee: number;
    makerFee: number;
    profit: number;
    fee: number;
    triggerPrice?: number;
    triggerType?: number;
    status: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    triggerSource?: number;
    externalOid?: string;
    createTime: number;
    updateTime: number;
    [key: string]: any;
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
    [key: string]: any;
}

export interface MexcHistoryPosition {
    positionId: number;
    symbol: string;
    positionType: number;
    openType: number;
    state: number;
    holdVol: number;
    frozenVol: number;
    closeVol: number;
    holdAvgPrice: number;
    holdAvgPriceFullyScale: string;
    openAvgPrice: number;
    openAvgPriceFullyScale: string;
    closeAvgPrice: number;
    liquidatePrice: number;
    oim: number;
    im: number;
    holdFee: number;
    realised: number;
    leverage: number;
    profitRatio: number;
    newOpenAvgPrice: number;
    newCloseAvgPrice: number;
    closeProfitLoss: number;
    fee: number;
    totalFee: number;
    createTime: number;
    updateTime: number;
    [key: string]: any;
}

export class MexcClient {
    private apiKey: string;
    private secretKey: string;
    private baseUrl: string;
    private axiosInstance: AxiosInstance;

    constructor(apiKey: string, secretKey: string) {
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.baseUrl = 'https://api.mexc.com';

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
            .filter(key => params[key] !== null && params[key] !== undefined)
            .sort()
            .map((key) => `${key}=${params[key]}`)
            .join('&');
    }

    public async get<T>(path: string, params?: Record<string, any>): Promise<T> {
        const filteredParams = params
            ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== null && v !== undefined))
            : undefined;
        const queryString = filteredParams ? MexcClient.sortParams(filteredParams) : '';
        const headers = this.buildHeaders(queryString);
        const url = filteredParams ? `${path}?${queryString}` : path;

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
