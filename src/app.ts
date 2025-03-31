import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import passport from 'passport';
import dotenv from 'dotenv';
import Routes from './routes';
import { ErrorResponse } from './middlewares';
import NodeCache from 'node-cache';
import PassportConfig from './middlewares/Passport';
import logger from './utils/Logger';
import timeout from 'connect-timeout';
import HttpException from './utils/HttpException';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      id?: string;
      rawBody?: Buffer;
      // The timedout property is already defined in connect-timeout types
    }
  }
}

// Load environment variables early
dotenv.config();

export const cache = new NodeCache();

export const run = async () => {
  logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
  PassportConfig();
  const app = express();

  // Set timeout to prevent long-running requests from causing the server to hang
  const timeoutDuration = process.env.TIMEOUT || '60000';
  app.use(timeout(timeoutDuration));
  
  // Add request ID middleware for better logging and tracking
  app.use((req, res, next) => {
    req.id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  app.set('trust proxy', 1);
  
  // Configure CORS with proper error handling
  const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
  app.use(cors(corsOptions));

  // Handle JSON body parsing errors
  app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
    if (req.originalUrl.endsWith('webhook')) {
      next();
    } else {
      express.json({
        limit: '10mb',
        verify: (req: express.Request, _res, buf) => {
          req.rawBody = buf;
        }
      })(req, res, (err) => {
        if (err) {
          logger.error('JSON parsing error', err);
          return res.status(400).json({ 
            status: false,
            message: 'Invalid JSON payload',
            data: null
          });
        }
        next();
      });
    }
  });

  // Request logging
  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  } else {
    // Use a custom morgan format that works with our logger in production
    app.use(morgan((tokens, req, res) => {
      return JSON.stringify({
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: tokens.status(req, res),
        responseTime: tokens['response-time'](req, res),
        contentLength: tokens.res(req, res, 'content-length'),
        userAgent: tokens['user-agent'](req, res),
        requestId: req.id
      });
    }, {
      stream: {
        write: (message) => {
          const data = JSON.parse(message);
          logger.info('HTTP Request', data);
        }
      }
    }));
  }

  app.use(passport.initialize());
  app.options('*', cors(corsOptions));
  
  // Basic health check endpoint
  app.get('/', (_req, res) => {
    res.send('Success');
  });
  
  app.post('/', (_req, res) => {
    res.send('Success POST');
  });
  
  // Add timeout handler to avoid server hanging due to long-running requests
  app.use((req, _res, next) => {
    if (!req.timedout) return next();
    
    logger.warn(`Request timeout: ${req.method} ${req.url}`);
    next(new HttpException(408, 'Request timeout'));
  });
  
  app.use('/api/v1', Routes());
  
  // 404 handler
  app.use((req, _res, next) => {
    next(new HttpException(404, `Route not found: ${req.method} ${req.url}`));
  });
  
  // Global error handler
  app.use(ErrorResponse);

  return app;
};
