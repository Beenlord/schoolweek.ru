import { Router } from '@koa/router';
import { list, getDay, upsertDay, removeDay, batch, sync } from '@/controllers/scheduleController';
import { requireAuth } from '@/middleware/auth';

const router = new Router({ prefix: '/schedule' });

router.use(requireAuth);

router.get('/', list);
router.get('/sync', sync);
router.post('/batch', batch);
router.get('/:date', getDay);
router.put('/:date', upsertDay);
router.delete('/:date', removeDay);

export default router;
