/*
  Warnings:

  - You are about to drop the column `accessToken` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `idToken` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `oauthToken` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `oauthTokenSecret` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `providerAccountId` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `sessionState` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `tokenType` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `AddOn` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `AddOn` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `zipCode` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `cardNumber` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `expMonth` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `expYear` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `ChefType` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ChefType` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `CountryPhoneNumberPrefix` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `CountryPhoneNumberPrefix` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Cuisine` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Cuisine` table. All the data in the column will be lost.
  - You are about to drop the column `addressId` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `creatorId` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `partySize` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Ingredient` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Ingredient` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Occasion` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Occasion` table. All the data in the column will be lost.
  - You are about to drop the column `aboutMe` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `birthDate` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `ServingStyle` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ServingStyle` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `SittingStyle` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `SittingStyle` table. All the data in the column will be lost.
  - You are about to drop the column `avatarUrl` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `userName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `zipCode` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[provider,provider_account_id]` on the table `Account` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[address_id]` on the table `Event` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone_number]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `provider_account_id` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `zip_code` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `card_number` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `exp_month` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `exp_year` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creator_id` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `end_date` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_date` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `Profile` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT "Card_userId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_addressId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "Profile" DROP CONSTRAINT "Profile_userId_fkey";

-- DropIndex
DROP INDEX "Account_provider_providerAccountId_key";

-- DropIndex
DROP INDEX "Event_addressId_key";

-- DropIndex
DROP INDEX "Profile_userId_key";

-- DropIndex
DROP INDEX "User_phoneNumber_key";

-- AlterTable
ALTER TABLE "Account" RENAME COLUMN "providerAccountId" TO "provider_account_id";

ALTER TABLE "Account" DROP COLUMN "accessToken",
DROP COLUMN "createdAt",
DROP COLUMN "expiresAt",
DROP COLUMN "idToken",
DROP COLUMN "oauthToken",
DROP COLUMN "oauthTokenSecret",
DROP COLUMN "refreshToken",
DROP COLUMN "sessionState",
DROP COLUMN "tokenType",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "access_token" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expires_at" INTEGER,
ADD COLUMN     "id_token" TEXT,
ADD COLUMN     "oauth_token" TEXT,
ADD COLUMN     "oauth_token_secret" TEXT,
ADD COLUMN     "refresh_token" TEXT,
ADD COLUMN     "session_state" TEXT,
ADD COLUMN     "token_type" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AddOn" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Address" DROP COLUMN "createdAt",
DROP COLUMN "eventId",
DROP COLUMN "updatedAt",
DROP COLUMN "zipCode",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "event_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "zip_code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "cardNumber",
DROP COLUMN "createdAt",
DROP COLUMN "expMonth",
DROP COLUMN "expYear",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "card_number" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "exp_month" INTEGER NOT NULL,
ADD COLUMN     "exp_year" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ChefType" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "CountryPhoneNumberPrefix" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Cuisine" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "addressId",
DROP COLUMN "createdAt",
DROP COLUMN "creatorId",
DROP COLUMN "endDate",
DROP COLUMN "partySize",
DROP COLUMN "startDate",
DROP COLUMN "updatedAt",
ADD COLUMN     "address_id" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "creator_id" TEXT NOT NULL,
ADD COLUMN     "end_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "party_size" INTEGER,
ADD COLUMN     "start_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Ingredient" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Occasion" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "aboutMe",
DROP COLUMN "birthDate",
DROP COLUMN "createdAt",
DROP COLUMN "firstName",
DROP COLUMN "lastName",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "about_me" TEXT,
ADD COLUMN     "birth_date" TIMESTAMP(3),
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "first_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "last_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ServingStyle" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SittingStyle" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarUrl",
DROP COLUMN "createdAt",
DROP COLUMN "phoneNumber",
DROP COLUMN "updatedAt",
DROP COLUMN "userName",
DROP COLUMN "zipCode",
ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "user_name" TEXT,
ADD COLUMN     "zip_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_provider_account_id_key" ON "Account"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "Event_address_id_key" ON "Event"("address_id");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_user_id_key" ON "Profile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_number_key" ON "User"("phone_number");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
