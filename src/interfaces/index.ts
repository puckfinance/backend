import { User } from '@prisma/client';
import { Request, Response } from 'express';
import HttpException from '../utils/HttpException';
import { z } from 'zod';

export interface AppRequest extends Request {
  user?: User;
  parseBody: <T extends z.ZodTypeAny>(schema: T) => z.infer<T>;
}

export interface AppResponse extends Response {
  sendSuccess: (data?: Record<string, any> | null) => void;
  sendError: (error: HttpException | number | unknown, message?: string) => void;
}

export interface CustomGoogleInterface {
  sub?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}
export interface CustomFacebookInterface {
  id?: string;
  email?: string;
  last_name: string;
  first_name: string;
  picture?: {
    data?: {
      height: number;
      is_silhouette: false;
      url: string;
      width: number;
    };
  };
}
export interface JWTPayload {
  id: string;
  email?: string;
  googleId?: string;
  facebookId?: string;
  appleId?: string;
}
