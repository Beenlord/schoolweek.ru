import { z } from 'zod';
import { config } from '@/config';

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(config.auth.passwordMinLength),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const authResponseSchema = z.object({
    token: z.string(),
    expiresAt: z.string(),
});

export const errorResponseSchema = z.object({
    error: z.string(),
});
