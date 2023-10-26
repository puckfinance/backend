import { JWTPayload } from '../interfaces';
import { JWTExpire } from '../constants';
import * as jwt from 'jsonwebtoken';

export namespace JwtService {
  export const generateToken = (payload: JWTPayload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: JWTExpire,
    });
  };

  export const verifyToken = (token: string) => {
    return jwt.verify(token, process.env.JWT_SECRET);
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
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '10m',
    });
  };
}
