import { faker } from "@faker-js/faker";
import { User, UserType } from "@prisma/client";
import * as bcrypt from 'bcrypt'
import { PasswordSaltRound, TEST_PASSWORD } from "../../src/constants";
import { chefTypes } from "./navigations";

export async function createRandomChef(i: number): Promise<User> {
    return {
        id: `01cab4f5-672f-4486-94fe-847066f109b${i}`,
        phone_number_verified: faker.datatype.boolean(),
        phone_number: faker.phone.number(),
        user_name: faker.internet.userName(),
        email_verified: true,
        address: faker.address.streetAddress(),
        zip_code: faker.address.zipCode(),
        avatar_url: faker.image.avatar(),
        created_at: faker.date.past(),
        updated_at: faker.date.recent(),
        email: `chef${i}@test.com`,
        password: await bcrypt.hash(TEST_PASSWORD, PasswordSaltRound),
        user_type: UserType.CHEF,
        chef_type_id:
            //randomly take from cheftypes id 
            chefTypes[Math.floor(Math.random() * chefTypes.length)].id || null,

    };
}

export async function createRandomChefs(): Promise<User[]> {
    const chefs: User[] = [];
    for (let i = 0; i < 10; i++) {
        chefs.push(await createRandomChef(i));
    }
    return chefs;
}



