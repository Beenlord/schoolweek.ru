import type { Context } from 'koa';
import { buildOpenApiDocument } from '@/openapi/document';

export async function getOpenApiDocument(ctx: Context) {
    ctx.body = buildOpenApiDocument();
}
