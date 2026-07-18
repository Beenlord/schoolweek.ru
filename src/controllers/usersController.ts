import type { Context } from 'koa';
import * as userService from '@/services/userService';

export async function me(ctx: Context) {
    ctx.body = await userService.getUserProfile(ctx.state.userId);
}
