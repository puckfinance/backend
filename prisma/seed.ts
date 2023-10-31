import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
