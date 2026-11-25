import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';

/** Router tài liệu API (/docs.json, /docs) — chỉ nạp ngoài production. */
export function createDocsRouter(): Router {
  const router = Router();
  router.get('/docs.json', (_req, res) => {
    res.json(openApiDocument);
  });
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  return router;
}
