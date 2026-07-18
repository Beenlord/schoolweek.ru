import Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import type { Context, Next } from 'koa';
import router from './routes/api';

const koa = new Koa();

koa.use(bodyParser.default());

koa.use(async (ctx: Context, next: Next) => {
  try {
    await next();
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { error: e.message || 'Internal Server Error' };
    ctx.app.emit('error', e, ctx);
  }
});

koa
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(process.env.PORT ?? 3000, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
