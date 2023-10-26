/** Систем-ын үндсэн утгууд */
export enum SystemDefaults {
  PORT = 8080,
}

/** Хэрэглэгчийн утгууд */
const JWTExpire: number = 60 * 60 * 24; // 1 day
const PasswordSaltRound: number = 10;
export const GOOGLE = 'google';
export const FACEBOOK = 'facebook';
export const APPLE = 'apple';
export const TEST_PASSWORD = 'changeme';

export { JWTExpire, PasswordSaltRound };
