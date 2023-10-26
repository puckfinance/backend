import { PrismaClient } from '@prisma/client';
import { createRandomUsers } from './seed/users';
import { faker } from '@faker-js/faker';
import { chefTypes, cuisines, addOns, ingredients, occasions, sittingStyles, servingStyles, commentTags } from './seed/navigations';
import { createRandomChefs } from './seed/chefs';

const prisma = new PrismaClient();

async function main() {

  await prisma.commentTag.createMany({
    data: commentTags
  })

  await prisma.chefType.createMany({
    data: chefTypes,
  });
  const chefs = await createRandomChefs();
  await prisma.user.createMany({
    data: chefs,
  })

  await prisma.cuisine.createMany({
    data: cuisines,
  });
  await prisma.addOn.createMany({
    data: addOns,
  });
  await prisma.ingredient.createMany({
    data: ingredients,
  });
  await prisma.occasion.createMany({
    data: occasions,
  });
  await prisma.sittingStyle.createMany({
    data: sittingStyles,
  });
  await prisma.servingStyle.createMany({
    data: servingStyles,
  });

  const USERS = await createRandomUsers();
  for (const user of USERS) {
    await prisma.user.create({
      data: {
        ...user,
        accounts: {
          create: {
            provider_account_id: faker.datatype.uuid(),
            provider: 'google',
            type: 'google',
            scope: 'email',
            id_token: '123456789',
            refresh_token: '123456789',
            access_token: '123456789',
          },
        },
        events: {
          create: {
            id: user.id,
            title: faker.lorem.words(),
            start_date: faker.date.past(),
            end_date: faker.date.recent(),
            party_size: faker.datatype.number(),
            chef_types: {
              connect: {
                id: chefTypes[0].id,
              },
            },
            cuisines: {
              connect: {
                id: //get random id from cuisines
                  cuisines[Math.floor(Math.random() * cuisines.length)].id,
              },
            },
            add_ons: {
              connect: {
                id: addOns[Math.floor(Math.random() * addOns.length)].id,
              },
            },
            ingredients: {
              connect: {
                id: ingredients[Math.floor(Math.random() * ingredients.length)].id,
              },
            },
            occasions: {
              connect: {
                id: occasions[Math.floor(Math.random() * occasions.length)].id,
              },
            },
            sitting_styles: {
              connect: {
                id: sittingStyles[Math.floor(Math.random() * sittingStyles.length)].id,
              },
            },
            serving_styles: {
              connect: {
                id: servingStyles[Math.floor(Math.random() * servingStyles.length)].id,
              },
            },
            chef: {
              connect: {
                id: chefs[Math.floor(Math.random() * chefs.length)].id,
              },
            }
          },
        },
        profile: {
          create: {
            first_name: faker.name.firstName(),
            last_name: faker.name.lastName(),
            birth_date: faker.date.past(),
            about_me: faker.lorem.words(),
            gender: 'male',
          },
        },
      },
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
