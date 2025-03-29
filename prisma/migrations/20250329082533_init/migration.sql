/*
  Warnings:

  - A unique constraint covering the columns `[apiKey,secretKey]` on the table `TradeAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TradeAccount_apiKey_secretKey_key" ON "TradeAccount"("apiKey", "secretKey");
