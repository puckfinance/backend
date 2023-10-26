-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "amount_captured" INTEGER,
ADD COLUMN     "amount_refunded" INTEGER,
ADD COLUMN     "captured" BOOLEAN,
ADD COLUMN     "paid" BOOLEAN,
ADD COLUMN     "refunded" BOOLEAN,
ALTER COLUMN "amount_capturable" DROP NOT NULL,
ALTER COLUMN "amount_received" DROP NOT NULL;
