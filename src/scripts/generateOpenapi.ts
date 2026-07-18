import { writeFileSync } from 'node:fs';
import { buildOpenApiDocument } from '@/openapi/document';

const document = buildOpenApiDocument();
writeFileSync('openapi.json', `${JSON.stringify(document, null, 2)}\n`);

console.log('openapi.json сгенерирован');
