import cors = require('cors');
import express = require('express');
import { responseMiddleware } from './middlewares/responseMiddleware';
import passport = require('passport');
import morgan = require('morgan');
import Routes from './routes';
import { ErrorResponse } from './middlewares';
import { Passport } from './middlewares';

import { connect } from './infrastructure/redis';
import redisService from './services/redis';
import { validateBodyMiddleware } from './middlewares/validateBody';

export const run = async () => {
  console.info(`NODE_ENV: ${process.env.NODE_ENV}`)
  Passport();
  await connect();
  await redisService.init();
  const app = express();

  app.set('trust proxy', 1);
  app.use(cors());

  // app.use(express.json());
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ): void => {
      if (req.originalUrl.endsWith('webhook')) {
        next();
      } else {
        express.json()(req, res, next);
      }
    }
  );

  app.use(responseMiddleware);
  app.use(validateBodyMiddleware)
  app.use(passport.initialize());
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
