import redisService from '../src/services/redis';
import countryCodePhoneNumberPrefixes from '../prisma/seed/country_phonenum_prefixes';
import { connect, disconnect } from '../src/infrastructure/redis';

describe('Redis', () => {
  beforeEach(async () => {
    await connect();
    await redisService.init();
  });
  it('Should set and get otp', async () => {
    await redisService.setOtp('95592074', '909090');
    const otp = await redisService.getOtp('95592074');

    expect(otp).toBe('909090');
  });

  it('Should set country phone number prefixes', async () => {
    const prefixes = await redisService.getCountryPhoneNumberPrefixes();
    expect(prefixes).toBeDefined();
    //expect prefix to be have length of countryCodePhoneNumberPrefixes
    expect(prefixes.length).toBe(Object.keys(countryCodePhoneNumberPrefixes).length);
  });

  afterEach(async () => {
    await disconnect();
  });
});
