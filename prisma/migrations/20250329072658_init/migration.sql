/*
  Warnings:

  - Added the required column `provider` to the `TradeAccount` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TradeAccount" ADD COLUMN     "provider" TEXT NOT NULL;
