import countryCodePhoneNumberPrefixes from '../../prisma/seed/country_phonenum_prefixes';
import { getClient } from '../infrastructure/redis';
class RedisService {
  private client;

  constructor() {
    this.client = getClient();
  }

  public async init(): Promise<void> {
    await this.setCountryPhoneNumberPrefixes();
  }

  public async setCountryPhoneNumberPrefixes() {
    //transform to array of object reverse key value
    const prefixes = Object.entries(countryCodePhoneNumberPrefixes).map(([country, prefix]) => ({
      country,
      prefix,
    }));
    await this.client.mSet(['countryCodePrefixes', JSON.stringify(prefixes)]);
  }

  public async getCountryPhoneNumberPrefixes(): Promise<string[]> {
    //return json parse
    const prefixes = await this.client.mGet(['countryCodePrefixes']);
    return JSON.parse(prefixes[0]);
  }

  public async getCountryCode(phoneNumber: string): Promise<string[]> {
    var res = await this.client.mGet(['countryCode', phoneNumber]);
    return res;
  }

  public async setCountryCode(phoneNumber: string, countryCode: string): Promise<void> {
    await this.client.mSet(['countryCode', phoneNumber, countryCode]);
  }

  //generate function setOtp  should set the otp in redis which expires after 5 minutes
  public async setOtp(phoneNumber: string, otp: string): Promise<void> {
    await this.client.set(phoneNumber, otp, {
      EX: 300,
    });
  }

  //generate function getOtp  should get the otp from redis
  public async getOtp(phoneNumber: string): Promise<string> {
    return await this.client.get(phoneNumber);
  }

  //generate function deleteOtp  should delete the otp from redis
  public async deleteOtp(phoneNumber: string): Promise<void> {
    await this.client.del(phoneNumber);
  }
}

const redisService = new RedisService();

export default redisService;
