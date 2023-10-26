-- CreateTable
CREATE TABLE "CountryPhoneNumberPrefix" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CountryPhoneNumberPrefix_pkey" PRIMARY KEY ("id")
);
