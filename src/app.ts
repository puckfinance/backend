import cors = require('cors');
import express = require('express');
import morgan = require('morgan');
import Routes from './routes';
import { ErrorResponse } from './middlewares';
import * as NodeCache from 'node-cache'
import { connect as connectRedis, isConnected as isRedisConnected } from './infrastructure/redis';
import rateLimit from 'express-rate-limit';

export const cache = new NodeCache();

export const run = async () => {
  console.info(`NODE_ENV: ${process.env.NODE_ENV}`);
  // Connect to Redis if not already connected
  if (!isRedisConnected) {
    try {
      await connectRedis();
    } catch (err) {
      console.error('Failed to connect to Redis:', err);
      // Fallback to NodeCache if Redis connection fails
    }
  }

  const app = express();

  app.set('trust proxy', 1);
  app.use(cors());

  // Apply rate limiting to all requests
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });
  
  // Apply to all API routes
  app.use('/api', apiLimiter);

  // app.use(express.json());
  app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
    if (req.originalUrl.endsWith('webhook')) {
      next();
    } else {
      express.json()(req, res, next);
    }
  });

  // app.use(passport.initialize());npm
  app.use(morgan('dev'));
  app.options('*', cors());
  app.get('/', (_req, res) => {
    res.send('Success');
  });
  app.post('/', (_req, res) => {
    res.send('Success POST');
  });
  app.use('/api/v1', Routes());
  app.use(ErrorResponse);

  return app;
};
