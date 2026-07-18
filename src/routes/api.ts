import { Router } from '@koa/router';
import type { Context, Next } from 'koa';

const router = new Router();

router
  .get('/api', (ctx: Context) => {
    console.log(`Call /api route.`);
    ctx.body = { message: 'Success' };
  });

export default router;
