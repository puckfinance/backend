-- AlterTable
ALTER TABLE "MarketAnalysis" ADD COLUMN     "backtestDate" TEXT,
ADD COLUMN     "isBacktest" BOOLEAN NOT NULL DEFAULT false;
