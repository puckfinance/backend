/*
  Warnings:

  - Changed the type of `provider` on the `TradeAccount` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('BINANCE', 'BYBIT');

-- AlterTable
ALTER TABLE "TradeAccount" DROP COLUMN "provider",
ADD COLUMN     "provider" "Provider" NOT NULL;
