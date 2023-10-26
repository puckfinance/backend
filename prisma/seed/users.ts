import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { User, UserType } from '@prisma/client';
import { PasswordSaltRound, TEST_PASSWORD } from '../../src/constants';

export async function createRandomUser(i: number): Promise<User> {
  return {
    id: `01cab4f5-672f-4486-94fe-847066f109a${i}`,
    email_verified: faker.datatype.boolean(),
    phone_number_verified: faker.datatype.boolean(),
    user_type: UserType.CONSUMER,
    chef_type_id: null,
    phone_number: faker.phone.number(),
    user_name: faker.internet.userName(),
    address: faker.address.streetAddress(),
    zip_code: faker.address.zipCode(),
    avatar_url: faker.image.avatar(),
    created_at: faker.date.past(),
    updated_at: faker.date.recent(),
    email: `user${i}@test.com`,
    password: await bcrypt.hash(TEST_PASSWORD, PasswordSaltRound),
  };
}

export async function createRandomUsers(): Promise<User[]> {
  const users: User[] = [];
  for (let i = 0; i < 10; i++) {
    users.push(await createRandomUser(i));
  }
  return users;
}
