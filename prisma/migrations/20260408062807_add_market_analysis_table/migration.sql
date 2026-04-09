-- CreateTable
CREATE TABLE "MarketAnalysis" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "symbol" TEXT NOT NULL,
    "userId" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "priceChange24h" DOUBLE PRECISION NOT NULL,
    "priceChangePercentage24h" DOUBLE PRECISION NOT NULL,
    "marketCap" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL,
    "circulatingSupply" DOUBLE PRECISION NOT NULL,
    "ath" DOUBLE PRECISION NOT NULL,
    "athDate" TEXT NOT NULL,
    "distanceFromAth" DOUBLE PRECISION NOT NULL,
    "dxyPrice" DOUBLE PRECISION,
    "eurusd" TEXT,
    "gbpusd" TEXT,
    "usdjpy" TEXT,
    "macroEvents" JSONB,
    "keySupport" DOUBLE PRECISION NOT NULL,
    "keyResistance" DOUBLE PRECISION NOT NULL,
    "dailyHigh" DOUBLE PRECISION NOT NULL,
    "dailyLow" DOUBLE PRECISION NOT NULL,
    "fearGreedIndex" INTEGER NOT NULL,
    "fearGreedClassification" TEXT NOT NULL,
    "fundingRate" DOUBLE PRECISION NOT NULL,
    "longShortRatio" DOUBLE PRECISION NOT NULL,
    "marketBias" TEXT NOT NULL,
    "whaleData" JSONB,
    "rsi" DOUBLE PRECISION NOT NULL,
    "rsiCondition" TEXT NOT NULL,
    "macdHistogram" DOUBLE PRECISION NOT NULL,
    "macdTrend" TEXT NOT NULL,
    "emaTrend" TEXT NOT NULL,
    "marketStructure" TEXT NOT NULL,
    "bollingerSqueeze" BOOLEAN NOT NULL,
    "bollingerPercentB" DOUBLE PRECISION NOT NULL,
    "atr" DOUBLE PRECISION NOT NULL,
    "vwapRelation" TEXT NOT NULL,
    "indicators" JSONB,
    "defiTvl" DOUBLE PRECISION,
    "defiProtocols" JSONB,
    "defiHealth" TEXT,
    "analysisText" TEXT,
    "aiInsights" JSONB,
    "shortTermOutlook" TEXT,
    "mediumTermOutlook" TEXT,
    "keyLevelToWatch" TEXT,
    "recommendedStrategy" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "overallVerdict" TEXT,
    "tradeAlertActive" BOOLEAN,
    "tradeAlertDirection" TEXT,
    "tradeAlertEntryPrice" DOUBLE PRECISION,
    "tradeAlertStopLoss" DOUBLE PRECISION,
    "tradeAlertTakeProfit" DOUBLE PRECISION,
    "tradeAlertRiskReward" DOUBLE PRECISION,
    "tradeAlertSetup" TEXT,
    "tradeAlertReasoning" TEXT,

    CONSTRAINT "MarketAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketAnalysis_symbol_idx" ON "MarketAnalysis"("symbol");

-- CreateIndex
CREATE INDEX "MarketAnalysis_createdAt_idx" ON "MarketAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "MarketAnalysis_userId_idx" ON "MarketAnalysis"("userId");

-- CreateIndex
CREATE INDEX "MarketAnalysis_symbol_createdAt_idx" ON "MarketAnalysis"("symbol", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketAnalysis" ADD CONSTRAINT "MarketAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
