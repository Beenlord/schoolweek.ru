import { Router } from '@koa/router';
import { register, login, logout } from '@/controllers/authController';
import { requireAuth } from '@/middleware/auth';

const router = new Router({ prefix: '/auth' });

router.post('/register', register);
router.post('/login', login);
router.post('/logout', requireAuth, logout);

export default router;
