import * as request from 'supertest';
// import redisClient from '../../../src/services/redis';
import { run } from '../../../src/app';
import { disconnect } from '../../../src/infrastructure/redis';

beforeAll(async () => {
  // Reset the database and prepare the environment for each test
});

test('Country phone number prefix', async () => {
  const app = await run();
  const response = await request(app).get('/api/v1/navigations/country-phone-number-prefix');
  expect(response.status).toBe(200);
  expect(response.body).toBeDefined();
  expect(response.body.data).toBeDefined();
  disconnect();
  // redisClient.disconnect();
});
