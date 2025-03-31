import { JWTPayload } from '../interfaces';
import { JWTExpire } from '../constants';
import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET || '';
export namespace JwtService {
  export const generateToken = (payload: JWTPayload) => {
    return jwt.sign(payload, jwtSecret, {
      expiresIn: JWTExpire,
    });
  };

  export const verifyToken = (token: string) => {
    return jwt.verify(token, jwtSecret);
  };

  export const decodeToken = (token: string) => {
    return jwt.decode(token);
  };

  export const getTokenFromHeader = (header: string) => {
    if (header && header.split(' ')[0] === 'Bearer') {
      return header.split(' ')[1];
    }
    return null;
  };

  export const generateVerificationToken = (payload: JWTPayload) => {
    return jwt.sign(payload, jwtSecret, {
      expiresIn: '10m',
    });
  };
}
