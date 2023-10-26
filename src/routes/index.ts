import { Router } from 'express';
import AuthController from '../controllers/AuthController';
import NavigationController from '../controllers/NavigationController';
import FileController from '../controllers/FileController';
import UserController from '../controllers/UserController';
import BookingController from '../controllers/BookingController';
import PaymentController from '../controllers/PaymentController';
import NotificationController from '../controllers/NotificationController';
import RatingController from '../controllers/RatingController';

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
  routes.use('/navigations', NavigationController());
  routes.use('/files', FileController());
  routes.use('/users', UserController());
  routes.use('/booking', BookingController());
  routes.use('/payment', PaymentController());
  routes.use('/notification', NotificationController());
  routes.use('/rating', RatingController());

  return routes;
};
