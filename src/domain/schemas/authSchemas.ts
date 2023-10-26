import { z } from 'zod';

export const phoneNumberLoginSchema = z.object({
  phone_number: z.string().min(8).max(15),
  prefix: z.string().min(1),
  zip_code: z.string().min(1),
});
