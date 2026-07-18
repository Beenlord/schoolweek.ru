import { Router } from '@koa/router';
import { me } from '@/controllers/usersController';
import { requireAuth } from '@/middleware/auth';

const router = new Router({ prefix: '/users' });

router.get('/me', requireAuth, me);

export default router;
