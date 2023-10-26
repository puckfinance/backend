import { z } from 'zod';


export const chargeEventBillSchema = z.object({
    event_id: z.string().min(1),
    payment_method_id: z.string().min(1),
});
