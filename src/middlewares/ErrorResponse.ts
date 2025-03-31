import express from 'express';
import HttpException from '../utils/HttpException';
import logger from '../utils/Logger';

export default (err: HttpException | Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // If headers already sent, delegate to the default Express error handler
  if (res.headersSent) {
    return next(err);
  }
  
  // Determine status code and message
  const statusCode = err instanceof HttpException ? err.status || 500 : 500;
  const message = err.message || 'Something went wrong';
  
  // In production, don't expose error details to clients for 500 errors
  const clientMessage = process.env.NODE_ENV === 'production' && statusCode === 500 
    ? 'Internal server error' 
    : message;
  
  // Send response to client
  res.status(statusCode).json({
    status: false,
    message: clientMessage,
    data: null,
  });
  
  // Log the error with request details for debugging
  const errorContext = {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: (req.user as any)?.id || 'unauthenticated',
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
    }
  };
  
  // Log complete error details
  logger.error(`API Error: ${statusCode} ${message}`, {
    error: err,
    request: errorContext,
    body: process.env.NODE_ENV !== 'production' ? req.body : '[Redacted in production]'
  });
};
