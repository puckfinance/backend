-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email_verified" BOOLEAN DEFAULT false,
ADD COLUMN     "phone_number_verified" BOOLEAN DEFAULT false;
