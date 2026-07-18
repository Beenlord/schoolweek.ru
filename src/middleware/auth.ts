import type { Context, Next } from 'koa';
import Session from '@/models/Session';

export async function requireAuth(ctx: Context, next: Next) {
    const header = ctx.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
        ctx.status = 401;
        ctx.body = { error: 'Не авторизован' };
        return;
    }

    const session = await Session.findOne({ token });
    if (!session || session.expiresAt < new Date()) {
        ctx.status = 401;
        ctx.body = { error: 'Сессия истекла или недействительна' };
        return;
    }

    ctx.state.userId = session.userId;
    await next();
}
