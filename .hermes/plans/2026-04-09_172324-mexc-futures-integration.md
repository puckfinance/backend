# MEXC Futures API Integration Plan

**Author:** Hermes Agent  
**Date:** 2026-04-09  
**Status:** Planning  
**Priority:** Backend First, Then Frontend

---

## 1. Goal

Integrate MEXC exchange futures/contract trading into PuckFinance, following the exact same architecture patterns as existing Binance and Bybit integrations. Users should be able to create MEXC trade accounts, view balances, open/manage/close positions, and see trade history -- all from the existing dashboard UI.

---

## 2. Current Context & Assumptions

### Architecture Summary (from codebase inspection)

**Backend (`puckfinance-backend`):**
- Express + TypeScript, Prisma ORM with PostgreSQL
- Package manager: pnpm
- Pattern: Controller class -> exports `() => { router }` function with `apiKeyMiddleware`
- Service layer: exported functions, client loaded per-request from DB via `loadXClient(tradeAccountId)`
- API keys encrypted at rest via `CryptoService.encrypt/decrypt`
- Caching via `node-cache` (imported from `app.ts`)
- Logging via custom Winston logger (`utils/Logger.ts`)
- Existing exchanges:
  - **Binance** (`binance-api-node` SDK): Full futures -- entry (market), SL/TP, positions, balance, income, trade history, snapshots
  - **Bybit** (`bybit-api` SDK): Partial futures -- entry, SL, balance (hardcoded env keys, not per-user)
- Prisma `Provider` enum: currently `BINANCE | BYBIT`
- Routes registered in `src/routes/index.ts` as `/binance`, `/bybit`

**Frontend (`puckfinance-frontend`):**
- Next.js 15 App Router, React 19, Tailwind CSS 4, Radix UI
- `lib/binance.ts` -- API client functions calling backend
- `lib/trade-accounts.ts` -- CRUD for trade accounts, `Provider` type: `"BINANCE" | "BYBIT" | "OKEX"`
- Trade account dashboard at `app/trade-accounts/[id]/dashboard/page.tsx` (currently hardcoded to Binance)
- New account form at `app/trade-accounts/new/page.tsx` with provider dropdown (BINANCE/BYBIT/OKEX)
- Git remote: `git@github.com:puckfinance/backend.git`, working branch: `feature/analysis-history`

### MEXC Futures API Research Summary

**Base URL:** `https://api.mexc.com`  
**WebSocket URL:** `wss://contract.mexc.com/edge`

**Authentication (HMAC-SHA256):**
- Headers required: `ApiKey`, `Request-Time` (ms timestamp string), `Signature`, `Recv-Window` (optional, max 60)
- Signature = HMAC-SHA256(secretKey, accessKey + timestamp + parameterString)
- GET/DELETE: sort params alphabetically, join with `&`
- POST: use raw JSON body string as parameterString

**Key Endpoints:**

| Category | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| **Market** | GET | `/api/v1/contract/ping` | Server time |
| **Market** | GET | `/api/v1/contract/detail` | Contract info (precision, leverage, size) |
| **Market** | GET | `/api/v1/contract/depth/{symbol}` | Order book |
| **Market** | GET | `/api/v1/contract/ticker` | 24h ticker data |
| **Market** | GET | `/api/v1/contract/funding_rate/{symbol}` | Current funding rate |
| **Market** | GET | `/api/v1/contract/kline/{symbol}` | Candlestick data |
| **Account** | GET | `/api/v1/private/account/assets` | All account assets |
| **Account** | GET | `/api/v1/private/account/asset/{currency}` | Single currency asset |
| **Positions** | GET | `/api/v1/private/position/open_positions` | Open positions |
| **Positions** | GET | `/api/v1/private/position/history_positions` | Position history |
| **Orders** | POST | `/api/v1/private/order/submit` | Place order |
| **Orders** | POST | `/api/v1/private/order/cancel` | Cancel order |
| **Orders** | GET | `/api/v1/private/order/list/open_orders` | Open orders |
| **Orders** | GET | `/api/v1/private/order/list/history_orders` | Order history |
| **Orders** | POST | `/api/v1/private/order/stop_order` | Place SL/TP order |
| **Leverage** | POST | `/api/v1/private/position/leverage` | Set leverage |
| **Plan** | POST | `/api/v1/private/plan/order` | Trigger/plan order |
| **Account** | GET | `/api/v1/private/account/trade_fee` | Trade fee info |

**Rate Limits:** 20 req/2s for account endpoints, varies by endpoint

**Symbol format:** `BTC_USDT` (underscore, not hyphen like Binance's `BTCUSDT`)

**No official Node.js SDK exists** -- we build a lightweight HTTP client using `axios` (already a dependency).

---

## 3. Proposed Approach

Follow the **Binance integration pattern exactly** (per-user encrypted API keys, dynamic client loading, full feature parity). Build a custom MEXC API client since no official Node SDK exists. Use axios for HTTP requests with HMAC-SHA256 signing.

---

## 4. Step-by-Step Plan

### PHASE 1: BACKEND (Branch: `feature/mexc-integration`)

#### Step 1: Prisma Migration -- Add MEXC to Provider Enum

**File:** `prisma/schema.prisma`

```prisma
enum Provider {
  BINANCE
  BYBIT
  MEXC
}
```

Run migration:
```bash
dotenv -e .env.local -- npx prisma migrate dev --name add-mexc-provider
```

#### Step 2: Create MEXC API Client Library

**File:** `src/services/mexc/client.ts` (NEW)

Build a typed HTTP client class that handles:
- HMAC-SHA256 signature generation
- Header construction (ApiKey, Request-Time, Signature, Recv-Window)
- GET/POST/DELETE request methods with automatic signing
- Response parsing (MEXC wraps in `{ success, code, data, message }`)
- Error handling with proper TypeScript types

```typescript
// Core structure:
interface MexcResponse<T> {
  success: boolean;
  code: number;
  data: T;
  message?: string;
}

class MexcClient {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;

  constructor(apiKey: string, secretKey: string, testnet?: boolean) { ... }
  
  private sign(params: string, timestamp: string): string { ... }
  private buildHeaders(params: string): object { ... }
  
  public get<T>(path: string, params?: object): Promise<T> { ... }
  public post<T>(path: string, body: object): Promise<T> { ... }
  public delete<T>(path: string, params?: object): Promise<T> { ... }
}
```

#### Step 3: Create MEXC Service (Following Binance Pattern)

**File:** `src/services/mexc/index.ts` (NEW)

Export functions matching the Binance service pattern:

| Function | Maps to MEXC Endpoint | Purpose |
|----------|----------------------|---------|
| `loadMexcClient(tradeAccountId)` | N/A (internal) | Load encrypted keys from DB, return MexcClient |
| `checkConnection(client)` | GET `/api/v1/contract/ping` | Ping test |
| `getContractInfo(client, symbol)` | GET `/api/v1/contract/detail` | Get symbol precision, contract size, leverage limits |
| `currentPositions(client, symbol?)` | GET `/api/v1/private/position/open_positions` | Get open positions |
| `getCurrentBalance(client)` | GET `/api/v1/private/account/assets` | Get account balance (USDT) |
| `getTradeHistory(client, symbol, limit)` | GET `/api/v1/private/order/list/history_orders` | Get trade history |
| `getOpenOrders(client, symbol?)` | GET `/api/v1/private/order/list/open_orders` | Get open orders |
| `entry(params)` | POST `/api/v1/private/order/submit` + leverage + SL/TP | Open position (market entry) |
| `setStoploss(params)` | POST `/api/v1/private/order/stop_order` | Set/modify stop loss |
| `closePosition(params)` | POST `/api/v1/private/order/submit` (reduceOnly) | Close position |
| `setLeverage(client, symbol, leverage)` | POST `/api/v1/private/position/leverage` | Set leverage |

**Entry logic (following Binance pattern):**
1. Check for existing position (cancel if no position, clear orders)
2. Get contract info (precision, tick size, quantity step)
3. Get account balance (USDT available)
4. Calculate position size based on risk/risk_amount
5. Set leverage
6. Submit market order
7. Place stop-loss order (STOP_MARKET equivalent)
8. Place take-profit order (TAKE_PROFIT equivalent)
9. Return result with entry/SL/TP/qty

**Key MEXC differences to handle:**
- Symbol format: `BTC_USDT` (not `BTCUSDT`)
- Side values: `1` = OPEN_LONG, `2` = CLOSE_LONG, `3` = OPEN_SHORT, `4` = CLOSE_SHORT (or use the enum)
- Quantity in contracts (not base currency)
- Order types: `1` = MARKET, `2` = LIMIT, `3` = STOP, `5` = TAKE_PROFIT
- SL/TP are placed as separate trigger/plan orders

#### Step 4: Create MEXC Controller (Following Binance Pattern)

**File:** `src/controllers/MexcController.ts` (NEW)

```typescript
class MexcController {
  public async entry(req, res, next) { ... }      // POST /entry/:trade_account_id
  public async balance(req, res, next) { ... }     // GET /balance/:trade_account_id
  public async balanceAll(req, res, next) { ... }  // GET /balance-v3/:trade_account_id
  public async income(req, res, next) { ... }      // GET /income/:trade_account_id
  public async tradeHistory(req, res, next) { ... } // GET /trade-history/:trade_account_id
  public async currentPosition(req, res, next) { ... } // GET /current-position/:trade_account_id
  public async openOrders(req, res, next) { ... }  // GET /open-orders/:trade_account_id
}

export default () => {
  const controller = new MexcController();
  const router = Router();
  router.use(apiKeyMiddleware);

  router.post('/entry/:trade_account_id', controller.entry);
  router.get('/trade-history/:trade_account_id', controller.tradeHistory);
  router.get('/current-position/:trade_account_id', controller.currentPosition);
  router.get('/open-orders/:trade_account_id', controller.openOrders);
  router.get('/balance/:trade_account_id', controller.balance);
  router.get('/balance-v3/:trade_account_id', controller.balanceAll);
  router.get('/income/:trade_account_id', controller.income);

  return router;
};
```

Entry schema (same as Binance, with MEXC side mapping):
```typescript
const entrySchema = z.object({
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']),
  price: z.string().optional(),
  risk: z.any().optional(),
  risk_amount: z.any().optional(),
  action: z.enum(['ENTRY', 'EXIT', 'MOVE_STOPLOSS']),
  takeprofit_price: z.string().optional(),
  stoploss_price: z.string().optional(),
});
```

#### Step 5: Register MEXC Routes

**File:** `src/routes/index.ts`

```typescript
import MexcController from '../controllers/MexcController';
// ...
routes.use('/mexc', MexcController());
```

#### Step 6: Create MEXC-Specific Interfaces

**File:** `src/interfaces/Mexc.ts` (NEW)

```typescript
export interface MexcPosition { ... }
export interface MexcBalance { ... }
export interface MexcOrder { ... }
export interface MexcContractInfo { ... }
export interface MexcEntryParams { ... }
```

#### Step 7: Environment Configuration

**File:** `.env.example` -- Add comment about MEXC

No special env vars needed since API keys are per-user (stored encrypted in DB like Binance).

---

### PHASE 2: FRONTEND (Branch: `feature/mexc-integration-frontend`)

#### Step 8: Update Provider Type

**File:** `lib/trade-accounts.ts`

```typescript
export type Provider = "BINANCE" | "BYBIT" | "MEXC";
```

#### Step 9: Create MEXC API Client Library

**File:** `lib/mexc.ts` (NEW)

Mirror `lib/binance.ts` structure with same function signatures:

```typescript
export interface MexcPosition { ... }
export interface MexcBalance { ... }
export interface MexcOrder { ... }
export interface MexcIncome { ... }
export interface MexcTradeHistoryItem { ... }

export async function executeEntry(tradeAccountId, params, accessToken) { ... }
export async function getBalance(tradeAccountId, accessToken) { ... }
export async function getIncome(tradeAccountId, accessToken) { ... }
export async function getTradeHistory(tradeAccountId, symbol, accessToken) { ... }
export async function getCurrentPosition(tradeAccountId, accessToken) { ... }
export async function getOpenOrders(tradeAccountId, accessToken) { ... }
```

All functions call `${NEXT_PUBLIC_API_URL}/api/v1/mexc/...?api_key=munkhjinbnoo`

#### Step 10: Update New Trade Account Form

**File:** `app/trade-accounts/new/page.tsx`

Add MEXC option to provider dropdown:
```html
<option value="MEXC">MEXC</option>
```

#### Step 11: Update Trade Account Dashboard (Provider-Agnostic)

**File:** `app/trade-accounts/[id]/dashboard/page.tsx`

- Detect provider from trade account data
- Conditionally import and call MEXC or Binance API functions
- Display MEXC-specific webhook URL when provider is MEXC
- MEXC balance structure differs from Binance -- map to common display format:
  - `equity` -> Total Balance
  - `unrealized` -> Unrealized PnL
  - `availableBalance` -> Available Balance

#### Step 12: Update Trade History Page

**File:** `app/trade-accounts/[id]/trade-history/page.tsx`

- Detect provider, call correct API
- Map MEXC response fields to display columns

#### Step 13: Frontend API Routes (Next.js Proxy)

**Files:** `app/api/mexc/*/route.ts` (NEW, mirroring binance API routes)

```
app/api/mexc/entry/[trade_account_id]/route.ts
app/api/mexc/balance/[trade_account_id]/route.ts
app/api/mexc/income/[trade_account_id]/route.ts
app/api/mexc/current-position/[trade_account_id]/route.ts
app/api/mexc/open-orders/[trade_account_id]/route.ts
app/api/mexc/trade-history/[trade_account_id]/route.ts
```

---

## 5. Files Likely to Change

### Backend (NEW files)
| File | Purpose |
|------|---------|
| `src/services/mexc/client.ts` | MEXC HTTP client with HMAC-SHA256 signing |
| `src/services/mexc/index.ts` | MEXC service functions (loadMexcClient, entry, balance, etc.) |
| `src/controllers/MexcController.ts` | Express controller with route definitions |
| `src/interfaces/Mexc.ts` | TypeScript interfaces for MEXC API types |

### Backend (MODIFIED files)
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `MEXC` to Provider enum |
| `src/routes/index.ts` | Add `routes.use('/mexc', MexcController())` |
| `.env.example` | Add MEXC notes |

### Frontend (NEW files)
| File | Purpose |
|------|---------|
| `lib/mexc.ts` | MEXC API client functions |
| `app/api/mexc/entry/[trade_account_id]/route.ts` | Next.js proxy for entry |
| `app/api/mexc/balance/[trade_account_id]/route.ts` | Next.js proxy for balance |
| `app/api/mexc/income/[trade_account_id]/route.ts` | Next.js proxy for income |
| `app/api/mexc/current-position/[trade_account_id]/route.ts` | Next.js proxy for positions |
| `app/api/mexc/open-orders/[trade_account_id]/route.ts` | Next.js proxy for orders |
| `app/api/mexc/trade-history/[trade_account_id]/route.ts` | Next.js proxy for history |

### Frontend (MODIFIED files)
| File | Change |
|------|--------|
| `lib/trade-accounts.ts` | Add `"MEXC"` to Provider type |
| `app/trade-accounts/new/page.tsx` | Add MEXC option to provider dropdown |
| `app/trade-accounts/[id]/dashboard/page.tsx` | Provider-aware data fetching |
| `app/trade-accounts/[id]/trade-history/page.tsx` | Provider-aware data fetching |
| `app/trade-accounts/[id]/page.tsx` | Show MEXC provider label |

---

## 6. Tests & Validation

### Backend
1. **Unit tests** for MEXC client signature generation (HMAC-SHA256)
2. **Integration tests** against MEXC testnet (if available) or using mocked responses
3. **Manual test checklist:**
   - Create MEXC trade account via API
   - Verify balance retrieval
   - Place a market entry with SL/TP
   - Verify position shows in current-positions
   - Move stoploss
   - Close position (EXIT action)
   - Verify trade history
   - Verify income/PnL history

### Frontend
1. Create MEXC trade account from UI
2. View MEXC dashboard with balance
3. Execute entry webhook
4. View open positions
5. View trade history
6. Verify webhook URL displays correctly

---

## 7. Risks, Tradeoffs & Open Questions

### Risks
1. **No MEXC testnet for futures** -- MEXC may not have a futures testnet like Binance. Development testing will need minimum-size real orders or extensive mocking.
2. **MEXC API symbol format** (`BTC_USDT`) differs from Binance (`BTCUSDT`) and Bybit (`BTCUSDT`). Need careful symbol normalization, especially for webhook calls from TradingView.
3. **MEXC order side encoding** uses numeric values (1=OPEN_LONG, etc.) vs Binance's string values (BUY/SELL). The controller must map between them.
4. **API stability** -- MEXC has been updating their API frequently (see update log). Endpoint paths and parameters may change.
5. **Rate limits** -- MEXC rate limits (20 req/2s for account endpoints) are stricter than Binance. May need request throttling.

### Tradeoffs
1. **Custom HTTP client vs community SDK** -- No official Node.js SDK exists. Building our own gives us full control but means we maintain it. Alternative: use `ccxt` library which supports MEXC, but it's a heavy dependency and doesn't match our coding style.
2. **Feature parity** -- Bybit integration is incomplete. MEXC integration should aim for full Binance-level parity from the start.

### Open Questions
1. Does MEXC have a futures testnet/sandbox for development?
2. Should we normalize the symbol format across all exchanges (e.g., always `BTC_USDT` internally)?
3. MEXC funding rate and income history endpoints -- need to verify exact response format for income/commission display.
4. The `secret` field on TradeAccount model -- is it used? MEXC may need a passphrase (like OKX), though MEXC docs don't mention one.
5. Should the dashboard page be refactored to a provider-agnostic component rather than conditionally importing per provider?

---

## 8. Git Workflow

### Backend
```bash
cd ~/projects/puckfinance/puckfinance-backend
git checkout main
git pull origin main
git checkout -b feature/mexc-integration
# ... implement steps 1-7 ...
git push origin feature/mexc-integration
# Create PR: feature/mexc-integration -> main
```

### Frontend
```bash
cd ~/projects/puckfinance/puckfinance-frontend
git checkout main
git pull origin main
git checkout -b feature/mexc-integration-frontend
# ... implement steps 8-13 ...
git push origin feature/mexc-integration-frontend
# Create PR: feature/mexc-integration-frontend -> main
```

---

## 9. Implementation Order (Priority)

1. **Prisma migration** (Step 1) -- blocking, quick
2. **MEXC client library** (Step 2) -- core foundation
3. **MEXC service** (Step 3) -- business logic
4. **MEXC controller + routes** (Steps 4-5) -- API endpoints
5. **Manual API testing** -- verify with curl/Postman
6. **Frontend lib/mexc.ts** (Step 9) -- API client
7. **Frontend trade account form** (Step 10) -- MEXC option
8. **Frontend dashboard** (Steps 11-12) -- provider-aware
9. **Frontend API proxy routes** (Step 13) -- if needed
10. **PR creation** -- backend PR first, then frontend PR
