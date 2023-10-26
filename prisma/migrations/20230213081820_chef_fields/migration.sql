/*
  Warnings:

  - You are about to drop the column `major` on the `Profile` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('CHEF', 'CONSUMER');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "chef_id" TEXT;

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "major";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "chef_type_id" TEXT,
ADD COLUMN     "user_type" "UserType" NOT NULL DEFAULT 'CONSUMER';

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_chef_type_id_fkey" FOREIGN KEY ("chef_type_id") REFERENCES "ChefType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
