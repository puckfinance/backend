import prisma from '../../../src/infrastructure/prisma';
import * as request from 'supertest';
import { User } from '@prisma/client';
import { TEST_PASSWORD } from '../../../src/constants';
import { run } from '../../../src/app';
import { disconnect } from '../../../src/infrastructure/redis';
import {
  chefTypes,
  cuisine,
  addOn,
  ingredient,
  occasion,
  sittingStyle,
  servingStyle,
} from '../../../prisma/seed/navigations';

let user: Partial<User> = {
  email: 'user0@test.com',
  password: TEST_PASSWORD,
};
jest.setTimeout(30000);

let app: Express.Application | null = null;
let token = '';
describe('When booking an event', () => {
  beforeAll(async () => {
    // Reset the database and prepare the environment for each test
    process.env.NODE_ENV = 'test';
    app = await run();
    token = await login(app);
  });

  test('Should throw 400 on invalid body', async () => {
    const response = await request(app)
      .post('/api/v1/booking/event')
      .set('Authorization', `Bearer ${token}`)
      .send({
        chef_type: chefTypes[0].id,
        cuisines: [cuisine.id],
        add_ons: [addOn.id],
        date: new Date().toISOString(),
        time: new Date().toISOString(),
        guest_count: 2,
      });

    expect(response.status).toBe(400);
  });

  test('Create an event', async () => {
    const response = await request(app)
      .post('/api/v1/booking/event')
      .set('Authorization', `Bearer ${token}`)
      .send({
        chef_type: chefTypes[0].id,
        cuisines: [cuisine.id],
        add_ons: [addOn.id],
        date: new Date().toISOString(),
        time: new Date().toISOString(),
        guest_count: 2,
        address: 'address',
        zip_code: 'zip_code',
        ingredient: ingredient.id,
        occasions: [occasion.id],
        sitting_style: sittingStyle.id,
        serving_style: servingStyle.id,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBeDefined();
    const eventId = response.body.data.id;

    const createdEvt = await request(app)
      .get(`/api/v1/booking/event/${eventId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(createdEvt.status).toBe(200);
    expect(createdEvt.body.data.id).toBe(eventId);
  });


  afterAll(async () => {
    // Close the database connection
    await prisma.$disconnect();
    disconnect();
  });
});
async function login(app: Express.Application) {
  const response = await request(app).post('/api/v1/auth/signin').send({
    email: user.email,
    password: user.password,
  });

  expect(response.status).toBe(200);
  expect(response.body.data.token).toBeDefined();

  // Save the JWT token for future requests
  const jwtToken = response.body.data.token;
  console.log(jwtToken);
  return jwtToken;
}

