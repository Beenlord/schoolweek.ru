import { Router } from '@koa/router';
import { up } from '@/controllers/healthController';

const router = new Router();

router.get('/up', up);

export default router;
