import HttpException from '../utils/HttpException';
import { AppRequest, AppResponse } from '../interfaces';
import { z } from 'zod';


export const validateBodyMiddleware = (req: AppRequest, _res: AppResponse, next: () => void) => {
  req.parseBody = <T extends z.ZodTypeAny>(schema: T): z.infer<T> => {
    const s = schema.safeParse(req.body);
    if (!s.success) {
      throw new HttpException(400, (s as any).error);
    }
    return (s as any).data;
  };
  next();
}

