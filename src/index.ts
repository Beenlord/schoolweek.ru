import Koa from 'koa';
import mongoose from 'mongoose';
import * as bodyParser from 'koa-bodyparser';
import type { Context, Next } from 'koa';
import authRouter from '@/routes/auth';
import usersRouter from '@/routes/users';
import scheduleRouter from '@/routes/schedule';
import healthRouter from '@/routes/health';
import openapiRouter from '@/routes/openapi';
import { seedAdmin } from '@/seed';
import { config } from '@/config';

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
  .use(healthRouter.routes())
  .use(healthRouter.allowedMethods())
  .use(openapiRouter.routes())
  .use(openapiRouter.allowedMethods())
  .use(authRouter.routes())
  .use(authRouter.allowedMethods())
  .use(usersRouter.routes())
  .use(usersRouter.allowedMethods())
  .use(scheduleRouter.routes())
  .use(scheduleRouter.allowedMethods());

async function start() {
  await mongoose.connect(config.mongoUri);
  await seedAdmin();
  koa.listen(config.port, () => {
    console.log(`Server running on http://${config.host}:${config.port}`);
  });
}

start();
