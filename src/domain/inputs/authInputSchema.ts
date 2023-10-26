import { z } from "zod";



export const authInputSchema = z.object({
    email: z.string().min(1).transform(str => str.toLowerCase()),
    phone_number: z.string().min(8).max(15),
    password: z.string().min(1),
}).partial();