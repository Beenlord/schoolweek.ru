import type { Context } from 'koa';
import * as authService from '@/services/authService';
import { registerSchema, loginSchema } from '@/schemas/auth';

export async function register(ctx: Context) {
    const parsed = registerSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
        ctx.status = 400;
        ctx.body = { error: parsed.error.issues[0]?.message ?? 'Некорректные данные' };
        return;
    }

    const { email, password } = parsed.data;
    const session = await authService.registerUser(email, password);

    ctx.status = 201;
    ctx.body = session;
}

export async function login(ctx: Context) {
    const parsed = loginSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
        ctx.status = 400;
        ctx.body = { error: parsed.error.issues[0]?.message ?? 'Некорректные данные' };
        return;
    }

    const { email, password } = parsed.data;
    const session = await authService.loginUser(email, password);

    ctx.body = session;
}

export async function logout(ctx: Context) {
    const header = ctx.headers.authorization as string;
    const token = header.slice(7);
    await authService.logoutUser(token);

    ctx.status = 204;
}
