import prisma from '../infrastructure/prisma';
import passport = require('passport');
import { AppRequest, AppResponse } from '../interfaces';
import { AppRouter } from './AppRouter';

class UserController {
  public async updateProfile(req: AppRequest, res: AppResponse) {
    let { id } = req.params;
    if (!id) id = req.user.id;
    const { email } = req.body;

    const user = await prisma.user.update({
      where: { id: id },
      data: {
        email,
      },
    });
    res.sendSuccess(user);
  }
}

export default () => {
  const controller = new UserController();
  const router = new AppRouter();
  router.router.use(passport.authenticate('jwt', { session: false }));
  router.put('/:id', controller.updateProfile);
  router.put('/', controller.updateProfile);

  return router.router;
};
