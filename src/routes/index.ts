import { Router } from 'express';
import UserController from '../controllers/UserController';
import BinanceController from '../controllers/BinanceController';
import BybitController from '../controllers/BybitController';
import authRoutes from './auth.routes';

/**
 * Http router class (post, get, put, delete, patch etc)
 *
 * @author Munkhjin
 * @createdDate 30/04/2021
 */
export default () => {
  const routes = Router();

  /** Controller routes */
  routes.use('/auth', authRoutes);
  routes.use('/users', UserController());
  routes.use('/binance', BinanceController());
  routes.use('/bybit', BybitController());

  return routes;
};
