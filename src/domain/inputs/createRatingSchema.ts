import { z } from "zod";


export const createRatingSchema = z.object({
    rating: z.number().min(1).max(5),
    review: z.string().min(1),
    comments: z.array(z.string()).min(1),
    user_id: z.string().min(1),
});