import prisma from '../infrastructure/prisma';
import passport = require('passport');
import { Request, Response, Router } from 'express';
import { User } from '@prisma/client';
import logger from '../utils/Logger';

class UserController {
  public async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req?.user as User)?.id;

      if (!userId) throw new Error('user not found.');
      
      logger.info(`Updating profile for user ${userId}`);
      
      const user = await prisma.user.update({
        where: { id: userId },
        data: req.body,
      });

      res.json(user);
    } catch (error: any) {
      logger.error('Error updating user profile', error);
      res.status(500).json({ message: error?.message || '' });
    }
  }
}

export default () => {
  const controller = new UserController();
  const router = Router();
  router.put('/', passport.authenticate('jwt', { session: false }), controller.updateProfile);

  return router;
};
