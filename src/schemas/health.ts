import { z } from 'zod';

export const healthSchema = z.object({
    status: z.enum(['ok', 'unavailable']),
});
