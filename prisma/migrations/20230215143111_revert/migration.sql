/*
  Warnings:

  - You are about to drop the column `amount_captured` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `amount_refunded` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `captured` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `paid` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `refunded` on the `Transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "amount_captured",
DROP COLUMN "amount_refunded",
DROP COLUMN "captured",
DROP COLUMN "paid",
DROP COLUMN "refunded";
