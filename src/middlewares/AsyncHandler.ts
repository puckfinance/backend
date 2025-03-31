import { Request, Response, NextFunction } from 'express';
import logger from '../utils/Logger';

/**
 * Async handler middleware to catch errors in async route handlers and forward them to the error middleware
 * This eliminates the need for try/catch blocks in every controller method
 * 
 * @param fn The async route handler function
 * @returns A middleware function that catches errors and forwards them to the next middleware
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Execute the controller function
      await fn(req, res, next);
    } catch (error) {
      // Log the error and pass it to the error handling middleware
      logger.error(`Unhandled error in controller: ${req.method} ${req.originalUrl}`, error);
      next(error);
    }
  };
};

export default asyncHandler; 