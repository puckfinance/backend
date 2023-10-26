import HttpException from '../utils/HttpException';
import { AppRequest, AppResponse } from '../interfaces';

const isDev = process.env.NODE_ENV !== 'production';

export const responseMiddleware = (_req: AppRequest, res: AppResponse, next: () => void) => {
  res.sendError = (error: HttpException | number | unknown, message?: string) => {
    if (typeof error === 'number') {
      error = new HttpException(error, message);
    }
    if (isDev) console.error(error);

    if (error instanceof HttpException) {
      res.status(error.status || 500).json({
        status: error.status,
        message: error.message,
      });
    } else {
      res.status(500).json({
        status: 500,
        message: 'Internal server error',
      });
    }
  };

  res.sendSuccess = (data?: Record<string, any> | null) => {
    if (data) {
      res.status(200).json({
        status: true,
        message: 'Success.',
        data: data,
      });
    } else {
      res.status(200).send('');
    }
  };

  next();
};
