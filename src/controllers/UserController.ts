import prisma from '../infrastructure/prisma';
import passport = require('passport');
import { Request, Response, Router } from 'express';

class UserController {
  public async updateProfile(req: Request, res: Response) {
    let { id } = req.params;
    const { email } = req.body;

    const user = await prisma.user.update({
      where: { id: id },
      data: {
        email,
      },
    });
    res.json(user);
  }
}

export default () => {
  const controller = new UserController();
  const router = Router();
  router.put('/:id', passport.authenticate('jwt', { session: false }), controller.updateProfile);
  router.put('/', passport.authenticate('jwt', { session: false }), controller.updateProfile);

  return router;
};
