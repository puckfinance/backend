import { Router } from 'express';
import passport from 'passport';
import { AuthController } from '../controllers/AuthController';

const router = Router();

// Authentication routes
router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.get('/me', passport.authenticate('jwt', { session: false }), AuthController.me);

export default router; 