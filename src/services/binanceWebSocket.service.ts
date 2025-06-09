import Binance from 'binance-api-node';

interface IWebSocket {
  send: (data: string) => void;
  on: (event: string, listener: (...args: any[]) => void) => void;
  close: () => void;
  readyState: number;
  OPEN: number;
}

class BinanceWebSocketService {
  private binanceClient;
  private ws: IWebSocket | null = null;

  constructor(apiKey: string, apiSecret: string) {
    this.binanceClient = Binance({
      apiKey,
      apiSecret,
    });
  }

  public async connect(ws: IWebSocket) {
    this.ws = ws;
    console.log('Connecting to Binance WebSocket');

    // Listen for account updates
    await this.binanceClient.ws.futuresUser((update) => {
      console.log('Received account update:', update);
      if (this.ws && this.ws.readyState === this.ws.OPEN) {
        this.ws.send(JSON.stringify(update));
      }
    });

    console.log('Connected to Binance WebSocket');
  }
}

export default BinanceWebSocketService; 