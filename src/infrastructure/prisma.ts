import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const cleanUp = async () => {
  //delete db tables

  await prisma.account.deleteMany();
  await prisma.chefType.deleteMany();
  await prisma.cuisine.deleteMany();
  await prisma.addOn.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.occasion.deleteMany();
  await prisma.sittingStyle.deleteMany();
  await prisma.servingStyle.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
};

export default prisma;
