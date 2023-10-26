import { AppRouter } from "./AppRouter";
import * as passport from "passport";
import prisma from "../infrastructure/prisma";
import { AppRequest, AppResponse } from "../interfaces";
import { createRatingSchema } from "../domain/inputs/createRatingSchema";




class RatingController {
    public async addRating(req: AppRequest, res: AppResponse) {
        const { rating, review, comments, user_id } = req.parseBody(createRatingSchema);
        const r = await prisma.rating.create({
            data: {
                rating,
                review,
                comments: {
                    connect: comments.map((comment: string) => ({ id: comment })),
                },
                user: {
                    connect: { id: user_id },
                },
            },
        });
        res.sendSuccess(r);

    }

    public async getUserRatings(req: AppRequest, res: AppResponse) {
        const { id } = req.params;
        const ratings = await prisma.rating.findMany({
            where: {
                user_id: id,
            },
            include: {
                comments: true,
            },
        });
        res.sendSuccess(ratings);

    }
}


export default () => {
    const controller = new RatingController();
    const router = new AppRouter();
    router.router.use(passport.authenticate('jwt', { session: false }));
    router.post('/', controller.addRating);
    router.get('/:id', controller.getUserRatings);


    return router.router;
}