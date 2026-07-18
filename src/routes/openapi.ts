import { Router } from '@koa/router';
import { getOpenApiDocument } from '@/controllers/openapiController';

const router = new Router();

router.get('/openapi.json', getOpenApiDocument);

export default router;
