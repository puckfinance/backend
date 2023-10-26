/*
  Warnings:

  - You are about to drop the column `address` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `bankAccount` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `bankOwner` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `cover` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `instructorType` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `webSite` on the `Profile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "address",
DROP COLUMN "bankAccount",
DROP COLUMN "bankOwner",
DROP COLUMN "cover",
DROP COLUMN "instructorType",
DROP COLUMN "webSite";
