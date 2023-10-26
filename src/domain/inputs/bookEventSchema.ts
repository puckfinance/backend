import { z } from 'zod';

export const bookEventSchema = z.object({
  serving_style: z.string().min(1),
  sitting_style: z.string().min(1),
  chef_type: z.string().min(1),
  chef_id: z.string().min(1).optional(),
  occasions: z.array(z.string().min(1)),
  cuisines: z.array(z.string().min(1)),
  add_ons: z.array(z.string().min(1)),
  ingredient: z.string().min(1),
  guest_count: z.number().min(1),
  address: z.string().min(1),
  zip_code: z.string().min(1),
  date: z.string().datetime(),
  time: z.string().min(1),
});


export type BookEventSchema = z.infer<typeof bookEventSchema>;