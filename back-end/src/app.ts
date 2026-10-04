import { randomUUID } from 'node:crypto';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { openApiDocument } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { sanitizeBody } from './middlewares/sanitize.middleware';
import { jsonDateReplacer } from './shared/time';
import { createApiRouter } from './routes';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.set('json replacer', jsonDateReplacer);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true, maxAge: 600 }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && incoming ? incoming : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(sanitizeBody);

  if (env.STORAGE_DRIVER === 'local') {
    app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR), { maxAge: '7d' }));
  }

  app.use('/api/v1', createApiRouter());
  if (env.NODE_ENV !== 'production') {
    app.get('/api/docs.json', (_req, res) => {
      res.json(openApiDocument);
    });
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
