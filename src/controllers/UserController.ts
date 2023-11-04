import prisma from '../infrastructure/prisma';
import passport = require('passport');
import { Request, Response, Router } from 'express';
import { User } from '@prisma/client';

class UserController {
  public async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req?.user as User)?.id;

      if (!userId) throw new Error('user not found.');
      const user = await prisma.user.update({
        where: { id: userId },
        data: req.body,
      });

      res.json(user);
    } catch (error: any) {
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
