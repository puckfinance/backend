import { z } from 'zod';

export const fileNameSchema = z.object({
  file_name: z
    .string()
    .min(1)
    .regex(/\.[a-z]+$/i, 'File name must have an extension'),
});
