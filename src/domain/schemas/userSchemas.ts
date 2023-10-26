import { z } from 'zod';

export const update_profile_schema = z
  .object({
    user_name: z.string().min(1),
    email: z.string().email().min(1),
    phone_number: z.string().min(8).max(15),
    avatar_url: z.string().min(1),
  })
  .partial();
