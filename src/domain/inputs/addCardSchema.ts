import { z } from 'zod';

export const addCardSchema = z.object({
  // card_number, exp_month, exp_year, cvv, card_holder_name
  card_number: z.string(),
  exp_month: z.number(),
  exp_year: z.number(),
  cvv: z.string(),
  card_holder_name: z.string(),
  brand: z.string(),
});
