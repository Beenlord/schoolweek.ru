import type { Context } from 'koa';
import mongoose from 'mongoose';

export async function up(ctx: Context) {
    const isDbConnected = mongoose.connection.readyState === 1;

    ctx.status = isDbConnected ? 200 : 503;
    ctx.body = { status: isDbConnected ? 'ok' : 'unavailable' };
}

