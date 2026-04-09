/*
  Warnings:

  - The `eurusd` column on the `MarketAnalysis` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `gbpusd` column on the `MarketAnalysis` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `usdjpy` column on the `MarketAnalysis` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "MarketAnalysis" DROP COLUMN "eurusd",
ADD COLUMN     "eurusd" DOUBLE PRECISION,
DROP COLUMN "gbpusd",
ADD COLUMN     "gbpusd" DOUBLE PRECISION,
DROP COLUMN "usdjpy",
ADD COLUMN     "usdjpy" DOUBLE PRECISION;
