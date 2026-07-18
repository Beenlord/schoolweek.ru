import { z } from 'zod';

export const userProfileSchema = z.object({
    id: z.string(),
    email: z.string(),
    createdAt: z.string(),
});
