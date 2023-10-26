import { Router } from 'express';
import AuthController from '../controllers/AuthController';
import UserController from '../controllers/UserController';

/**
 * Http router class (post, get, put, delete, patch etc)
 *
 * @author Munkhjin
 * @createdDate 30/04/2021
 */
export default () => {
  const routes = Router();

  /** Controller routes */
  routes.use('/auth', AuthController());
  routes.use('/users', UserController());

  return routes;
};
