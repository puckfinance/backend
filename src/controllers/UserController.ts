import prisma from '../infrastructure/prisma';
import passport = require('passport');
import { update_profile_schema } from '../domain/schemas/userSchemas';
import { AppRequest, AppResponse } from '../interfaces';
import { AppRouter } from './AppRouter';

class UserController {
  public async updateProfile(req: AppRequest, res: AppResponse) {
    let { id } = req.params;
    if (!id) id = req.user.id;
    const { user_name, email, phone_number, avatar_url } = req.parseBody(update_profile_schema);

    const user = await prisma.user.update({
      where: { id: id },
      data: {
        user_name,
        email,
        phone_number,
        avatar_url,
      },
    });
    res.sendSuccess(user);
  }

  public async addRating(req: AppRequest, res: AppResponse) {
    const { id } = req.params;
    const { rating, review, comments } = req.body;
    const user = await prisma.user.update({
      where: { id: id },
      data: {
        ratings: {
          create: {
            rating,
            review,
            comments: {
              connect: comments.map((comment: string) => ({ id: comment })),
            }
          },
        },
      },
    });
    res.sendSuccess(user);
  }

  public async getRatings(req: AppRequest, res: AppResponse) {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: id },
      include: {
        ratings: true,
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
