# Backend Đợt 1 — Nền tảng: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng lại `back-end/` thành API TypeScript feature-based có đăng nhập, phân quyền theo chi nhánh, quản lý nhân viên, chi nhánh, cài đặt, upload ảnh (local/GCS), audit log và seed — nền móng cho các đợt 2–5.

**Architecture:** Express 5 + Mongoose 8, mỗi nghiệp vụ là một thư mục trong `src/modules/` (model/service/controller/routes/validation). Middleware dùng chung xử lý JWT, quyền theo vai trò + phạm vi chi nhánh, validate bằng zod và chuẩn hóa lỗi. `createApp()` là factory thuần (không kết nối DB) để test bằng Supertest trên mongodb-memory-server.

**Tech Stack:** Node ≥ 20.9, TypeScript strict, Express 5, Mongoose 8, zod 4, pino, jsonwebtoken, bcryptjs, multer 2, sharp, @google-cloud/storage, date-fns + date-fns-tz, swagger-ui-express, Vitest + Supertest + mongodb-memory-server.

**Spec:** `docs/superpowers/specs/2026-10-03-backend-api-design.md` (đợt 1 = mục 12.1; quy ước ở mục 4, 5, 8, 9, 10, 11, 13).

## Global Constraints

- Mọi lệnh chạy trong thư mục `back-end/` (trừ khi ghi khác). Package manager: **npm** (bỏ yarn của template).
- Prefix API: `/api/v1`. Response thành công `{ data }` hoặc `{ data, meta: { page, limit, total } }`; lỗi `{ error: { code, message, details? } }`.
- Mã lỗi chỉ gồm: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `BRANCH_FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`. `message` viết tiếng Việt.
- Múi giờ nghiệp vụ `Asia/Ho_Chi_Minh`: JSON trả Date dạng `yyyy-MM-ddTHH:mm:ss+07:00`; ngày `YYYY-MM-DD` hiểu là 00:00 giờ VN.
- Tiền là số nguyên đơn vị đồng (đợt này chưa có trường tiền).
- Vai trò cố định: `super_admin`, `branch_manager`, `consultant`, `editor`, `instructor`.
- Access token 15 phút; refresh token opaque, lưu SHA-256, cookie `gt_refresh` httpOnly, xoay vòng, tái sử dụng → thu hồi cả family.
- Upload: chỉ `image/jpeg|png|webp`, ≤ 5MB, resize cạnh dài ≤ 1920px, lưu `.webp`, key `yyyy/MM/<uuid>.webp`.
- Rate limit `/auth/login`: 5 lần thất bại / 15 phút / IP.
- Đăng nhập: body `{ identifier, password }`, `identifier` là SĐT hoặc username. SĐT lưu dạng chuẩn `0xxxxxxxxx` (10 số); username 3–30 ký tự `a-z 0-9 . _`, có ít nhất một chữ cái, lưu chữ thường. Cả hai bắt buộc và duy nhất. Không có email/SMTP, không có đăng ký tài khoản.
- **Không commit** `docs/superpowers/**` (spec, plan). Chỉ commit code trong `back-end/` bằng `git add -A .` khi đang ở `back-end/`.
- Commit message kết thúc bằng dòng: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Express 5 tự chuyển lỗi của handler async sang error middleware → **không** cần `asyncHandler`. `req.query` ở Express 5 chỉ đọc → dữ liệu đã validate đặt ở `req.valid`, đọc bằng `validated(req, part)`.

### Điều chỉnh nhỏ so với spec (đã cân nhắc, ghi lại để reviewer biết)
- Bỏ `JWT_REFRESH_SECRET`: refresh token là chuỗi ngẫu nhiên lưu hash, không phải JWT. Thêm `UPLOAD_DIR`, `TRUST_PROXY`, `LOG_LEVEL`.
- `GET /settings` mở cho mọi nhân viên (quyền `setting.read`) để màn Trợ giúp đọc được cẩm nang; `PATCH /settings` vẫn chỉ `super_admin`.
- `GET /api/v1/health` (nằm dưới prefix). Swagger chỉ bật khi `NODE_ENV !== 'production'`, kèm `/api/docs.json`.
- Username/SĐT/slug duy nhất kể cả bản ghi đã xóa mềm (tạo lại cùng username hoặc SĐT → 409).
- Không có email/SMTP: bỏ `/auth/forgot-password`, `/auth/reset-password`. Nhân viên quên mật khẩu thì admin cấp mật khẩu tạm (`POST /users/:id/reset-password`) và gửi trực tiếp; không bắt đổi mật khẩu ở lần đăng nhập đầu.
- Đăng nhập bằng SĐT hoặc username thay cho email; `email` của user là trường liên hệ tùy chọn.

## Review Focus

1. Đăng nhập bằng SĐT viết có khoảng trắng/dấu chấm/`+84` (`"+84 779.666.664"`) hoặc username có chữ hoa (`" Admin "`) → vẫn đăng nhập được (Task 6).
2. Hai request `/auth/refresh` đồng thời cùng một cookie → đúng một request thành công, request còn lại 401 (Task 6).
3. ID sai định dạng trong URL (`/branches/abc`) → 400 `VALIDATION_ERROR`, không phải 500 (Task 8).
4. Quản lý chi nhánh xem được nhân viên thuộc 2 chi nhánh (một của mình, một không) nhưng **không** sửa được → 403 `BRANCH_FORBIDDEN` (Task 9).
5. File khai `image/png` nhưng nội dung là text → 400 `VALIDATION_ERROR`, không phải 500 (Task 11).

---

## File Structure

```
back-end/
├── package.json  tsconfig.json  tsconfig.build.json  vitest.config.ts  eslint.config.mjs
├── .env.example  .gitignore  .dockerignore  Dockerfile  docker-compose.yml  README.md
├── src/
│   ├── server.ts                      # connect DB → listen → graceful shutdown
│   ├── app.ts                         # createApp(): middleware + routes, không đụng DB
│   ├── config/  env.ts  logger.ts  db.ts  roles.ts
│   ├── routes/index.ts                # createApiRouter(): gom router các module
│   ├── middlewares/
│   │   ├── error.middleware.ts        # toApiError, errorHandler, notFoundHandler
│   │   ├── validate.middleware.ts     # validate(), validated()
│   │   ├── sanitize.middleware.ts     # loại key `$…`/`a.b` khỏi body
│   │   ├── auth.middleware.ts         # authenticate
│   │   ├── authorize.middleware.ts    # authorize(), branchFilter(), assertBranchAccess()
│   │   ├── rateLimit.middleware.ts    # createRateLimiter()
│   │   └── upload.middleware.ts       # uploadImage (multer)
│   ├── utils/  ApiError.ts  response.ts  jwt.ts  crypto.ts  slugify.ts  regex.ts
│   ├── shared/
│   │   ├── time.ts                    # toVnIso, parseDateOnly, parseDateTime, jsonDateReplacer
│   │   ├── zod.ts                     # objectIdSchema, idParamsSchema, zDateOnly
│   │   ├── mongoose/  schemaOptions.ts  softDelete.ts  paginate.ts
│   │   └── storage/   types.ts  local.ts  gcs.ts  index.ts
│   ├── modules/
│   │   ├── auth/      token.model.ts auth.service.ts auth.controller.ts auth.routes.ts auth.validation.ts
│   │   ├── users/     user.model.ts users.service.ts users.controller.ts users.routes.ts users.validation.ts
│   │   ├── branches/  branch.model.ts branches.service.ts branches.controller.ts branches.routes.ts branches.validation.ts
│   │   ├── settings/  setting.model.ts settings.schema.ts settings.service.ts settings.controller.ts settings.routes.ts
│   │   ├── media/     media.model.ts media.service.ts media.controller.ts media.routes.ts
│   │   ├── audit/     audit.model.ts audit.service.ts audit.controller.ts audit.routes.ts
│   │   └── public/    public.routes.ts
│   ├── docs/openapi.ts
│   ├── scripts/  seed.ts  seed-data.ts
│   └── types/express.d.ts
└── tests/
    ├── setup.ts                       # mongodb-memory-server cho mọi file test
    ├── helpers/  factories.ts  http.ts
    ├── unit/
    └── integration/
```

---

### Task 0: Tạo nhánh làm việc

- [ ] **Step 1: Tạo nhánh từ `main`** (chạy ở root repo)

```bash
cd /Users/sang/Desktop/WorkSpace/project/gia-thinh-driver-project
git checkout -b feat/backend-foundation
```
Expected: `Switched to a new branch 'feat/backend-foundation'`

---

### Task 1: Khung dự án TypeScript, env, logger, health check

**Files:**
- Delete: `src/**`, `tests/**`, `jest.config.js`, `.travis.yml`, `.eslintrc.json`, `.eslintignore`, `.lintstagedrc.json`, `.husky/`, `ecosystem.config.json`, `docker-compose.dev.yml`, `docker-compose.prod.yml`, `docker-compose.test.yml`, `yarn.lock`, `yarn-error.log`, `LICENSE`
- Create: `package.json` (thay toàn bộ), `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `eslint.config.mjs`, `.env.example`, `src/config/env.ts`, `src/config/logger.ts`, `src/utils/response.ts`, `src/routes/index.ts`, `src/app.ts`, `src/server.ts`, `src/config/db.ts`
- Modify: `.gitignore`
- Test: `tests/unit/env.test.ts`, `tests/integration/health.test.ts`

**Interfaces:**
- Produces: `env` (object đã validate, kiểu `Env`), `parseEnv(source)`, `logger` (pino), `createApp(): Express`, `createApiRouter(): Router`, `sendData(res, data, status?)`, `sendList(res, { data, meta })`, `connectDb()`, `disconnectDb()`.

- [ ] **Step 1: Xóa template cũ**

```bash
rm -rf src tests jest.config.js .travis.yml .eslintrc.json .eslintignore .lintstagedrc.json .husky \
  ecosystem.config.json docker-compose.dev.yml docker-compose.prod.yml docker-compose.test.yml \
  yarn.lock yarn-error.log LICENSE node_modules
mv .env .env.template-old   # giá trị mẫu của template; xóa sau khi tạo .env mới
```

- [ ] **Step 2: Tạo `package.json`**

```json
{
  "name": "gia-thinh-backend",
  "version": "0.1.0",
  "private": true,
  "description": "API cho website và trang quản trị Trường lái Gia Thịnh",
  "engines": { "node": ">=20.9.0" },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "seed": "tsx src/scripts/seed.ts",
    "seed:prod": "node dist/scripts/seed.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

- [ ] **Step 3: Cài dependency**

```bash
npm install express@5 mongoose@8 zod@4 dotenv pino pino-http helmet cors cookie-parser express-rate-limit \
  bcryptjs jsonwebtoken multer@2 sharp @google-cloud/storage date-fns date-fns-tz swagger-ui-express
npm install -D typescript tsx vitest supertest mongodb-memory-server pino-pretty prettier \
  eslint @eslint/js typescript-eslint \
  @types/node @types/express @types/cors @types/cookie-parser @types/jsonwebtoken @types/multer \
  @types/supertest @types/swagger-ui-express
```
Expected: cài xong không lỗi, có `package-lock.json`.

- [ ] **Step 4: Tạo `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `eslint.config.mjs`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "noEmit": true
  },
  "include": ["src", "tests", "vitest.config.ts"]
}
```

`tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "rootDir": "src", "outDir": "dist", "sourceMap": true },
  "include": ["src"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      MONGODB_URL: 'mongodb://set-by-tests',
      JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
      CORS_ORIGINS: 'http://localhost:3000',
      LOG_LEVEL: 'silent',
      UPLOAD_DIR: '.test-uploads',
    },
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
```

`eslint.config.mjs`:
```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'uploads', '.test-uploads', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-namespace': 'off' } },
);
```

- [ ] **Step 5: Cập nhật `.gitignore`** — thêm vào cuối file:

```gitignore

# Build & upload
dist
uploads
.test-uploads
.env.template-old
```

- [ ] **Step 6: Viết test env (failing)** — `tests/unit/env.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env';

const base = {
  MONGODB_URL: 'mongodb://localhost:27017/gt',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  CORS_ORIGINS: 'http://a.vn, http://b.vn',
};

describe('parseEnv', () => {
  it('áp dụng giá trị mặc định và tách CORS_ORIGINS', () => {
    const env = parseEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.APP_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
    expect(env.JWT_ACCESS_EXPIRES_MIN).toBe(15);
    expect(env.CORS_ORIGINS).toEqual(['http://a.vn', 'http://b.vn']);
    expect(env.STORAGE_DRIVER).toBe('local');
  });

  it('báo lỗi khi secret quá ngắn', () => {
    expect(() => parseEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('bắt buộc GCS_BUCKET khi STORAGE_DRIVER=gcs', () => {
    expect(() => parseEnv({ ...base, STORAGE_DRIVER: 'gcs' })).toThrow(/GCS_BUCKET/);
  });

  it('coi chuỗi rỗng là không khai báo', () => {
    const env = parseEnv({ ...base, SEED_ADMIN_USERNAME: '', COOKIE_DOMAIN: '' });
    expect(env.SEED_ADMIN_USERNAME).toBeUndefined();
    expect(env.COOKIE_DOMAIN).toBeUndefined();
  });
});
```

- [ ] **Step 7: Chạy test, xác nhận fail**

Run: `npx vitest run tests/unit/env.test.ts`
Expected: FAIL — `Cannot find module '../../src/config/env'`

- [ ] **Step 8: Viết `src/config/env.ts`**

```ts
import dotenv from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'test') dotenv.config();

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    MONGODB_URL: z.string().min(1),
    APP_TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_MIN: z.coerce.number().int().positive().default(15),
    JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
    CORS_ORIGINS: csv,
    COOKIE_DOMAIN: z.string().optional(),
    STORAGE_DRIVER: z.enum(['local', 'gcs']).default('local'),
    UPLOAD_DIR: z.string().default('uploads'),
    GCS_BUCKET: z.string().optional(),
    PUBLIC_MEDIA_BASE_URL: z.url().optional(),
    SEED_ADMIN_USERNAME: z.string().optional(),
    SEED_ADMIN_PHONE: z.string().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER === 'gcs' && !value.GCS_BUCKET) {
      ctx.addIssue({ code: 'custom', path: ['GCS_BUCKET'], message: 'Bắt buộc khi STORAGE_DRIVER=gcs' });
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Biến môi trường không hợp lệ:\n${lines.join('\n')}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
```

- [ ] **Step 9: Chạy lại test env**

Run: `npx vitest run tests/unit/env.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 10: Viết test health (failing)** — `tests/integration/health.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('GET /api/v1/health', () => {
  it('trả trạng thái ok', async () => {
    const res = await request(createApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('trả 404 dạng lỗi chuẩn cho đường dẫn không tồn tại', async () => {
    const res = await request(createApp()).get('/khong-ton-tai');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 11: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/health.test.ts`
Expected: FAIL — `Cannot find module '../../src/app'`

- [ ] **Step 12: Viết logger, response, router, app, db, server**

`src/config/logger.ts`:
```ts
import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
      '*.idNumber',
      '*.phone',
    ],
    censor: '[redacted]',
  },
  ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
});
```

`src/utils/response.ts`:
```ts
import type { Response } from 'express';

export type PageMeta = { page: number; limit: number; total: number };

export function sendData(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ data });
}

export function sendList(res: Response, result: { data: unknown[]; meta: PageMeta }): void {
  res.status(200).json(result);
}
```

`src/routes/index.ts`:
```ts
import { Router } from 'express';
import { sendData } from '../utils/response';

export function createApiRouter(): Router {
  const router = Router();
  router.get('/health', (_req, res) => sendData(res, { status: 'ok', time: new Date() }));
  return router;
}
```

`src/app.ts`:
```ts
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { createApiRouter } from './routes';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
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

  if (env.STORAGE_DRIVER === 'local') {
    app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR), { maxAge: '7d' }));
  }

  app.use('/api/v1', createApiRouter());
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy đường dẫn' } });
  });
  return app;
}
```

`src/config/db.ts`:
```ts
import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDb(url: string = env.MONGODB_URL): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(url);
  logger.info('Đã kết nối MongoDB');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
```

`src/server.ts`:
```ts
import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';

async function main(): Promise<void> {
  await connectDb();
  const server = createApp().listen(env.PORT, () => logger.info(`API chạy tại http://localhost:${env.PORT}/api/v1`));

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Đang tắt server');
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Không khởi động được server');
  process.exit(1);
});
```

- [ ] **Step 13: Chạy test health**

Run: `npx vitest run tests/integration/health.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 14: Tạo `.env.example`, rồi tạo `.env` từ nó**

`.env.example`:
```dotenv
NODE_ENV=development
PORT=4000
TRUST_PROXY=0
LOG_LEVEL=info
APP_TIMEZONE=Asia/Ho_Chi_Minh

MONGODB_URL=mongodb://127.0.0.1:27017/gia-thinh

# Tối thiểu 32 ký tự, tạo bằng: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_ACCESS_SECRET=
JWT_ACCESS_EXPIRES_MIN=15
JWT_REFRESH_EXPIRES_DAYS=30

# Danh sách domain front-end, cách nhau bằng dấu phẩy
CORS_ORIGINS=http://localhost:3000
COOKIE_DOMAIN=

# local | gcs
STORAGE_DRIVER=local
UPLOAD_DIR=uploads
GCS_BUCKET=
# Đường dẫn file JSON service account (thư viện Google tự đọc)
GOOGLE_APPLICATION_CREDENTIALS=
# Để trống: local → http://localhost:PORT/uploads, gcs → https://storage.googleapis.com/<bucket>
PUBLIC_MEDIA_BASE_URL=

# Tài khoản super_admin đầu tiên do `npm run seed` tạo
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PHONE=
SEED_ADMIN_PASSWORD=
```

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
Dán chuỗi vừa in vào `JWT_ACCESS_SECRET` trong `.env`. Sau đó xóa `.env.template-old`.

- [ ] **Step 15: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: không lỗi.

- [ ] **Step 16: Commit**

```bash
git add -A .
git commit -m "chore(be): dựng khung TypeScript feature-based thay template cũ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Lỗi chuẩn, validate (zod), sanitize body

**Files:**
- Create: `src/utils/ApiError.ts`, `src/middlewares/error.middleware.ts`, `src/middlewares/validate.middleware.ts`, `src/middlewares/sanitize.middleware.ts`, `src/types/express.d.ts`
- Modify: `src/app.ts` (dùng `sanitizeBody`, `notFoundHandler`, `errorHandler`)
- Test: `tests/unit/error.middleware.test.ts`, `tests/unit/validate.middleware.test.ts`, `tests/unit/sanitize.test.ts`

**Interfaces:**
- Produces:
  - `class ApiError(status: number, code: ErrorCode, message: string, details?: ErrorDetail[])` + static `badRequest(message?, details?)`, `unauthorized(message?)`, `forbidden(message?)`, `branchForbidden(message?)`, `notFound(message?)`, `conflict(message)`.
  - `type ErrorDetail = { path: string; message: string }`.
  - `toApiError(err: unknown): ApiError`, `errorHandler`, `notFoundHandler`.
  - `validate({ body?, query?, params? }: ZodType)` → RequestHandler, ghi kết quả vào `req.valid`.
  - `validated<T>(req, 'body' | 'query' | 'params'): T`.
  - `sanitizeBody` RequestHandler; `stripMongoOperators(value)`.
  - `Express.Request` có `user?: Express.AuthUser`, `valid?: {...}`, `scope?: BranchScope` (BranchScope định nghĩa ở Task 5 — ở task này khai báo kiểu tạm trong `express.d.ts`, xem code).

- [ ] **Step 1: Viết test (failing)**

`tests/unit/error.middleware.test.ts`:
```ts
import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toApiError } from '../../src/middlewares/error.middleware';
import { ApiError } from '../../src/utils/ApiError';

describe('toApiError', () => {
  it('giữ nguyên ApiError', () => {
    const err = ApiError.forbidden();
    expect(toApiError(err)).toBe(err);
  });

  it('chuyển ZodError thành VALIDATION_ERROR có details', () => {
    const parsed = z.object({ name: z.string() }).safeParse({});
    const err = toApiError(parsed.error);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details?.[0]?.path).toBe('name');
  });

  it('chuyển CastError thành 400', () => {
    const err = toApiError(new mongoose.Error.CastError('ObjectId', 'abc', '_id'));
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('chuyển lỗi trùng khóa 11000 thành 409 CONFLICT', () => {
    const err = toApiError({ code: 11000, keyValue: { email: 'a@b.vn' } });
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.details).toEqual([{ path: 'email', message: 'Đã tồn tại' }]);
  });

  it('chuyển lỗi JSON sai cú pháp thành 400', () => {
    expect(toApiError({ type: 'entity.parse.failed' }).status).toBe(400);
  });

  it('lỗi lạ thành 500 INTERNAL_ERROR, không lộ message gốc', () => {
    const err = toApiError(new Error('secret detail'));
    expect(err.status).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.message).not.toContain('secret');
  });
});
```

`tests/unit/validate.middleware.test.ts`:
```ts
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validate, validated } from '../../src/middlewares/validate.middleware';
import { ApiError } from '../../src/utils/ApiError';

function run(schema: Parameters<typeof validate>[0], req: Partial<Request>) {
  const next = vi.fn();
  validate(schema)(req as Request, {} as never, next);
  return next;
}

describe('validate', () => {
  it('ghi dữ liệu đã parse vào req.valid', () => {
    const req: Partial<Request> = { query: { page: '2' } as never, body: {}, params: {} };
    const next = run({ query: z.object({ page: z.coerce.number() }) }, req);
    expect(next).toHaveBeenCalledWith();
    expect(validated<{ page: number }>(req as Request, 'query').page).toBe(2);
  });

  it('trả VALIDATION_ERROR với path có tiền tố phần request', () => {
    const next = run({ body: z.object({ email: z.email() }) }, { body: { email: 'x' }, query: {}, params: {} });
    const err = next.mock.calls[0]?.[0] as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details?.[0]?.path).toBe('body.email');
  });
});
```

`tests/unit/sanitize.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { stripMongoOperators } from '../../src/middlewares/sanitize.middleware';

describe('stripMongoOperators', () => {
  it('bỏ key bắt đầu bằng $ hoặc chứa dấu chấm, kể cả lồng nhau', () => {
    const input = { email: { $ne: null }, 'a.b': 1, ok: [{ $where: 'x', text: 'giữ' }], name: 'An' };
    expect(stripMongoOperators(input)).toEqual({ email: {}, ok: [{ text: 'giữ' }], name: 'An' });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/unit/error.middleware.test.ts tests/unit/validate.middleware.test.ts tests/unit/sanitize.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/utils/ApiError.ts`:
```ts
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BRANCH_FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type ErrorDetail = { path: string; message: string };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message = 'Dữ liệu không hợp lệ', details?: ErrorDetail[]) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Bạn cần đăng nhập để tiếp tục') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static branchForbidden(message = 'Bạn không có quyền với chi nhánh này') {
    return new ApiError(403, 'BRANCH_FORBIDDEN', message);
  }

  static notFound(message = 'Không tìm thấy dữ liệu') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string, details?: ErrorDetail[]) {
    return new ApiError(409, 'CONFLICT', message, details);
  }
}
```

`src/types/express.d.ts`:
```ts
import type { Role } from '../config/roles';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      role: Role;
      branchIds: string[];
    }

    interface BranchScope {
      all: boolean;
      branchIds: string[];
    }

    interface Request {
      user?: AuthUser;
      valid?: { body?: unknown; query?: unknown; params?: unknown };
      scope?: BranchScope;
    }
  }
}

export {};
```

Vì `express.d.ts` import `Role`, tạo luôn `src/config/roles.ts` tối thiểu (Task 5 sẽ bổ sung phần còn lại):
```ts
export const ROLES = ['super_admin', 'branch_manager', 'consultant', 'editor', 'instructor'] as const;
export type Role = (typeof ROLES)[number];
```

`src/middlewares/error.middleware.ts`:
```ts
import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { ApiError } from '../utils/ApiError';

function isDuplicateKey(err: unknown): err is { code: number; keyValue?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

function isBodyParseError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { type?: unknown }).type === 'entity.parse.failed';
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) {
    return ApiError.badRequest(
      'Dữ liệu không hợp lệ',
      err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Giá trị không hợp lệ cho trường ${err.path}`, [{ path: err.path, message: 'Sai định dạng' }]);
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return ApiError.badRequest(
      'Dữ liệu không hợp lệ',
      Object.values(err.errors).map((item) => ({ path: item.path, message: item.message })),
    );
  }
  if (isDuplicateKey(err)) {
    return ApiError.conflict(
      'Dữ liệu đã tồn tại',
      Object.keys(err.keyValue ?? {}).map((key) => ({ path: key, message: 'Đã tồn tại' })),
    );
  }
  if (err instanceof multer.MulterError) {
    return ApiError.badRequest(
      err.code === 'LIMIT_FILE_SIZE' ? 'File vượt quá dung lượng cho phép (5MB)' : 'File tải lên không hợp lệ',
    );
  }
  if (isBodyParseError(err)) return ApiError.badRequest('JSON không hợp lệ');
  return new ApiError(500, 'INTERNAL_ERROR', 'Đã có lỗi xảy ra, vui lòng thử lại sau');
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Không tìm thấy ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const apiError = toApiError(err);
  if (apiError.status >= 500) (req.log ?? logger).error({ err }, 'Lỗi không xử lý được');
  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  });
};
```

`src/middlewares/validate.middleware.ts`:
```ts
import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ApiError, type ErrorDetail } from '../utils/ApiError';

type Part = 'body' | 'query' | 'params';
type Schemas = Partial<Record<Part, ZodType>>;

const PARTS: Part[] = ['params', 'query', 'body'];

export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const output: NonNullable<Request['valid']> = { ...req.valid };
    const details: ErrorDetail[] = [];

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        output[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ path: [part, ...issue.path].join('.'), message: issue.message });
        }
      }
    }

    if (details.length > 0) return next(ApiError.badRequest('Dữ liệu không hợp lệ', details));
    req.valid = output;
    next();
  };
}

export function validated<T>(req: Request, part: Part): T {
  return req.valid?.[part] as T;
}
```

`src/middlewares/sanitize.middleware.ts`:
```ts
import type { RequestHandler } from 'express';

export function stripMongoOperators(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripMongoOperators);
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.startsWith('$') && !key.includes('.'))
        .map(([key, nested]) => [key, stripMongoOperators(nested)]),
    );
  }
  return value;
}

export const sanitizeBody: RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') req.body = stripMongoOperators(req.body);
  next();
};
```

- [ ] **Step 4: Gắn vào `src/app.ts`**

Thêm import:
```ts
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { sanitizeBody } from './middlewares/sanitize.middleware';
```
Thêm `app.use(sanitizeBody);` ngay sau `app.use(cookieParser());`. Thay khối 404 tạm thời:
```ts
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy đường dẫn' } });
  });
```
bằng:
```ts
  app.use(notFoundHandler);
  app.use(errorHandler);
```

Thêm vào `tests/integration/health.test.ts` (trong `describe`):
```ts
  it('trả lỗi chuẩn khi body JSON sai cú pháp', async () => {
    const res = await request(createApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
```
và sửa test 404 thêm: `expect(res.body.error.code).toBe('NOT_FOUND');`

- [ ] **Step 5: Chạy test**

Run: `npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add -A .
git commit -m "feat(be): chuẩn hóa lỗi, validate zod và sanitize body

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Hạ tầng DB cho test, helper Mongoose (schemaOptions, xóa mềm, phân trang), slugify

**Files:**
- Create: `tests/setup.ts`, `src/shared/mongoose/schemaOptions.ts`, `src/shared/mongoose/softDelete.ts`, `src/shared/mongoose/paginate.ts`, `src/shared/zod.ts` (phần objectId), `src/utils/slugify.ts`, `src/utils/regex.ts`
- Modify: `vitest.config.ts` (thêm `setupFiles`)
- Test: `tests/unit/mongoose-helpers.test.ts`, `tests/unit/slugify.test.ts`

**Interfaces:**
- Produces:
  - `schemaOptions(opts?: { hidden?: string[]; timestamps?: boolean }): SchemaOptions` — toJSON đổi `_id` → `id` (string), bỏ `__v` và các field trong `hidden`.
  - `softDeletePlugin(schema)` — thêm `deletedAt: Date | null` (mặc định null) và tự lọc bản ghi đã xóa cho `find*`, `countDocuments`, `updateOne`, `updateMany`, trừ khi filter đã có key `deletedAt`.
  - `WITH_DELETED = { deletedAt: { $exists: true } }` — trộn vào filter để lấy cả bản ghi đã xóa.
  - `listQuerySchema` (zod: `page`, `limit`, `sort?`, `q?`), `type ListQuery`.
  - `paginate<T>(model, filter, query: { page; limit; sort? }, defaultSort = '-createdAt'): Promise<{ data: HydratedDocument<T>[]; meta: PageMeta }>`.
  - `objectIdSchema`, `idParamsSchema` (`{ id }`).
  - `slugify(input: string): string`, `escapeRegex(input: string): string`.

- [ ] **Step 1: Viết `tests/setup.ts` và bật trong vitest**

```ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

let mongo: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
```

Trong `vitest.config.ts`, thêm vào `test`: `setupFiles: ['./tests/setup.ts'],`

Lần chạy đầu `mongodb-memory-server` tải binary MongoDB (~100MB), có thể mất vài phút.

- [ ] **Step 2: Viết test (failing)**

`tests/unit/slugify.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { escapeRegex } from '../../src/utils/regex';
import { slugify } from '../../src/utils/slugify';

describe('slugify', () => {
  it.each([
    ['Tân Ngãi', 'tan-ngai'],
    ['VP Vũng Liêm', 'vp-vung-liem'],
    ['Đức Hòa  —  Long An', 'duc-hoa-long-an'],
    ['  Hạng B (số sàn) ', 'hang-b-so-san'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('escapeRegex', () => {
  it('thoát ký tự đặc biệt', () => {
    expect(new RegExp(escapeRegex('a.b(c)')).test('a.b(c)')).toBe(true);
    expect(new RegExp(escapeRegex('a.b')).test('axb')).toBe(false);
  });
});
```

`tests/unit/mongoose-helpers.test.ts`:
```ts
import mongoose, { Schema } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { paginate, listQuerySchema } from '../../src/shared/mongoose/paginate';
import { schemaOptions } from '../../src/shared/mongoose/schemaOptions';
import { softDeletePlugin, WITH_DELETED } from '../../src/shared/mongoose/softDelete';

type Thing = { name: string; secret?: string; deletedAt?: Date | null };
const thingSchema = new Schema<Thing>({ name: String, secret: String }, schemaOptions({ hidden: ['secret'] }));
thingSchema.plugin(softDeletePlugin);
const Thing = mongoose.models.Thing ?? mongoose.model<Thing>('Thing', thingSchema);

describe('schemaOptions', () => {
  it('toJSON có id dạng string, không có _id, __v, field ẩn', async () => {
    const doc = await Thing.create({ name: 'A', secret: 'x' });
    const json = doc.toJSON() as Record<string, unknown>;
    expect(json.id).toBe(doc._id.toString());
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
    expect(json).not.toHaveProperty('secret');
    expect(json).toHaveProperty('createdAt');
  });
});

describe('softDeletePlugin', () => {
  it('ẩn bản ghi đã xóa mềm, WITH_DELETED lấy lại được', async () => {
    const [a] = await Thing.create([{ name: 'A' }, { name: 'B' }]);
    await Thing.updateOne({ _id: a!._id }, { deletedAt: new Date() });
    expect(await Thing.countDocuments()).toBe(1);
    expect(await Thing.findById(a!._id)).toBeNull();
    expect(await Thing.countDocuments(WITH_DELETED)).toBe(2);
  });
});

describe('paginate', () => {
  it('trả data + meta và áp dụng sort/skip/limit', async () => {
    await Thing.create(['c', 'a', 'b', 'd', 'e'].map((name) => ({ name })));
    const query = listQuerySchema.parse({ page: '2', limit: '2', sort: 'name' });
    const result = await paginate(Thing, {}, query);
    expect(result.meta).toEqual({ page: 2, limit: 2, total: 5 });
    expect(result.data.map((item) => item.name)).toEqual(['c', 'd']);
  });

  it('listQuerySchema chặn limit > 100 và sort có ký tự lạ', () => {
    expect(listQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(listQuerySchema.safeParse({ sort: '$where' }).success).toBe(false);
    expect(listQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npx vitest run tests/unit/slugify.test.ts tests/unit/mongoose-helpers.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 4: Viết code**

`src/utils/slugify.ts`:
```ts
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

`src/utils/regex.ts`:
```ts
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

`src/shared/mongoose/schemaOptions.ts`:
```ts
import type { SchemaOptions } from 'mongoose';

export function schemaOptions(opts: { hidden?: string[]; timestamps?: boolean } = {}): SchemaOptions {
  const hidden = opts.hidden ?? [];
  return {
    timestamps: opts.timestamps ?? true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        for (const field of hidden) delete ret[field];
        return ret;
      },
    },
  };
}
```

`src/shared/mongoose/softDelete.ts`:
```ts
import type { MongooseQueryMiddleware, Query, Schema } from 'mongoose';

export const WITH_DELETED = { deletedAt: { $exists: true } } as const;

const HOOKS: MongooseQueryMiddleware[] = ['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'updateOne', 'updateMany'];

export function softDeletePlugin(schema: Schema): void {
  schema.add({ deletedAt: { type: Date, default: null } });
  schema.pre(HOOKS, function hideDeleted(this: Query<unknown, unknown>) {
    if (!('deletedAt' in this.getFilter())) this.where({ deletedAt: null });
  });
}
```

`src/shared/mongoose/paginate.ts`:
```ts
import type { FilterQuery, HydratedDocument, Model } from 'mongoose';
import { z } from 'zod';
import type { PageMeta } from '../../utils/response';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .string()
    .regex(/^-?[a-zA-Z0-9_.]+$/, 'Tham số sort không hợp lệ')
    .optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export async function paginate<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  query: Pick<ListQuery, 'page' | 'limit' | 'sort'>,
  defaultSort = '-createdAt',
): Promise<{ data: HydratedDocument<T>[]; meta: PageMeta }> {
  const { page, limit } = query;
  const [data, total] = await Promise.all([
    model
      .find(filter)
      .sort(query.sort ?? defaultSort)
      .skip((page - 1) * limit)
      .limit(limit),
    model.countDocuments(filter),
  ]);
  return { data: data as HydratedDocument<T>[], meta: { page, limit, total } };
}
```

`src/shared/zod.ts`:
```ts
import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'ID không hợp lệ');

export const idParamsSchema = z.object({ id: objectIdSchema });
```

- [ ] **Step 5: Chạy test**

Run: `npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add -A .
git commit -m "feat(be): helper mongoose (toJSON, xóa mềm, phân trang), slugify và DB test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Thời gian theo giờ Việt Nam

**Files:**
- Create: `src/shared/time.ts`
- Modify: `src/shared/zod.ts` (thêm `zDateOnly`, `zDateTime`), `src/app.ts` (đặt `json replacer`), `tests/integration/health.test.ts`
- Test: `tests/unit/time.test.ts`

**Interfaces:**
- Produces: `TZ: string`, `toVnIso(date: Date): string`, `parseDateOnly(value: string): Date`, `parseDateTime(value: string): Date`, `vnYearMonthPath(date: Date): string` (`yyyy/MM`), `jsonDateReplacer(this: unknown, key: string, value: unknown): unknown`, `zDateOnly` (zod → Date), `zDateTime` (zod → Date).

- [ ] **Step 1: Viết test (failing)** — `tests/unit/time.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { jsonDateReplacer, parseDateOnly, parseDateTime, toVnIso, vnYearMonthPath } from '../../src/shared/time';
import { zDateOnly } from '../../src/shared/zod';

describe('giờ Việt Nam', () => {
  it('toVnIso đổi sang +07:00 (qua ngày)', () => {
    expect(toVnIso(new Date('2026-10-04T23:30:00Z'))).toBe('2026-10-05T06:30:00+07:00');
  });

  it('parseDateOnly là 00:00 giờ VN', () => {
    expect(parseDateOnly('2026-10-05').toISOString()).toBe('2026-10-04T17:00:00.000Z');
  });

  it('parseDateTime không offset → hiểu là giờ VN; có offset → giữ nguyên', () => {
    expect(parseDateTime('2026-10-05T08:00').toISOString()).toBe('2026-10-05T01:00:00.000Z');
    expect(parseDateTime('2026-10-05T08:00:00Z').toISOString()).toBe('2026-10-05T08:00:00.000Z');
  });

  it('parseDateTime ném lỗi với chuỗi không phải ngày', () => {
    expect(() => parseDateTime('hôm qua')).toThrow();
  });

  it('vnYearMonthPath theo tháng giờ VN', () => {
    expect(vnYearMonthPath(new Date('2026-09-30T18:00:00Z'))).toBe('2026/10');
  });

  it('jsonDateReplacer làm JSON.stringify xuất giờ VN, kể cả lồng nhau', () => {
    const json = JSON.stringify({ at: new Date('2026-10-04T23:30:00Z'), nested: [{ d: new Date(0) }] }, jsonDateReplacer);
    expect(json).toBe('{"at":"2026-10-05T06:30:00+07:00","nested":[{"d":"1970-01-01T07:00:00+07:00"}]}');
  });

  it('zDateOnly từ chối định dạng sai và ngày không tồn tại', () => {
    expect(zDateOnly.safeParse('05/10/2026').success).toBe(false);
    expect(zDateOnly.safeParse('2026-02-30').success).toBe(false);
    expect(zDateOnly.parse('2026-10-05').toISOString()).toBe('2026-10-04T17:00:00.000Z');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/unit/time.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/shared/time.ts`:
```ts
import { isValid } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { env } from '../config/env';

export const TZ = env.APP_TIMEZONE;

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

export function toVnIso(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

export function parseDateOnly(value: string): Date {
  const date = fromZonedTime(`${value}T00:00:00`, TZ);
  if (!isValid(date) || formatInTimeZone(date, TZ, 'yyyy-MM-dd') !== value) {
    throw new Error(`Ngày không hợp lệ: ${value}`);
  }
  return date;
}

export function parseDateTime(value: string): Date {
  const date = HAS_OFFSET.test(value) ? new Date(value) : fromZonedTime(value, TZ);
  if (!isValid(date)) throw new Error(`Thời gian không hợp lệ: ${value}`);
  return date;
}

export function vnYearMonthPath(date: Date): string {
  return formatInTimeZone(date, TZ, 'yyyy/MM');
}

export function jsonDateReplacer(this: unknown, key: string, value: unknown): unknown {
  const raw = (this as Record<string, unknown> | null)?.[key];
  return raw instanceof Date ? toVnIso(raw) : value;
}
```

Thêm vào `src/shared/zod.ts`:
```ts
import { parseDateOnly, parseDateTime } from './time';

export const zDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD')
  .transform((value, ctx) => {
    try {
      return parseDateOnly(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Ngày không tồn tại' });
      return z.NEVER;
    }
  });

export const zDateTime = z.string().transform((value, ctx) => {
  try {
    return parseDateTime(value);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Thời gian không hợp lệ' });
    return z.NEVER;
  }
});
```
(Đặt `import { parseDateOnly, parseDateTime } from './time';` lên đầu file cạnh import zod.)

Trong `src/app.ts`: thêm `import { jsonDateReplacer } from './shared/time';` và dòng `app.set('json replacer', jsonDateReplacer);` ngay sau `app.set('trust proxy', ...)`.

Thêm vào test health đầu tiên: `expect(res.body.data.time).toMatch(/\+07:00$/);`

- [ ] **Step 4: Chạy test**

Run: `npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add -A .
git commit -m "feat(be): xử lý thời gian theo giờ Việt Nam (UTC+7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Vai trò, quyền, phạm vi chi nhánh và model User

**Files:**
- Modify: `src/config/roles.ts` (bổ sung quyền)
- Create: `src/middlewares/authorize.middleware.ts`, `src/utils/phone.ts`, `src/modules/users/user.model.ts`, `src/modules/users/users.validation.ts` (chỉ `passwordSchema`, `usernameSchema`, `phoneSchema` ở task này), `tests/helpers/factories.ts`
- Test: `tests/unit/roles.test.ts`, `tests/unit/authorize.test.ts`, `tests/unit/user.model.test.ts`

**Interfaces:**
- Consumes: `ApiError`, `schemaOptions`, `softDeletePlugin`.
- Produces:
  - `ROLES`, `Role`, `PERMISSIONS: Record<Role, readonly string[]>`, `hasPermission(role, permission): boolean`, `permissionsFor(role): string[]`.
  - `authorize(permission: string, opts?: { branchScoped?: boolean }): RequestHandler` — 401 nếu chưa có `req.user`, 403 `FORBIDDEN` nếu thiếu quyền, gắn `req.scope` khi `branchScoped`.
  - `branchFilter(scope: Express.BranchScope | undefined, field = 'branchId'): Record<string, unknown>` — ném Error nếu `scope` undefined (lỗi lập trình).
  - `assertBranchAccess(scope, branchIds: string | string[]): void` — ném `BRANCH_FORBIDDEN`.
  - `User` model, `IUser`, `UserDoc = HydratedDocument<IUser, IUserMethods>`, `user.verifyPassword(pw): Promise<boolean>`, `hashPassword(pw): Promise<string>`, `USER_STATUSES`.
  - `normalizePhone(input: string): string` — bỏ khoảng trắng, `.`, `-`, `()`; `+84…`/`84…` (11 số) → `0…`.
  - `passwordSchema`, `usernameSchema` (trim + chữ thường, `^[a-z0-9._]{3,30}$`, có ít nhất một chữ cái), `phoneSchema` (chuẩn hóa rồi kiểm tra `^0\d{9}$`).
  - Test helper `createUser(overrides?: { name, username, phone, role, branchIds, password, status }) → Promise<{ user: UserDoc; password: string }>`.

- [ ] **Step 1: Viết test (failing)**

`tests/unit/roles.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { hasPermission } from '../../src/config/roles';

describe('hasPermission', () => {
  it('super_admin có mọi quyền', () => {
    expect(hasPermission('super_admin', 'audit.read')).toBe(true);
    expect(hasPermission('super_admin', 'bat.ky')).toBe(true);
  });

  it('wildcard theo resource', () => {
    expect(hasPermission('consultant', 'appointment.delete')).toBe(true);
  });

  it('chặn quyền không được cấp', () => {
    expect(hasPermission('consultant', 'user.manage')).toBe(false);
    expect(hasPermission('editor', 'setting.manage')).toBe(false);
    expect(hasPermission('branch_manager', 'branch.manage')).toBe(false);
  });

  it('mọi vai trò đọc được cài đặt và chi nhánh', () => {
    for (const role of ['branch_manager', 'consultant', 'editor', 'instructor'] as const) {
      expect(hasPermission(role, 'setting.read')).toBe(true);
      expect(hasPermission(role, 'branch.read')).toBe(true);
    }
  });
});
```

`tests/unit/authorize.test.ts`:
```ts
import type { Request } from 'express';
import { Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { assertBranchAccess, authorize, branchFilter } from '../../src/middlewares/authorize.middleware';
import { ApiError } from '../../src/utils/ApiError';

const A = new Types.ObjectId().toString();
const B = new Types.ObjectId().toString();

function call(user: Express.AuthUser | undefined, permission: string, branchScoped = false) {
  const req = { user } as Request;
  const next = vi.fn();
  authorize(permission, { branchScoped })(req, {} as never, next);
  return { req, err: next.mock.calls[0]?.[0] as ApiError | undefined };
}

describe('authorize', () => {
  it('401 khi chưa đăng nhập', () => {
    expect(call(undefined, 'lead.read').err?.status).toBe(401);
  });

  it('403 FORBIDDEN khi thiếu quyền', () => {
    expect(call({ id: '1', role: 'editor', branchIds: [] }, 'lead.read').err?.code).toBe('FORBIDDEN');
  });

  it('gắn scope theo chi nhánh của user', () => {
    const { req, err } = call({ id: '1', role: 'consultant', branchIds: [A] }, 'lead.read', true);
    expect(err).toBeUndefined();
    expect(req.scope).toEqual({ all: false, branchIds: [A] });
  });

  it('super_admin có scope all', () => {
    const { req } = call({ id: '1', role: 'super_admin', branchIds: [] }, 'lead.read', true);
    expect(req.scope?.all).toBe(true);
  });
});

describe('branchFilter / assertBranchAccess', () => {
  it('lọc theo $in khi không phải all', () => {
    const filter = branchFilter({ all: false, branchIds: [A] }) as { branchId: { $in: Types.ObjectId[] } };
    expect(filter.branchId.$in.map(String)).toEqual([A]);
    expect(branchFilter({ all: true, branchIds: [] })).toEqual({});
  });

  it('ném lỗi lập trình khi route quên branchScoped', () => {
    expect(() => branchFilter(undefined)).toThrow(/branchScoped/);
  });

  it('BRANCH_FORBIDDEN khi chạm chi nhánh khác', () => {
    expect(() => assertBranchAccess({ all: false, branchIds: [A] }, [A, B])).toThrow(
      expect.objectContaining({ code: 'BRANCH_FORBIDDEN' }),
    );
    expect(() => assertBranchAccess({ all: false, branchIds: [A] }, A)).not.toThrow();
    expect(() => assertBranchAccess({ all: true, branchIds: [] }, B)).not.toThrow();
  });
});
```

`tests/unit/user.model.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { User } from '../../src/modules/users/user.model';
import { passwordSchema, phoneSchema, usernameSchema } from '../../src/modules/users/users.validation';
import { normalizePhone } from '../../src/utils/phone';
import { createUser } from '../helpers/factories';

describe('User model', () => {
  it('băm mật khẩu, verifyPassword đúng/sai', async () => {
    const { user, password } = await createUser();
    expect(user.passwordHash).not.toBe(password);
    expect(await user.verifyPassword(password)).toBe(true);
    expect(await user.verifyPassword('sai-mat-khau-1')).toBe(false);
  });

  it('toJSON không lộ passwordHash', async () => {
    const { user } = await createUser();
    expect(user.toJSON()).not.toHaveProperty('passwordHash');
  });

  it('username lưu chữ thường; username và SĐT duy nhất', async () => {
    await User.init();
    await createUser({ username: 'Duyen.Tran', phone: '0779666664' });
    expect(await User.findOne({ username: 'duyen.tran' })).not.toBeNull();
    await expect(createUser({ username: 'duyen.tran' })).rejects.toMatchObject({ code: 11000 });
    await expect(createUser({ phone: '0779666664' })).rejects.toMatchObject({ code: 11000 });
  });

  it('email là tùy chọn', async () => {
    const { user } = await createUser();
    expect(user.email).toBeUndefined();
  });
});

describe('normalizePhone / phoneSchema / usernameSchema', () => {
  it.each([
    ['0779 666 664', '0779666664'],
    ['+84 779.666.664', '0779666664'],
    ['84779666664', '0779666664'],
    ['(0779)-666-664', '0779666664'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
    expect(phoneSchema.parse(input)).toBe(expected);
  });

  it('phoneSchema từ chối số sai độ dài', () => {
    expect(phoneSchema.safeParse('07796666').success).toBe(false);
  });

  it('usernameSchema: chữ thường, cần ít nhất một chữ cái, ký tự hợp lệ', () => {
    expect(usernameSchema.parse(' Duyen.Tran ')).toBe('duyen.tran');
    expect(usernameSchema.safeParse('0779666664').success).toBe(false);
    expect(usernameSchema.safeParse('duyên').success).toBe(false);
    expect(usernameSchema.safeParse('ab').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('yêu cầu ≥ 8 ký tự, có chữ và số', () => {
    expect(passwordSchema.safeParse('abc12345').success).toBe(true);
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse('ab1').success).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/unit/roles.test.ts tests/unit/authorize.test.ts tests/unit/user.model.test.ts`
Expected: FAIL — `hasPermission`/module không tồn tại.

- [ ] **Step 3: Viết code**

`src/config/roles.ts` (thay toàn bộ):
```ts
export const ROLES = ['super_admin', 'branch_manager', 'consultant', 'editor', 'instructor'] as const;
export type Role = (typeof ROLES)[number];

const STAFF_COMMON = ['branch.read', 'setting.read', 'course.read', 'media.read'] as const;

export const PERMISSIONS: Record<Role, readonly string[]> = {
  super_admin: ['*'],
  branch_manager: [
    ...STAFF_COMMON,
    'user.manage',
    'media.upload',
    'pricing.manage',
    'category.manage',
    'post.manage',
    'lead.*',
    'appointment.*',
    'student.*',
    'class.*',
    'instructor.*',
    'vehicle.*',
    'exam.*',
    'tuition.*',
    'dashboard.read',
  ],
  consultant: [
    ...STAFF_COMMON,
    'lead.read',
    'lead.create',
    'lead.update',
    'appointment.*',
    'student.read',
    'student.create',
    'tuition.read',
    'dashboard.read',
  ],
  editor: [...STAFF_COMMON, 'media.upload', 'category.manage', 'post.manage'],
  instructor: [...STAFF_COMMON, 'class.read', 'student.read', 'exam.read'],
};

export function hasPermission(role: Role, permission: string): boolean {
  const [resource] = permission.split('.');
  return PERMISSIONS[role].some((granted) => granted === '*' || granted === permission || granted === `${resource}.*`);
}

export function permissionsFor(role: Role): string[] {
  return [...PERMISSIONS[role]];
}
```

`src/middlewares/authorize.middleware.ts`:
```ts
import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { hasPermission } from '../config/roles';
import { ApiError } from '../utils/ApiError';

export function authorize(permission: string, opts: { branchScoped?: boolean } = {}): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) return next(ApiError.unauthorized());
    if (!hasPermission(user.role, permission)) return next(ApiError.forbidden());
    if (opts.branchScoped) req.scope = { all: user.role === 'super_admin', branchIds: user.branchIds };
    next();
  };
}

export function branchFilter(scope: Express.BranchScope | undefined, field = 'branchId'): Record<string, unknown> {
  if (!scope) throw new Error('Route chưa bật authorize(..., { branchScoped: true })');
  if (scope.all) return {};
  return { [field]: { $in: scope.branchIds.map((id) => new Types.ObjectId(id)) } };
}

export function assertBranchAccess(scope: Express.BranchScope | undefined, branchIds: string | string[]): void {
  if (!scope) throw new Error('Route chưa bật authorize(..., { branchScoped: true })');
  if (scope.all) return;
  const ids = Array.isArray(branchIds) ? branchIds : [branchIds];
  if (ids.some((id) => !scope.branchIds.includes(String(id)))) throw ApiError.branchForbidden();
}
```

`src/modules/users/user.model.ts`:
```ts
import bcrypt from 'bcryptjs';
import { model, Schema, type HydratedDocument, type Model, type Types } from 'mongoose';
import { ROLES, type Role } from '../../config/roles';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface IUser {
  name: string;
  username: string;
  phone: string;
  email?: string;
  passwordHash: string;
  role: Role;
  branchIds: Types.ObjectId[];
  avatarMediaId?: Types.ObjectId | null;
  status: UserStatus;
  lastLoginAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  verifyPassword(password: string): Promise<boolean>;
}

type UserModel = Model<IUser, object, IUserMethods>;
export type UserDoc = HydratedDocument<IUser, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    branchIds: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
    avatarMediaId: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    lastLoginAt: { type: Date, default: null },
  },
  schemaOptions({ hidden: ['passwordHash'] }),
);

userSchema.plugin(softDeletePlugin);
userSchema.index({ role: 1, branchIds: 1 });

userSchema.method('verifyPassword', function verifyPassword(this: UserDoc, password: string) {
  return bcrypt.compare(password, this.passwordHash);
});

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export const User = model<IUser, UserModel>('User', userSchema);
```

`src/utils/phone.ts`:
```ts
export function normalizePhone(input: string): string {
  const digits = input.trim().replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) return `0${digits.slice(3)}`;
  if (digits.startsWith('84') && digits.length === 11) return `0${digits.slice(2)}`;
  return digits;
}
```

`src/modules/users/users.validation.ts`:
```ts
import { z } from 'zod';
import { normalizePhone } from '../../utils/phone';

export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(72, 'Mật khẩu tối đa 72 ký tự')
  .regex(/[A-Za-z]/, 'Mật khẩu phải có chữ cái')
  .regex(/\d/, 'Mật khẩu phải có chữ số');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .regex(/^[a-z0-9._]{3,30}$/, 'Tên đăng nhập 3–30 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới')
      .regex(/[a-z]/, 'Tên đăng nhập phải có ít nhất một chữ cái'),
  );

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^0\d{9}$/, 'Số điện thoại phải có 10 chữ số, bắt đầu bằng 0'));
```

`tests/helpers/factories.ts`:
```ts
import type { Role } from '../../src/config/roles';
import { hashPassword, User, type UserDoc, type UserStatus } from '../../src/modules/users/user.model';

let seq = 0;

export async function createUser(
  overrides: Partial<{
    name: string;
    username: string;
    phone: string;
    role: Role;
    branchIds: string[];
    password: string;
    status: UserStatus;
  }> = {},
): Promise<{ user: UserDoc; password: string }> {
  seq += 1;
  const password = overrides.password ?? 'Matkhau123';
  const user = await User.create({
    name: overrides.name ?? `Nhân viên ${seq}`,
    username: overrides.username ?? `nv${seq}`,
    phone: overrides.phone ?? `09${String(seq).padStart(8, '0')}`,
    role: overrides.role ?? 'super_admin',
    branchIds: overrides.branchIds ?? [],
    status: overrides.status ?? 'active',
    passwordHash: await hashPassword(password),
  });
  return { user, password };
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add -A .
git commit -m "feat(be): vai trò, quyền, phạm vi chi nhánh và model User

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Đăng nhập, refresh xoay vòng, đăng xuất, hồ sơ cá nhân, đổi mật khẩu

**Files:**
- Create: `src/utils/jwt.ts`, `src/utils/crypto.ts`, `src/middlewares/auth.middleware.ts`, `src/middlewares/rateLimit.middleware.ts`, `src/modules/auth/token.model.ts`, `src/modules/auth/auth.validation.ts`, `src/modules/auth/auth.service.ts`, `src/modules/auth/auth.controller.ts`, `src/modules/auth/auth.routes.ts`, `tests/helpers/http.ts`
- Modify: `src/routes/index.ts` (mount `/auth`), `tests/helpers/factories.ts` (thêm `authHeader`)
- Test: `tests/integration/auth.test.ts`

**Interfaces:**
- Consumes: `User`, `hashPassword`, `UserDoc`, `passwordSchema`, `phoneSchema`, `normalizePhone`, `permissionsFor`, `validate/validated`, `sendData`, `ApiError`.
- Produces:
  - `signAccessToken(user: { id: string; role: Role }): string`, `verifyAccessToken(token): { sub: string; role: Role }`.
  - `randomToken(): string`, `sha256(value): string`.
  - `authenticate: RequestHandler` (gắn `req.user = { id, role, branchIds }`).
  - `createRateLimiter({ windowMs, limit, message, skipSuccessfulRequests? }): RequestHandler`.
  - `Token` model (`type: 'refresh'`, `family`, `tokenHash`, `expiresAt`, `revokedAt`).
  - `revokeAllRefreshTokens(userId: string): Promise<void>` (export từ `auth.service`).
  - `REFRESH_COOKIE = 'gt_refresh'`.
  - `createAuthRouter(): Router`.
  - Test helpers: `authHeader(user: UserDoc): { Authorization: string }`, `refreshCookieFrom(res): string | undefined`.

- [ ] **Step 1: Viết helper test và test (failing)**

Thêm vào `tests/helpers/factories.ts`:
```ts
import { signAccessToken } from '../../src/utils/jwt';

export function authHeader(user: UserDoc): { Authorization: string } {
  return { Authorization: `Bearer ${signAccessToken({ id: user.id, role: user.role })}` };
}
```

`tests/helpers/http.ts`:
```ts
import type { Response } from 'supertest';

export function refreshCookieFrom(res: Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.map((cookie) => cookie.split(';')[0]!).find((cookie) => cookie.startsWith('gt_refresh=') && cookie !== 'gt_refresh=');
}
```

`tests/integration/auth.test.ts`:
```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { Token } from '../../src/modules/auth/token.model';
import { authHeader, createUser } from '../helpers/factories';
import { refreshCookieFrom } from '../helpers/http';

let app: ReturnType<typeof createApp>;
beforeEach(() => {
  app = createApp();
});

async function login(identifier: string, password: string) {
  return request(app).post('/api/v1/auth/login').send({ identifier, password });
}

describe('POST /auth/login', () => {
  it('trả access token, user (không có passwordHash) và cookie refresh httpOnly', async () => {
    const { user, password } = await createUser({ username: 'admin' });
    const res = await login('admin', password);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('gt_refresh='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('đăng nhập bằng username (chữ hoa, khoảng trắng) hoặc SĐT (định dạng bất kỳ)', async () => {
    const { password } = await createUser({ username: 'admin', phone: '0779666664' });
    expect((await login('  Admin ', password)).status).toBe(200);
    expect((await login('0779666664', password)).status).toBe(200);
    expect((await login('+84 779.666.664', password)).status).toBe(200);
  });

  it('401 khi sai mật khẩu hoặc tài khoản không tồn tại, cùng một thông báo', async () => {
    await createUser({ username: 'nv_a' });
    const wrong = await login('nv_a', 'Saimatkhau1');
    const missing = await login('khongco', 'Saimatkhau1');
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body.error.message).toBe(missing.body.error.message);
  });

  it('403 khi tài khoản bị khóa', async () => {
    const { password } = await createUser({ username: 'nv_b', status: 'suspended' });
    expect((await login('nv_b', password)).status).toBe(403);
  });

  it('429 RATE_LIMITED sau 5 lần sai trong 15 phút', async () => {
    await createUser({ username: 'nv_c' });
    for (let i = 0; i < 5; i += 1) expect((await login('nv_c', 'Saimatkhau1')).status).toBe(401);
    const res = await login('nv_c', 'Saimatkhau1');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('400 khi thiếu identifier', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('body.identifier');
  });
});

describe('POST /auth/refresh', () => {
  it('xoay vòng token: cookie mới hoạt động, cookie cũ bị coi là tái sử dụng và thu hồi cả family', async () => {
    const { password } = await createUser({ username: 'nv_d' });
    const first = refreshCookieFrom(await login('nv_d', password))!;

    const r1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(r1.status).toBe(200);
    expect(typeof r1.body.data.accessToken).toBe('string');
    const second = refreshCookieFrom(r1)!;
    expect(second).not.toBe(first);

    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(reuse.status).toBe(401);

    const afterReuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', second);
    expect(afterReuse.status).toBe(401);
  });

  it('hai request đồng thời cùng cookie: đúng một request thành công', async () => {
    const { password } = await createUser({ username: 'nv_e' });
    const cookie = refreshCookieFrom(await login('nv_e', password))!;
    const results = await Promise.all([
      request(app).post('/api/v1/auth/refresh').set('Cookie', cookie),
      request(app).post('/api/v1/auth/refresh').set('Cookie', cookie),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it('401 khi không có cookie', async () => {
    expect((await request(app).post('/api/v1/auth/refresh')).status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('thu hồi refresh token và xóa cookie', async () => {
    const { password } = await createUser({ username: 'nv_f' });
    const cookie = refreshCookieFrom(await login('nv_f', password))!;
    const res = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });
});

describe('/auth/me', () => {
  it('401 khi không có hoặc sai token', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer abc')).status).toBe(401);
  });

  it('trả user và danh sách quyền', async () => {
    const { user } = await createUser({ role: 'editor' });
    const res = await request(app).get('/api/v1/auth/me').set(authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe(user.username);
    expect(res.body.data.permissions).toContain('post.manage');
  });

  it('401 khi tài khoản bị khóa sau khi đã cấp token', async () => {
    const { user } = await createUser();
    const headers = authHeader(user);
    user.status = 'suspended';
    await user.save();
    expect((await request(app).get('/api/v1/auth/me').set(headers)).status).toBe(401);
  });

  it('PATCH cập nhật tên/SĐT, không cho đổi role', async () => {
    const { user } = await createUser({ role: 'editor' });
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set(authHeader(user))
      .send({ name: 'Mỹ Duyên', phone: '0779666664', role: 'super_admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Mỹ Duyên');
    expect(res.body.data.user.role).toBe('editor');
  });
});

describe('POST /auth/change-password', () => {
  it('400 khi mật khẩu hiện tại sai', async () => {
    const { user } = await createUser();
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(user))
      .send({ currentPassword: 'Saimatkhau1', newPassword: 'Moimatkhau1' });
    expect(res.status).toBe(400);
  });

  it('đổi thành công, đăng nhập bằng mật khẩu mới, mọi refresh token bị thu hồi', async () => {
    const { user, password } = await createUser({ username: 'nv_g' });
    const cookie = refreshCookieFrom(await login('nv_g', password))!;
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(user))
      .send({ currentPassword: password, newPassword: 'Moimatkhau1' });
    expect(res.status).toBe(204);
    expect((await login('nv_g', 'Moimatkhau1')).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
    expect(await Token.countDocuments({ userId: user._id, type: 'refresh', revokedAt: null })).toBe(1);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/auth.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/utils/crypto.ts`:
```ts
import { createHash, randomBytes } from 'node:crypto';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
```

`src/utils/jwt.ts`:
```ts
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ROLES, type Role } from '../config/roles';

export type AccessPayload = { sub: string; role: Role };

export function signAccessToken(user: { id: string; role: Role }): string {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_ACCESS_EXPIRES_MIN * 60,
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !ROLES.includes(payload.role)) {
    throw new Error('Access token không hợp lệ');
  }
  return { sub: payload.sub, role: payload.role as Role };
}
```

`src/middlewares/rateLimit.middleware.ts`:
```ts
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError';

export function createRateLimiter(opts: {
  windowMs: number;
  limit: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}): RequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: opts.skipSuccessfulRequests ?? false,
    handler: (_req, _res, next) => next(new ApiError(429, 'RATE_LIMITED', opts.message)),
  });
}
```

`src/middlewares/auth.middleware.ts`:
```ts
import type { RequestHandler } from 'express';
import { User } from '../modules/users/user.model';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken, type AccessPayload } from '../utils/jwt';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(ApiError.unauthorized());

  let payload: AccessPayload;
  try {
    payload = verifyAccessToken(header.slice('Bearer '.length));
  } catch {
    return next(ApiError.unauthorized('Phiên đăng nhập đã hết hạn'));
  }

  const user = await User.findById(payload.sub).select('role branchIds status');
  if (!user || user.status !== 'active') return next(ApiError.unauthorized('Tài khoản không còn hiệu lực'));

  req.user = { id: user.id, role: user.role, branchIds: user.branchIds.map(String) };
  next();
};
```

`src/modules/auth/token.model.ts`:
```ts
import { model, Schema, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export const TOKEN_TYPES = ['refresh'] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

export interface IToken {
  userId: Types.ObjectId;
  tokenHash: string;
  type: TokenType;
  family: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const tokenSchema = new Schema<IToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    type: { type: String, enum: TOKEN_TYPES, required: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  schemaOptions({ hidden: ['tokenHash'] }),
);

tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Token = model<IToken>('Token', tokenSchema);
```

`src/modules/auth/auth.validation.ts`:
```ts
import { z } from 'zod';
import { passwordSchema, phoneSchema } from '../users/users.validation';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Vui lòng nhập số điện thoại hoặc tên đăng nhập').max(100),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(200),
});

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: phoneSchema.optional(),
    email: z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ')).optional(),
  })
  .strip();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
```

`src/modules/auth/auth.service.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { addDays } from 'date-fns';
import { env } from '../../config/env';
import { permissionsFor } from '../../config/roles';
import { ApiError } from '../../utils/ApiError';
import { randomToken, sha256 } from '../../utils/crypto';
import { signAccessToken } from '../../utils/jwt';
import { normalizePhone } from '../../utils/phone';
import { hashPassword, User, type UserDoc } from '../users/user.model';
import { Token } from './token.model';
import type { UpdateMeInput } from './auth.validation';

export type Session = { user: UserDoc; accessToken: string; refreshToken: string };

const SESSION_EXPIRED = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';

async function issueRefreshToken(userId: string, family: string): Promise<string> {
  const raw = randomToken();
  await Token.create({
    userId,
    tokenHash: sha256(raw),
    type: 'refresh',
    family,
    expiresAt: addDays(new Date(), env.JWT_REFRESH_EXPIRES_DAYS),
    revokedAt: null,
  });
  return raw;
}

function accessTokenFor(user: UserDoc): string {
  return signAccessToken({ id: user.id, role: user.role });
}

export async function login(identifier: string, password: string): Promise<Session> {
  const user = await User.findOne({
    $or: [{ username: identifier.toLowerCase() }, { phone: normalizePhone(identifier) }],
  });
  if (!user || !(await user.verifyPassword(password))) {
    throw ApiError.unauthorized('Tài khoản hoặc mật khẩu không đúng');
  }
  if (user.status !== 'active') throw ApiError.forbidden('Tài khoản đã bị khóa, vui lòng liên hệ quản trị viên');

  user.lastLoginAt = new Date();
  await user.save();
  const refreshToken = await issueRefreshToken(user.id, randomUUID());
  return { user, accessToken: accessTokenFor(user), refreshToken };
}

export async function refresh(raw: string | undefined): Promise<Session> {
  if (!raw) throw ApiError.unauthorized(SESSION_EXPIRED);
  const tokenHash = sha256(raw);
  const now = new Date();

  const record = await Token.findOneAndUpdate(
    { tokenHash, type: 'refresh', revokedAt: null, expiresAt: { $gt: now } },
    { revokedAt: now },
  );

  if (!record) {
    const reused = await Token.findOne({ tokenHash, type: 'refresh' });
    if (reused?.revokedAt) {
      await Token.updateMany({ family: reused.family, revokedAt: null }, { revokedAt: now });
    }
    throw ApiError.unauthorized(SESSION_EXPIRED);
  }

  const user = await User.findById(record.userId);
  if (!user || user.status !== 'active') throw ApiError.unauthorized(SESSION_EXPIRED);

  const refreshToken = await issueRefreshToken(user.id, record.family);
  return { user, accessToken: accessTokenFor(user), refreshToken };
}

export async function logout(raw: string | undefined): Promise<void> {
  if (!raw) return;
  await Token.updateOne({ tokenHash: sha256(raw), type: 'refresh', revokedAt: null }, { revokedAt: new Date() });
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await Token.updateMany({ userId, type: 'refresh', revokedAt: null }, { revokedAt: new Date() });
}

export async function getMe(userId: string): Promise<{ user: UserDoc; permissions: string[] }> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized();
  return { user, permissions: permissionsFor(user.role) };
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<{ user: UserDoc; permissions: string[] }> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized();
  user.set(input);
  await user.save();
  return { user, permissions: permissionsFor(user.role) };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized();
  if (!(await user.verifyPassword(currentPassword))) {
    throw ApiError.badRequest('Mật khẩu hiện tại không đúng', [{ path: 'body.currentPassword', message: 'Không đúng' }]);
  }
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await revokeAllRefreshTokens(user.id);
}
```

`src/modules/auth/auth.controller.ts`:
```ts
import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env';
import { validated } from '../../middlewares/validate.middleware';
import { sendData } from '../../utils/response';
import * as authService from './auth.service';
import type { ChangePasswordInput, LoginInput, UpdateMeInput } from './auth.validation';

export const REFRESH_COOKIE = 'gt_refresh';

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

function sendSession(res: Response, session: authService.Session): void {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...cookieOptions(),
    maxAge: env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  });
  sendData(res, { accessToken: session.accessToken, user: session.user });
}

function readRefreshCookie(req: Request): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

export async function login(req: Request, res: Response): Promise<void> {
  const { identifier, password } = validated<LoginInput>(req, 'body');
  sendSession(res, await authService.login(identifier, password));
}

export async function refresh(req: Request, res: Response): Promise<void> {
  sendSession(res, await authService.refresh(readRefreshCookie(req)));
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(readRefreshCookie(req));
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  sendData(res, await authService.getMe(req.user!.id));
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  sendData(res, await authService.updateMe(req.user!.id, validated<UpdateMeInput>(req, 'body')));
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = validated<ChangePasswordInput>(req, 'body');
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  res.status(204).end();
}
```

`src/modules/auth/auth.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { createRateLimiter } from '../../middlewares/rateLimit.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './auth.controller';
import { changePasswordSchema, loginSchema, updateMeSchema } from './auth.validation';

export function createAuthRouter(): Router {
  const router = Router();
  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    message: 'Bạn đã thử đăng nhập quá nhiều lần, vui lòng thử lại sau 15 phút',
  });

  router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', authenticate, controller.me);
  router.patch('/me', authenticate, validate({ body: updateMeSchema }), controller.updateMe);
  router.post('/change-password', authenticate, validate({ body: changePasswordSchema }), controller.changePassword);
  return router;
}
```

Trong `src/routes/index.ts`: thêm `import { createAuthRouter } from '../modules/auth/auth.routes';` và `router.use('/auth', createAuthRouter());` sau route `/health`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add -A .
git commit -m "feat(be): đăng nhập JWT, refresh token xoay vòng, hồ sơ và đổi mật khẩu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Audit log

**Files:**
- Create: `src/modules/audit/audit.model.ts`, `src/modules/audit/audit.service.ts`, `src/modules/audit/audit.controller.ts`, `src/modules/audit/audit.routes.ts`
- Modify: `src/routes/index.ts` (mount `/audit`)
- Test: `tests/integration/audit.test.ts`

**Interfaces:**
- Consumes: `authenticate`, `authorize`, `paginate`, `listQuerySchema`, `objectIdSchema`, `zDateOnly`, `sendList`.
- Produces:
  - `recordAudit(entry: { actorId: string; action: string; entity: string; entityId: string; before?: unknown; after?: unknown }): Promise<void>`.
  - `snapshot(doc: { toJSON(): unknown } | null | undefined): unknown`.
  - `AuditLog` model. Quy ước `action` = `<entity>.<động từ>` (vd `branch.create`, `user.status`, `setting.update`).

- [ ] **Step 1: Viết test (failing)** — `tests/integration/audit.test.ts`

```ts
import { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { recordAudit } from '../../src/modules/audit/audit.service';
import { authHeader, createUser } from '../helpers/factories';

describe('GET /audit', () => {
  it('super_admin xem được, lọc theo entity, mới nhất trước', async () => {
    const { user: admin } = await createUser({ role: 'super_admin' });
    const id = new Types.ObjectId().toString();
    await recordAudit({ actorId: admin.id, action: 'branch.create', entity: 'branch', entityId: id, after: { name: 'A' } });
    await recordAudit({ actorId: admin.id, action: 'setting.update', entity: 'setting', entityId: 'hotline' });

    const res = await request(createApp()).get('/api/v1/audit?entity=branch').set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({ action: 'branch.create', entityId: id, after: { name: 'A' } });
    expect(res.body.data[0].at).toMatch(/\+07:00$/);
  });

  it('lọc from/to theo ngày giờ VN', async () => {
    const { user: admin } = await createUser({ role: 'super_admin' });
    await AuditLog.create({
      actorId: admin._id,
      action: 'x.y',
      entity: 'x',
      entityId: '1',
      at: new Date('2026-10-04T18:00:00Z'), // 05/10/2026 01:00 giờ VN
    });
    const app = createApp();
    const included = await request(app).get('/api/v1/audit?from=2026-10-05&to=2026-10-05').set(authHeader(admin));
    const excluded = await request(app).get('/api/v1/audit?to=2026-10-04').set(authHeader(admin));
    expect(included.body.meta.total).toBe(1);
    expect(excluded.body.meta.total).toBe(0);
  });

  it('vai trò khác bị 403', async () => {
    const { user } = await createUser({ role: 'branch_manager', branchIds: [new Types.ObjectId().toString()] });
    expect((await request(createApp()).get('/api/v1/audit').set(authHeader(user))).status).toBe(403);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/audit.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/modules/audit/audit.model.ts`:
```ts
import { model, Schema, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export interface IAuditLog {
  actorId: Types.ObjectId;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  at: Date;
}

const auditSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    at: { type: Date, required: true, default: () => new Date() },
  },
  schemaOptions({ timestamps: false }),
);

auditSchema.index({ entity: 1, entityId: 1, at: -1 });
auditSchema.index({ actorId: 1, at: -1 });
auditSchema.index({ at: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditSchema);
```

`src/modules/audit/audit.service.ts`:
```ts
import { addDays } from 'date-fns';
import type { FilterQuery } from 'mongoose';
import { z } from 'zod';
import { listQuerySchema, paginate } from '../../shared/mongoose/paginate';
import { objectIdSchema, zDateOnly } from '../../shared/zod';
import { AuditLog, type IAuditLog } from './audit.model';

export type AuditEntry = {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

export async function recordAudit(entry: AuditEntry): Promise<void> {
  await AuditLog.create({ ...entry, at: new Date() });
}

export function snapshot(doc: { toJSON(): unknown } | null | undefined): unknown {
  return doc ? doc.toJSON() : undefined;
}

export const listAuditQuerySchema = listQuerySchema.extend({
  entity: z.string().trim().max(50).optional(),
  entityId: z.string().trim().max(100).optional(),
  actor: objectIdSchema.optional(),
  from: zDateOnly.optional(),
  to: zDateOnly.optional(),
});
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;

export async function listAudit(query: ListAuditQuery) {
  const filter: FilterQuery<IAuditLog> = {};
  if (query.entity) filter.entity = query.entity;
  if (query.entityId) filter.entityId = query.entityId;
  if (query.actor) filter.actorId = query.actor;
  if (query.from || query.to) {
    filter.at = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lt: addDays(query.to, 1) } : {}),
    };
  }
  return paginate(AuditLog, filter, query, '-at');
}
```

`src/modules/audit/audit.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendList } from '../../utils/response';
import { listAudit, type ListAuditQuery } from './audit.service';

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await listAudit(validated<ListAuditQuery>(req, 'query')));
}
```

`src/modules/audit/audit.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './audit.controller';
import { listAuditQuerySchema } from './audit.service';

export function createAuditRouter(): Router {
  const router = Router();
  router.get('/', authenticate, authorize('audit.read'), validate({ query: listAuditQuerySchema }), controller.list);
  return router;
}
```

Trong `src/routes/index.ts`: `import { createAuditRouter } from '../modules/audit/audit.routes';` và `router.use('/audit', createAuditRouter());`

- [ ] **Step 4: Chạy test**

Run: `npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add -A .
git commit -m "feat(be): audit log và API tra cứu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Chi nhánh (admin + công khai)

**Files:**
- Create: `src/modules/branches/branch.model.ts`, `branches.validation.ts`, `branches.service.ts`, `branches.controller.ts`, `branches.routes.ts`, `src/modules/public/public.routes.ts`
- Modify: `src/routes/index.ts` (mount `/branches`, `/public`), `tests/helpers/factories.ts` (thêm `createBranch`)
- Test: `tests/integration/branches.test.ts`

**Interfaces:**
- Consumes: `authenticate`, `authorize`, `validate/validated`, `idParamsSchema`, `objectIdSchema`, `paginate`, `listQuerySchema`, `WITH_DELETED`, `slugify`, `escapeRegex`, `recordAudit`, `snapshot`, `User`.
- Produces:
  - `Branch` model, `IBranch`, `BranchDoc`, `BRANCH_STATUSES`.
  - `listBranches(query)`, `getBranch(id)`, `createBranch(actor, input)`, `updateBranch(actor, id, input)`, `removeBranch(actor, id)`, `listPublicBranches()`.
  - `createBranchesRouter()`, `createPublicRouter()` (Task 10 thêm `/settings` vào public router).
  - Test helper `createBranch(overrides?) → Promise<BranchDoc>`.

- [ ] **Step 1: Thêm factory và viết test (failing)**

Thêm vào `tests/helpers/factories.ts`:
```ts
import { Branch, type BranchDoc } from '../../src/modules/branches/branch.model';

let branchSeq = 0;

export async function createBranch(
  overrides: Partial<{ name: string; slug: string; status: 'active' | 'inactive'; order: number }> = {},
): Promise<BranchDoc> {
  branchSeq += 1;
  const name = overrides.name ?? `Chi nhánh ${branchSeq}`;
  return Branch.create({
    name,
    slug: overrides.slug ?? `chi-nhanh-${branchSeq}`,
    officeName: `VP ${name}`,
    address: `Số ${branchSeq}, T. Vĩnh Long`,
    order: overrides.order ?? branchSeq,
    status: overrides.status ?? 'active',
  });
}
```

`tests/integration/branches.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { Branch } from '../../src/modules/branches/branch.model';
import { authHeader, createBranch, createUser } from '../helpers/factories';

const payload = {
  name: 'Tân Ngãi',
  officeName: 'VP1 — Tân Ngãi',
  address: 'Số 331A, P. Tân Ngãi, T. Vĩnh Long',
  openingHours: '7:30–17:30 · T2–T7',
};

describe('admin /branches', () => {
  it('super_admin tạo chi nhánh, slug tự sinh, có audit', async () => {
    const { user: admin } = await createUser();
    const res = await request(createApp()).post('/api/v1/branches').set(authHeader(admin)).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Tân Ngãi', slug: 'tan-ngai', status: 'active' });
    expect(await AuditLog.countDocuments({ action: 'branch.create', entityId: res.body.data.id })).toBe(1);
  });

  it('409 khi trùng slug', async () => {
    const { user: admin } = await createUser();
    await Branch.init();
    await createBranch({ slug: 'tan-ngai' });
    const res = await request(createApp()).post('/api/v1/branches').set(authHeader(admin)).send(payload);
    expect(res.status).toBe(409);
  });

  it('branch_manager không được tạo (403) nhưng đọc được danh sách', async () => {
    const branch = await createBranch();
    const { user } = await createUser({ role: 'branch_manager', branchIds: [branch.id] });
    const app = createApp();
    expect((await request(app).post('/api/v1/branches').set(authHeader(user)).send(payload)).status).toBe(403);
    const list = await request(app).get('/api/v1/branches').set(authHeader(user));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
  });

  it('managerId phải là tài khoản branch_manager', async () => {
    const { user: admin } = await createUser();
    const { user: editor } = await createUser({ role: 'editor' });
    const res = await request(createApp())
      .post('/api/v1/branches')
      .set(authHeader(admin))
      .send({ ...payload, managerId: editor.id });
    expect(res.status).toBe(400);
  });

  it('cập nhật và ghi before/after vào audit', async () => {
    const { user: admin } = await createUser();
    const branch = await createBranch({ name: 'Cũ' });
    const res = await request(createApp())
      .patch(`/api/v1/branches/${branch.id}`)
      .set(authHeader(admin))
      .send({ openingHours: '8:00–17:00 · T2–T6' });
    expect(res.status).toBe(200);
    expect(res.body.data.openingHours).toBe('8:00–17:00 · T2–T6');
    const log = await AuditLog.findOne({ action: 'branch.update' });
    expect(log?.before).toMatchObject({ name: 'Cũ' });
  });

  it('xóa mềm: GET trả 404, không còn trong danh sách', async () => {
    const { user: admin } = await createUser();
    const branch = await createBranch();
    const app = createApp();
    expect((await request(app).delete(`/api/v1/branches/${branch.id}`).set(authHeader(admin))).status).toBe(204);
    expect((await request(app).get(`/api/v1/branches/${branch.id}`).set(authHeader(admin))).status).toBe(404);
    expect((await request(app).get('/api/v1/branches').set(authHeader(admin))).body.meta.total).toBe(0);
  });

  it('ID sai định dạng trả 400, không phải 500', async () => {
    const { user: admin } = await createUser();
    const res = await request(createApp()).get('/api/v1/branches/abc').set(authHeader(admin));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /public/branches', () => {
  it('không cần đăng nhập, chỉ trả chi nhánh active, theo thứ tự', async () => {
    await createBranch({ name: 'B', order: 2 });
    await createBranch({ name: 'A', order: 1 });
    await createBranch({ name: 'Ẩn', status: 'inactive' });
    const res = await request(createApp()).get('/api/v1/public/branches');
    expect(res.status).toBe(200);
    expect(res.body.data.map((b: { name: string }) => b.name)).toEqual(['A', 'B']);
    expect(res.body.data[0]).not.toHaveProperty('managerId');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/branches.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/modules/branches/branch.model.ts`:
```ts
import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const BRANCH_STATUSES = ['active', 'inactive'] as const;

export interface IBranch {
  name: string;
  slug: string;
  officeName: string;
  address: string;
  mapUrl?: string;
  phone?: string;
  managerId?: Types.ObjectId | null;
  openingHours?: string;
  order: number;
  status: (typeof BRANCH_STATUSES)[number];
  deletedAt?: Date | null;
}

export type BranchDoc = HydratedDocument<IBranch>;

const branchSchema = new Schema<IBranch>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    officeName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    mapUrl: { type: String, trim: true },
    phone: { type: String, trim: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    openingHours: { type: String, trim: true },
    order: { type: Number, default: 0 },
    status: { type: String, enum: BRANCH_STATUSES, default: 'active' },
  },
  schemaOptions(),
);

branchSchema.plugin(softDeletePlugin);

export const Branch = model<IBranch>('Branch', branchSchema);
```

`src/modules/branches/branches.validation.ts`:
```ts
import { z } from 'zod';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { objectIdSchema } from '../../shared/zod';
import { BRANCH_STATUSES } from './branch.model';

const fields = {
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang')
    .optional(),
  officeName: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(255),
  mapUrl: z.url().optional(),
  phone: z.string().trim().max(20).optional(),
  managerId: objectIdSchema.nullable().optional(),
  openingHours: z.string().trim().max(100).optional(),
  order: z.number().int().min(0).optional(),
  status: z.enum(BRANCH_STATUSES).optional(),
};

export const createBranchSchema = z.object(fields);
export const updateBranchSchema = z.object(fields).partial();
export const listBranchesQuerySchema = listQuerySchema.extend({ status: z.enum(BRANCH_STATUSES).optional() });

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;
```

`src/modules/branches/branches.service.ts`:
```ts
import type { FilterQuery } from 'mongoose';
import { paginate } from '../../shared/mongoose/paginate';
import { WITH_DELETED } from '../../shared/mongoose/softDelete';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { slugify } from '../../utils/slugify';
import { recordAudit, snapshot } from '../audit/audit.service';
import { User } from '../users/user.model';
import { Branch, type BranchDoc, type IBranch } from './branch.model';
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from './branches.validation';

type Actor = Express.AuthUser;

export async function listBranches(query: ListBranchesQuery) {
  const filter: FilterQuery<IBranch> = {};
  if (query.status) filter.status = query.status;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: pattern }, { officeName: pattern }, { address: pattern }];
  }
  return paginate(Branch, filter, query, 'order');
}

export async function getBranch(id: string): Promise<BranchDoc> {
  const branch = await Branch.findById(id);
  if (!branch) throw ApiError.notFound('Không tìm thấy chi nhánh');
  return branch;
}

async function assertManager(managerId: string | null | undefined): Promise<void> {
  if (!managerId) return;
  if (!(await User.exists({ _id: managerId, role: 'branch_manager' }))) {
    throw ApiError.badRequest('Người quản lý phải là tài khoản quản lý chi nhánh', [
      { path: 'body.managerId', message: 'Không hợp lệ' },
    ]);
  }
}

async function assertSlugFree(slug: string, exceptId?: string): Promise<void> {
  const taken = await Branch.exists({ slug, ...WITH_DELETED, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw ApiError.conflict('Slug chi nhánh đã tồn tại', [{ path: 'body.slug', message: 'Đã tồn tại' }]);
}

export async function createBranch(actor: Actor, input: CreateBranchInput): Promise<BranchDoc> {
  await assertManager(input.managerId);
  const slug = input.slug ?? slugify(input.name);
  await assertSlugFree(slug);
  const branch = await Branch.create({ ...input, slug });
  await recordAudit({ actorId: actor.id, action: 'branch.create', entity: 'branch', entityId: branch.id, after: snapshot(branch) });
  return branch;
}

export async function updateBranch(actor: Actor, id: string, input: UpdateBranchInput): Promise<BranchDoc> {
  const branch = await getBranch(id);
  await assertManager(input.managerId);
  if (input.slug && input.slug !== branch.slug) await assertSlugFree(input.slug, id);
  const before = snapshot(branch);
  branch.set(input);
  await branch.save();
  await recordAudit({ actorId: actor.id, action: 'branch.update', entity: 'branch', entityId: id, before, after: snapshot(branch) });
  return branch;
}

export async function removeBranch(actor: Actor, id: string): Promise<void> {
  const branch = await getBranch(id);
  const before = snapshot(branch);
  branch.deletedAt = new Date();
  await branch.save();
  await recordAudit({ actorId: actor.id, action: 'branch.delete', entity: 'branch', entityId: id, before });
}

export async function listPublicBranches() {
  return Branch.find({ status: 'active' })
    .sort('order name')
    .select('name slug officeName address mapUrl phone openingHours order');
}
```

`src/modules/branches/branches.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './branches.service';
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from './branches.validation';

type IdParams = { id: string };

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listBranches(validated<ListBranchesQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getBranch(validated<IdParams>(req, 'params').id));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createBranch(req.user!, validated<CreateBranchInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updateBranch(req.user!, id, validated<UpdateBranchInput>(req, 'body')));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeBranch(req.user!, validated<IdParams>(req, 'params').id);
  res.status(204).end();
}

export async function listPublic(_req: Request, res: Response): Promise<void> {
  sendData(res, await service.listPublicBranches());
}
```

`src/modules/branches/branches.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './branches.controller';
import { createBranchSchema, listBranchesQuerySchema, updateBranchSchema } from './branches.validation';

export function createBranchesRouter(): Router {
  const router = Router();
  router.use(authenticate);
  router.get('/', authorize('branch.read'), validate({ query: listBranchesQuerySchema }), controller.list);
  router.get('/:id', authorize('branch.read'), validate({ params: idParamsSchema }), controller.get);
  router.post('/', authorize('branch.manage'), validate({ body: createBranchSchema }), controller.create);
  router.patch(
    '/:id',
    authorize('branch.manage'),
    validate({ params: idParamsSchema, body: updateBranchSchema }),
    controller.update,
  );
  router.delete('/:id', authorize('branch.manage'), validate({ params: idParamsSchema }), controller.remove);
  return router;
}
```

`src/modules/public/public.routes.ts`:
```ts
import { Router } from 'express';
import * as branches from '../branches/branches.controller';

export function createPublicRouter(): Router {
  const router = Router();
  router.get('/branches', branches.listPublic);
  return router;
}
```

Trong `src/routes/index.ts`: import `createBranchesRouter`, `createPublicRouter`; thêm `router.use('/branches', createBranchesRouter());` và `router.use('/public', createPublicRouter());`.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add -A .
git commit -m "feat(be): quản lý chi nhánh và API chi nhánh công khai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Quản lý nhân viên (users) có giới hạn theo chi nhánh

**Files:**
- Modify: `src/modules/users/users.validation.ts`, `src/routes/index.ts` (mount `/users`)
- Create: `src/modules/users/users.service.ts`, `users.controller.ts`, `users.routes.ts`
- Test: `tests/integration/users.test.ts`

**Interfaces:**
- Consumes: `User`, `hashPassword`, `UserDoc`, `ROLES`, `Branch`, `recordAudit`, `snapshot`, `revokeAllRefreshTokens`, `randomToken`, `paginate`, `listQuerySchema`, `objectIdSchema`, `escapeRegex`.
- Produces: `listUsers(actor, query)`, `getUser(actor, id)`, `createUser(actor, input)`, `updateUser(actor, id, input)`, `setUserStatus(actor, id, status)`, `resetUserPassword(actor, id): Promise<{ temporaryPassword: string }>`, `removeUser(actor, id)`, `createUsersRouter()`.
- Quy tắc:
  - `branch_manager`/`consultant`/`instructor` bắt buộc ≥ 1 chi nhánh; `super_admin`/`editor` không gán chi nhánh.
  - `branch_manager` chỉ xem người có vai trò `consultant`/`instructor` thuộc **ít nhất một** chi nhánh của mình; chỉ tạo/sửa/khóa/xóa khi **mọi** chi nhánh của người đó (trước và sau khi sửa) nằm trong chi nhánh của mình.
  - Không ai tự đổi vai trò/chi nhánh, tự khóa hoặc tự xóa chính mình.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/users.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { User } from '../../src/modules/users/user.model';
import { authHeader, createBranch, createUser } from '../helpers/factories';

async function setup() {
  const [a, b] = await Promise.all([createBranch({ name: 'A' }), createBranch({ name: 'B' })]);
  const { user: admin } = await createUser({ role: 'super_admin' });
  const { user: managerA } = await createUser({ role: 'branch_manager', branchIds: [a.id] });
  return { app: createApp(), a, b, admin, managerA };
}

const newUser = (extra: Record<string, unknown>) => ({
  name: 'Trần Mỹ Duyên',
  username: `duyen${Math.random().toString(36).slice(2, 8)}`,
  phone: `07${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
  password: 'Matkhau123',
  ...extra,
});

describe('POST /users', () => {
  it('super_admin tạo editor không có chi nhánh; không trả passwordHash; có audit', async () => {
    const { app, admin } = await setup();
    const res = await request(app).post('/api/v1/users').set(authHeader(admin)).send(newUser({ role: 'editor' }));
    expect(res.status).toBe(201);
    expect(res.body.data).not.toHaveProperty('passwordHash');
    expect(await AuditLog.countDocuments({ action: 'user.create' })).toBe(1);
  });

  it('400 khi consultant không có chi nhánh hoặc editor có chi nhánh', async () => {
    const { app, admin, a } = await setup();
    expect((await request(app).post('/api/v1/users').set(authHeader(admin)).send(newUser({ role: 'consultant' }))).status).toBe(400);
    expect(
      (await request(app).post('/api/v1/users').set(authHeader(admin)).send(newUser({ role: 'editor', branchIds: [a.id] }))).status,
    ).toBe(400);
  });

  it('400 khi chi nhánh không tồn tại', async () => {
    const { app, admin } = await setup();
    const res = await request(app)
      .post('/api/v1/users')
      .set(authHeader(admin))
      .send(newUser({ role: 'consultant', branchIds: ['0123456789abcdef01234567'] }));
    expect(res.status).toBe(400);
  });

  it('branch_manager tạo consultant trong chi nhánh mình; chi nhánh khác → BRANCH_FORBIDDEN; vai trò cao → FORBIDDEN', async () => {
    const { app, managerA, a, b } = await setup();
    const ok = await request(app).post('/api/v1/users').set(authHeader(managerA)).send(newUser({ role: 'consultant', branchIds: [a.id] }));
    expect(ok.status).toBe(201);
    const other = await request(app).post('/api/v1/users').set(authHeader(managerA)).send(newUser({ role: 'consultant', branchIds: [b.id] }));
    expect(other.body.error.code).toBe('BRANCH_FORBIDDEN');
    const higher = await request(app)
      .post('/api/v1/users')
      .set(authHeader(managerA))
      .send(newUser({ role: 'branch_manager', branchIds: [a.id] }));
    expect(higher.body.error.code).toBe('FORBIDDEN');
  });

  it('409 khi trùng username hoặc SĐT (SĐT so sánh sau chuẩn hóa)', async () => {
    const { app, admin } = await setup();
    await User.init();
    await createUser({ username: 'trung', phone: '0779666664' });
    const sameUsername = await request(app).post('/api/v1/users').set(authHeader(admin)).send(newUser({ role: 'editor', username: 'Trung' }));
    expect(sameUsername.status).toBe(409);
    const samePhone = await request(app)
      .post('/api/v1/users')
      .set(authHeader(admin))
      .send(newUser({ role: 'editor', phone: '+84 779 666 664' }));
    expect(samePhone.status).toBe(409);
  });

  it('consultant không có quyền quản lý user', async () => {
    const { app, a } = await setup();
    const { user: consultant } = await createUser({ role: 'consultant', branchIds: [a.id] });
    expect((await request(app).get('/api/v1/users').set(authHeader(consultant))).status).toBe(403);
  });
});

describe('GET /users', () => {
  it('branch_manager chỉ thấy consultant/instructor có chi nhánh của mình', async () => {
    const { app, managerA, a, b } = await setup();
    await createUser({ role: 'consultant', branchIds: [a.id], name: 'Của A' });
    await createUser({ role: 'consultant', branchIds: [b.id], name: 'Của B' });
    await createUser({ role: 'consultant', branchIds: [a.id, b.id], name: 'Cả hai' });
    const res = await request(app).get('/api/v1/users?sort=name').set(authHeader(managerA));
    expect(res.status).toBe(200);
    expect(res.body.data.map((u: { name: string }) => u.name).sort()).toEqual(['Cả hai', 'Của A']);
  });

  it('super_admin lọc theo role và tìm theo q', async () => {
    const { app, admin } = await setup();
    await createUser({ role: 'editor', name: 'Biên tập Hoa' });
    const res = await request(app).get('/api/v1/users?role=editor&q=hoa').set(authHeader(admin));
    expect(res.body.meta.total).toBe(1);
  });
});

describe('PATCH /users/:id', () => {
  it('branch_manager không sửa được người thuộc thêm chi nhánh khác (BRANCH_FORBIDDEN)', async () => {
    const { app, managerA, a, b } = await setup();
    const { user: shared } = await createUser({ role: 'consultant', branchIds: [a.id, b.id] });
    const res = await request(app).patch(`/api/v1/users/${shared.id}`).set(authHeader(managerA)).send({ name: 'Đổi tên' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BRANCH_FORBIDDEN');
  });

  it('không tự đổi vai trò của mình', async () => {
    const { app, admin } = await setup();
    const res = await request(app).patch(`/api/v1/users/${admin.id}`).set(authHeader(admin)).send({ role: 'editor' });
    expect(res.status).toBe(400);
  });

  it('đổi vai trò sang editor phải bỏ chi nhánh', async () => {
    const { app, admin, a } = await setup();
    const { user } = await createUser({ role: 'consultant', branchIds: [a.id] });
    expect((await request(app).patch(`/api/v1/users/${user.id}`).set(authHeader(admin)).send({ role: 'editor' })).status).toBe(400);
    const ok = await request(app).patch(`/api/v1/users/${user.id}`).set(authHeader(admin)).send({ role: 'editor', branchIds: [] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.role).toBe('editor');
  });
});

describe('status / reset-password / delete', () => {
  it('khóa tài khoản: token đang dùng bị từ chối; không tự khóa mình', async () => {
    const { app, admin, a } = await setup();
    const { user } = await createUser({ role: 'consultant', branchIds: [a.id] });
    const headers = authHeader(user);
    expect((await request(app).patch(`/api/v1/users/${user.id}/status`).set(authHeader(admin)).send({ status: 'suspended' })).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set(headers)).status).toBe(401);
    expect((await request(app).patch(`/api/v1/users/${admin.id}/status`).set(authHeader(admin)).send({ status: 'suspended' })).status).toBe(400);
  });

  it('reset-password trả mật khẩu tạm đăng nhập được', async () => {
    const { app, admin, a } = await setup();
    const { user } = await createUser({ role: 'consultant', branchIds: [a.id], username: 'nv_tam' });
    const res = await request(app).post(`/api/v1/users/${user.id}/reset-password`).set(authHeader(admin));
    expect(res.status).toBe(200);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'nv_tam', password: res.body.data.temporaryPassword });
    expect(login.status).toBe(200);
  });

  it('xóa mềm: không đăng nhập được, không còn trong danh sách', async () => {
    const { app, admin, a } = await setup();
    const { user, password } = await createUser({ role: 'consultant', branchIds: [a.id], username: 'nv_xoa' });
    expect((await request(app).delete(`/api/v1/users/${user.id}`).set(authHeader(admin))).status).toBe(204);
    expect((await request(app).post('/api/v1/auth/login').send({ identifier: 'nv_xoa', password })).status).toBe(401);
    expect((await request(app).get(`/api/v1/users/${user.id}`).set(authHeader(admin))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/users.test.ts`
Expected: FAIL — route `/users` trả 404.

- [ ] **Step 3: Viết code**

Thêm vào `src/modules/users/users.validation.ts`:
```ts
import { ROLES } from '../../config/roles';
import { listQuerySchema } from '../../shared/mongoose/paginate';
import { objectIdSchema } from '../../shared/zod';
import { USER_STATUSES } from './user.model';

const nameSchema = z.string().trim().min(2).max(100);
const branchIdsSchema = z.array(objectIdSchema).max(20);

export const createUserSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ')).optional(),
  password: passwordSchema,
  role: z.enum(ROLES),
  branchIds: branchIdsSchema.default([]),
});

export const updateUserSchema = z
  .object({
    name: nameSchema,
    username: usernameSchema,
    phone: phoneSchema,
    email: z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ')),
    role: z.enum(ROLES),
    branchIds: branchIdsSchema,
  })
  .partial();

export const userStatusSchema = z.object({ status: z.enum(USER_STATUSES) });

export const listUsersQuerySchema = listQuerySchema.extend({
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  branchId: objectIdSchema.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserStatusInput = z.infer<typeof userStatusSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
```

`src/modules/users/users.service.ts`:
```ts
import { randomBytes } from 'node:crypto';
import { Types, type FilterQuery } from 'mongoose';
import type { Role } from '../../config/roles';
import { paginate } from '../../shared/mongoose/paginate';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { recordAudit, snapshot } from '../audit/audit.service';
import { revokeAllRefreshTokens } from '../auth/auth.service';
import { Branch } from '../branches/branch.model';
import { hashPassword, User, type IUser, type UserDoc, type UserStatus } from './user.model';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.validation';

type Actor = Express.AuthUser;

const MANAGER_ASSIGNABLE: readonly Role[] = ['consultant', 'instructor'];
const BRANCH_REQUIRED: readonly Role[] = ['branch_manager', 'consultant', 'instructor'];

function assertRoleBranches(role: Role, branchIds: string[]): void {
  if (BRANCH_REQUIRED.includes(role) && branchIds.length === 0) {
    throw ApiError.badRequest('Vai trò này phải được gán ít nhất một chi nhánh', [
      { path: 'body.branchIds', message: 'Bắt buộc' },
    ]);
  }
  if (!BRANCH_REQUIRED.includes(role) && branchIds.length > 0) {
    throw ApiError.badRequest('Vai trò này không gán theo chi nhánh', [{ path: 'body.branchIds', message: 'Phải để trống' }]);
  }
}

async function assertBranchesExist(branchIds: string[]): Promise<void> {
  const unique = [...new Set(branchIds)];
  if (unique.length === 0) return;
  if ((await Branch.countDocuments({ _id: { $in: unique } })) !== unique.length) {
    throw ApiError.badRequest('Có chi nhánh không tồn tại', [{ path: 'body.branchIds', message: 'Không tồn tại' }]);
  }
}

function assertActorCanAssign(actor: Actor, role: Role, branchIds: string[]): void {
  if (actor.role === 'super_admin') return;
  if (!MANAGER_ASSIGNABLE.includes(role)) throw ApiError.forbidden('Bạn chỉ được quản lý tư vấn viên và giáo viên');
  if (branchIds.some((id) => !actor.branchIds.includes(id))) throw ApiError.branchForbidden();
}

function assertNotSelf(actor: Actor, targetId: string, message: string): void {
  if (actor.id === targetId) throw ApiError.badRequest(message);
}

function visibilityFilter(actor: Actor): FilterQuery<IUser> {
  if (actor.role === 'super_admin') return {};
  return {
    role: { $in: MANAGER_ASSIGNABLE },
    branchIds: { $in: actor.branchIds.map((id) => new Types.ObjectId(id)) },
  };
}

function branchIdsOf(user: UserDoc): string[] {
  return user.branchIds.map(String);
}

export async function listUsers(actor: Actor, query: ListUsersQuery) {
  const conditions: FilterQuery<IUser>[] = [visibilityFilter(actor)];
  if (query.role) conditions.push({ role: query.role });
  if (query.status) conditions.push({ status: query.status });
  if (query.branchId) conditions.push({ branchIds: new Types.ObjectId(query.branchId) });
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    conditions.push({ $or: [{ name: pattern }, { username: pattern }, { phone: pattern }, { email: pattern }] });
  }
  return paginate(User, { $and: conditions }, query);
}

export async function getUser(actor: Actor, id: string): Promise<UserDoc> {
  const user = await User.findOne({ $and: [{ _id: id }, visibilityFilter(actor)] });
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng');
  return user;
}

async function getManageableUser(actor: Actor, id: string): Promise<UserDoc> {
  const user = await getUser(actor, id);
  assertActorCanAssign(actor, user.role, branchIdsOf(user));
  return user;
}

export async function createUser(actor: Actor, input: CreateUserInput): Promise<UserDoc> {
  assertRoleBranches(input.role, input.branchIds);
  assertActorCanAssign(actor, input.role, input.branchIds);
  await assertBranchesExist(input.branchIds);

  const { password, ...rest } = input;
  const user = await User.create({ ...rest, passwordHash: await hashPassword(password) });
  await recordAudit({ actorId: actor.id, action: 'user.create', entity: 'user', entityId: user.id, after: snapshot(user) });
  return user;
}

export async function updateUser(actor: Actor, id: string, input: UpdateUserInput): Promise<UserDoc> {
  if (input.role !== undefined || input.branchIds !== undefined) {
    assertNotSelf(actor, id, 'Không thể tự đổi vai trò hoặc chi nhánh của mình');
  }
  const user = await getManageableUser(actor, id);
  const nextRole = input.role ?? user.role;
  const nextBranchIds = input.branchIds ?? branchIdsOf(user);
  assertRoleBranches(nextRole, nextBranchIds);
  assertActorCanAssign(actor, nextRole, nextBranchIds);
  await assertBranchesExist(nextBranchIds);

  const before = snapshot(user);
  user.set(input);
  await user.save();
  await recordAudit({ actorId: actor.id, action: 'user.update', entity: 'user', entityId: id, before, after: snapshot(user) });
  return user;
}

export async function setUserStatus(actor: Actor, id: string, status: UserStatus): Promise<UserDoc> {
  assertNotSelf(actor, id, 'Không thể tự khóa hoặc mở khóa tài khoản của mình');
  const user = await getManageableUser(actor, id);
  const before = snapshot(user);
  user.status = status;
  await user.save();
  if (status === 'suspended') await revokeAllRefreshTokens(id);
  await recordAudit({ actorId: actor.id, action: 'user.status', entity: 'user', entityId: id, before, after: snapshot(user) });
  return user;
}

function temporaryPassword(): string {
  return `Gt${randomBytes(6).toString('base64url')}9`;
}

export async function resetUserPassword(actor: Actor, id: string): Promise<{ temporaryPassword: string }> {
  const user = await getManageableUser(actor, id);
  const password = temporaryPassword();
  user.passwordHash = await hashPassword(password);
  await user.save();
  await revokeAllRefreshTokens(id);
  await recordAudit({ actorId: actor.id, action: 'user.reset_password', entity: 'user', entityId: id });
  return { temporaryPassword: password };
}

export async function removeUser(actor: Actor, id: string): Promise<void> {
  assertNotSelf(actor, id, 'Không thể tự xóa tài khoản của mình');
  const user = await getManageableUser(actor, id);
  const before = snapshot(user);
  user.deletedAt = new Date();
  await user.save();
  await revokeAllRefreshTokens(id);
  await recordAudit({ actorId: actor.id, action: 'user.delete', entity: 'user', entityId: id, before });
}
```

`src/modules/users/users.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData, sendList } from '../../utils/response';
import * as service from './users.service';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput, UserStatusInput } from './users.validation';

type IdParams = { id: string };

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await service.listUsers(req.user!, validated<ListUsersQuery>(req, 'query')));
}

export async function get(req: Request, res: Response): Promise<void> {
  sendData(res, await service.getUser(req.user!, validated<IdParams>(req, 'params').id));
}

export async function create(req: Request, res: Response): Promise<void> {
  sendData(res, await service.createUser(req.user!, validated<CreateUserInput>(req, 'body')), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.updateUser(req.user!, id, validated<UpdateUserInput>(req, 'body')));
}

export async function setStatus(req: Request, res: Response): Promise<void> {
  const { id } = validated<IdParams>(req, 'params');
  sendData(res, await service.setUserStatus(req.user!, id, validated<UserStatusInput>(req, 'body').status));
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  sendData(res, await service.resetUserPassword(req.user!, validated<IdParams>(req, 'params').id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.removeUser(req.user!, validated<IdParams>(req, 'params').id);
  res.status(204).end();
}
```

`src/modules/users/users.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../shared/zod';
import * as controller from './users.controller';
import { createUserSchema, listUsersQuerySchema, updateUserSchema, userStatusSchema } from './users.validation';

export function createUsersRouter(): Router {
  const router = Router();
  router.use(authenticate, authorize('user.manage'));
  router.get('/', validate({ query: listUsersQuerySchema }), controller.list);
  router.post('/', validate({ body: createUserSchema }), controller.create);
  router.get('/:id', validate({ params: idParamsSchema }), controller.get);
  router.patch('/:id', validate({ params: idParamsSchema, body: updateUserSchema }), controller.update);
  router.patch('/:id/status', validate({ params: idParamsSchema, body: userStatusSchema }), controller.setStatus);
  router.post('/:id/reset-password', validate({ params: idParamsSchema }), controller.resetPassword);
  router.delete('/:id', validate({ params: idParamsSchema }), controller.remove);
  return router;
}
```

Trong `src/routes/index.ts`: import và `router.use('/users', createUsersRouter());`

- [ ] **Step 4: Chạy test**

Run: `npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add -A .
git commit -m "feat(be): quản lý nhân viên với giới hạn theo chi nhánh

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Cài đặt hệ thống (admin + công khai)

**Files:**
- Create: `src/modules/settings/setting.model.ts`, `settings.schema.ts`, `settings.service.ts`, `settings.controller.ts`, `settings.routes.ts`
- Modify: `src/modules/public/public.routes.ts` (thêm `/settings`), `src/routes/index.ts` (mount `/settings`)
- Test: `tests/integration/settings.test.ts`

**Interfaces:**
- Consumes: `recordAudit`, `authenticate`, `authorize`, `validate/validated`.
- Produces: `settingSchemas` (key → zod), `SettingKey`, `SettingsValues = { [K in SettingKey]?: z.infer<typeof settingSchemas[K]> }`, `PUBLIC_SETTING_KEYS`, `updateSettingsSchema`, `Setting` model, `getSettings(keys?): Promise<SettingsValues>`, `updateSettings(actor, patch): Promise<SettingsValues>`, `createSettingsRouter()`.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/settings.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog } from '../../src/modules/audit/audit.model';
import { authHeader, createBranch, createUser } from '../helpers/factories';

const playbook = [
  { title: 'Tiếp nhận hồ sơ mới', steps: 'Đối chiếu CCCD…', href: '/admin/lich-dang-ky', linkLabel: 'Mở lịch đăng ký' },
];

describe('/settings', () => {
  it('super_admin cập nhật nhiều key, GET trả gộp; mỗi key một audit', async () => {
    const { user: admin } = await createUser();
    const app = createApp();
    const res = await request(app)
      .patch('/api/v1/settings')
      .set(authHeader(admin))
      .send({ hotline: '0779 666 664', supportPlaybook: playbook });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ hotline: '0779 666 664', supportPlaybook: playbook });

    await request(app).patch('/api/v1/settings').set(authHeader(admin)).send({ hotline: '0909 000 000' });
    const get = await request(app).get('/api/v1/settings').set(authHeader(admin));
    expect(get.body.data.hotline).toBe('0909 000 000');
    expect(get.body.data.supportPlaybook).toEqual(playbook);

    const logs = await AuditLog.find({ action: 'setting.update', entityId: 'hotline' }).sort({ _id: 1 });
    expect(logs).toHaveLength(2);
    expect(logs[1]).toMatchObject({ before: '0779 666 664', after: '0909 000 000' });
  });

  it('400 khi key lạ hoặc giá trị sai kiểu', async () => {
    const { user: admin } = await createUser();
    const app = createApp();
    expect((await request(app).patch('/api/v1/settings').set(authHeader(admin)).send({ khongCo: 1 })).status).toBe(400);
    expect((await request(app).patch('/api/v1/settings').set(authHeader(admin)).send({ supportEmail: 'sai' })).status).toBe(400);
  });

  it('nhân viên khác đọc được nhưng không sửa được', async () => {
    const branch = await createBranch();
    const { user } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    const app = createApp();
    expect((await request(app).get('/api/v1/settings').set(authHeader(user))).status).toBe(200);
    expect((await request(app).patch('/api/v1/settings').set(authHeader(user)).send({ hotline: '0909000000' })).status).toBe(403);
  });
});

describe('GET /public/settings', () => {
  it('chỉ trả key công khai', async () => {
    const { user: admin } = await createUser();
    const app = createApp();
    await request(app)
      .patch('/api/v1/settings')
      .set(authHeader(admin))
      .send({ hotline: '0779 666 664', supportPlaybook: playbook });
    const res = await request(app).get('/api/v1/public/settings');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ hotline: '0779 666 664' });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/settings.test.ts`
Expected: FAIL — route 404.

- [ ] **Step 3: Viết code**

`src/modules/settings/settings.schema.ts`:
```ts
import { z } from 'zod';

const labelValue = z.object({
  label: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(100),
});

export const settingSchemas = {
  hotline: z.string().trim().min(8).max(20),
  zaloOa: z.string().trim().min(1).max(100),
  supportEmail: z.email(),
  socials: z.array(z.object({ label: z.string().trim().min(1).max(50), url: z.url() })).max(10),
  supportContacts: z.array(labelValue.extend({ note: z.string().trim().max(255).default('') })).max(20),
  supportPlaybook: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(150),
        steps: z.string().trim().min(1).max(1000),
        href: z.string().regex(/^\/admin(\/[a-z0-9-]*)*$/, 'Đường dẫn phải bắt đầu bằng /admin'),
        linkLabel: z.string().trim().min(1).max(100),
      }),
    )
    .max(20),
  registerNotes: z.array(z.string().trim().min(1).max(500)).max(20),
  consultationContactTimes: z.array(labelValue).max(10),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type SettingsValues = { [K in SettingKey]?: z.infer<(typeof settingSchemas)[K]> };

export const SETTING_KEYS = Object.keys(settingSchemas) as SettingKey[];

export const PUBLIC_SETTING_KEYS: readonly SettingKey[] = [
  'hotline',
  'zaloOa',
  'supportEmail',
  'socials',
  'registerNotes',
  'consultationContactTimes',
];

export const updateSettingsSchema = z.object(settingSchemas).partial().strict();
```

`src/modules/settings/setting.model.ts`:
```ts
import { model, Schema, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export interface ISetting {
  key: string;
  value: unknown;
  updatedBy?: Types.ObjectId | null;
}

const settingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  schemaOptions(),
);

export const Setting = model<ISetting>('Setting', settingSchema);
```

`src/modules/settings/settings.service.ts`:
```ts
import { recordAudit } from '../audit/audit.service';
import { Setting } from './setting.model';
import { SETTING_KEYS, type SettingKey, type SettingsValues } from './settings.schema';

export async function getSettings(keys: readonly SettingKey[] = SETTING_KEYS): Promise<SettingsValues> {
  const rows = await Setting.find({ key: { $in: keys } });
  return Object.fromEntries(rows.map((row) => [row.key, row.value])) as SettingsValues;
}

export async function updateSettings(actor: Express.AuthUser, patch: SettingsValues): Promise<SettingsValues> {
  for (const key of Object.keys(patch) as SettingKey[]) {
    const value = patch[key];
    const previous = await Setting.findOneAndUpdate(
      { key },
      { key, value, updatedBy: actor.id },
      { upsert: true, returnDocument: 'before' },
    );
    await recordAudit({
      actorId: actor.id,
      action: 'setting.update',
      entity: 'setting',
      entityId: key,
      before: previous?.value,
      after: value,
    });
  }
  return getSettings();
}
```

`src/modules/settings/settings.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import { sendData } from '../../utils/response';
import { PUBLIC_SETTING_KEYS, type SettingsValues } from './settings.schema';
import { getSettings, updateSettings } from './settings.service';

export async function get(_req: Request, res: Response): Promise<void> {
  sendData(res, await getSettings());
}

export async function update(req: Request, res: Response): Promise<void> {
  sendData(res, await updateSettings(req.user!, validated<SettingsValues>(req, 'body')));
}

export async function getPublic(_req: Request, res: Response): Promise<void> {
  sendData(res, await getSettings(PUBLIC_SETTING_KEYS));
}
```

`src/modules/settings/settings.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './settings.controller';
import { updateSettingsSchema } from './settings.schema';

export function createSettingsRouter(): Router {
  const router = Router();
  router.use(authenticate);
  router.get('/', authorize('setting.read'), controller.get);
  router.patch('/', authorize('setting.manage'), validate({ body: updateSettingsSchema }), controller.update);
  return router;
}
```

Trong `src/modules/public/public.routes.ts`: `import * as settings from '../settings/settings.controller';` và `router.get('/settings', settings.getPublic);`
Trong `src/routes/index.ts`: `router.use('/settings', createSettingsRouter());`

- [ ] **Step 4: Chạy test**

Run: `npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add -A .
git commit -m "feat(be): cài đặt hệ thống và API cài đặt công khai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Lưu trữ (local / Google Cloud Storage) và upload ảnh

**Files:**
- Create: `src/shared/storage/types.ts`, `local.ts`, `gcs.ts`, `index.ts`, `src/middlewares/upload.middleware.ts`, `src/modules/media/media.model.ts`, `media.service.ts`, `media.controller.ts`, `media.routes.ts`
- Modify: `src/routes/index.ts` (mount `/media`)
- Test: `tests/unit/storage.test.ts`, `tests/integration/media.test.ts`

**Interfaces:**
- Consumes: `env`, `vnYearMonthPath`, `ApiError`, `paginate`, `listQuerySchema`, `escapeRegex`.
- Produces:
  - `interface StorageDriver { put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>; delete(key: string): Promise<void> }`.
  - `LocalStorageDriver(root: string, baseUrl: string)`, `GcsStorageDriver(bucket: BucketLike, baseUrl?: string)`.
  - `getStorage(): StorageDriver`, `setStorage(driver: StorageDriver | undefined): void` (cho test).
  - `uploadImage` (multer, field `file`), `MAX_UPLOAD_BYTES`, `ALLOWED_IMAGE_TYPES`.
  - `Media` model (`key, url, mimeType, size, width, height, alt?, uploadedBy, refs[]`), `uploadMedia(file, alt, actorId)`, `listMedia(query)`, `createMediaRouter()`.

- [ ] **Step 1: Viết test (failing)**

`tests/unit/storage.test.ts`:
```ts
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GcsStorageDriver } from '../../src/shared/storage/gcs';
import { LocalStorageDriver } from '../../src/shared/storage/local';

describe('LocalStorageDriver', () => {
  it('ghi file theo key và trả URL; delete xóa file; chặn key có ..', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'gt-'));
    const driver = new LocalStorageDriver(root, 'http://api.test/uploads/');
    const { url } = await driver.put('2026/10/a.webp', Buffer.from('xin chao'), 'image/webp');
    expect(url).toBe('http://api.test/uploads/2026/10/a.webp');
    expect(await readFile(path.join(root, '2026/10/a.webp'), 'utf8')).toBe('xin chao');
    await driver.delete('2026/10/a.webp');
    await expect(readFile(path.join(root, '2026/10/a.webp'))).rejects.toThrow();
    await expect(driver.put('../x.webp', Buffer.from(''), 'image/webp')).rejects.toThrow();
    await rm(root, { recursive: true, force: true });
  });
});

describe('GcsStorageDriver', () => {
  it('gọi bucket.file(key).save với cache dài hạn và trả URL công khai', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn().mockResolvedValue(undefined);
    const bucket = { name: 'gt-media', file: vi.fn(() => ({ save, delete: del })) };
    const driver = new GcsStorageDriver(bucket);
    const { url } = await driver.put('2026/10/a.webp', Buffer.from('x'), 'image/webp');
    expect(url).toBe('https://storage.googleapis.com/gt-media/2026/10/a.webp');
    expect(save).toHaveBeenCalledWith(
      Buffer.from('x'),
      expect.objectContaining({ contentType: 'image/webp', resumable: false }),
    );
    await driver.delete('2026/10/a.webp');
    expect(del).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it('dùng baseUrl tùy chỉnh (CDN) khi có', async () => {
    const bucket = { name: 'b', file: () => ({ save: async () => undefined, delete: async () => undefined }) };
    const driver = new GcsStorageDriver(bucket, 'https://cdn.giathinh.vn/');
    expect((await driver.put('k.webp', Buffer.from(''), 'image/webp')).url).toBe('https://cdn.giathinh.vn/k.webp');
  });
});
```

`tests/integration/media.test.ts`:
```ts
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { setStorage } from '../../src/shared/storage';
import { LocalStorageDriver } from '../../src/shared/storage/local';
import { authHeader, createBranch, createUser } from '../helpers/factories';

let root: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'gt-media-'));
  setStorage(new LocalStorageDriver(root, 'http://api.test/uploads'));
});
afterAll(async () => {
  setStorage(undefined);
  await rm(root, { recursive: true, force: true });
});

async function bigPng(): Promise<Buffer> {
  return sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#d32f2f' } }).png().toBuffer();
}

describe('POST /media', () => {
  it('editor upload: resize ≤1920, chuyển webp, lưu file, trả bản ghi', async () => {
    const { user } = await createUser({ role: 'editor' });
    const res = await request(createApp())
      .post('/api/v1/media')
      .set(authHeader(user))
      .field('alt', 'Sân tập Tân Ngãi')
      .attach('file', await bigPng(), { filename: 'san-tap.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ mimeType: 'image/webp', width: 1920, height: 640, alt: 'Sân tập Tân Ngãi' });
    expect(res.body.data.key).toMatch(/^\d{4}\/\d{2}\/[\w-]+\.webp$/);
    expect(res.body.data.url).toBe(`http://api.test/uploads/${res.body.data.key}`);
    expect(existsSync(path.join(root, res.body.data.key))).toBe(true);
  });

  it('400 khi khai png nhưng nội dung là text', async () => {
    const { user } = await createUser({ role: 'editor' });
    const res = await request(createApp())
      .post('/api/v1/media')
      .set(authHeader(user))
      .attach('file', Buffer.from('khong phai anh'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 khi sai định dạng (pdf) hoặc thiếu file', async () => {
    const { user } = await createUser({ role: 'editor' });
    const app = createApp();
    const pdf = await request(app)
      .post('/api/v1/media')
      .set(authHeader(user))
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(pdf.status).toBe(400);
    expect((await request(app).post('/api/v1/media').set(authHeader(user)).field('alt', 'x')).status).toBe(400);
  });

  it('400 khi vượt 5MB', async () => {
    const { user } = await createUser({ role: 'editor' });
    const res = await request(createApp())
      .post('/api/v1/media')
      .set(authHeader(user))
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'big.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('5MB');
  });

  it('consultant chỉ xem, không upload', async () => {
    const branch = await createBranch();
    const { user } = await createUser({ role: 'consultant', branchIds: [branch.id] });
    const app = createApp();
    const upload = await request(app)
      .post('/api/v1/media')
      .set(authHeader(user))
      .attach('file', await bigPng(), { filename: 'a.png', contentType: 'image/png' });
    expect(upload.status).toBe(403);
    expect((await request(app).get('/api/v1/media').set(authHeader(user))).status).toBe(200);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/unit/storage.test.ts tests/integration/media.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/shared/storage/types.ts`:
```ts
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}

export function assertSafeKey(key: string): void {
  if (!key || key.startsWith('/') || key.split('/').includes('..')) throw new Error(`Storage key không hợp lệ: ${key}`);
}

export function joinUrl(base: string, key: string): string {
  return `${base.replace(/\/+$/, '')}/${key}`;
}
```

`src/shared/storage/local.ts`:
```ts
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertSafeKey, joinUrl, type StorageDriver } from './types';

export class LocalStorageDriver implements StorageDriver {
  constructor(
    private readonly root: string,
    private readonly baseUrl: string,
  ) {}

  async put(key: string, body: Buffer): Promise<{ url: string }> {
    assertSafeKey(key);
    const file = path.join(this.root, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return { url: joinUrl(this.baseUrl, key) };
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await rm(path.join(this.root, key), { force: true });
  }
}
```

`src/shared/storage/gcs.ts`:
```ts
import { assertSafeKey, joinUrl, type StorageDriver } from './types';

export type BucketLike = {
  name: string;
  file(name: string): {
    save(data: Buffer, options: Record<string, unknown>): Promise<unknown>;
    delete(options?: Record<string, unknown>): Promise<unknown>;
  };
};

export class GcsStorageDriver implements StorageDriver {
  constructor(
    private readonly bucket: BucketLike,
    private readonly baseUrl?: string,
  ) {}

  async put(key: string, body: Buffer, contentType: string): Promise<{ url: string }> {
    assertSafeKey(key);
    await this.bucket.file(key).save(body, {
      contentType,
      resumable: false,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });
    return { url: joinUrl(this.baseUrl ?? `https://storage.googleapis.com/${this.bucket.name}`, key) };
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }
}
```

`src/shared/storage/index.ts`:
```ts
import path from 'node:path';
import { Storage } from '@google-cloud/storage';
import { env } from '../../config/env';
import { GcsStorageDriver } from './gcs';
import { LocalStorageDriver } from './local';
import type { StorageDriver } from './types';

let driver: StorageDriver | undefined;

function createDriver(): StorageDriver {
  if (env.STORAGE_DRIVER === 'gcs') {
    return new GcsStorageDriver(new Storage().bucket(env.GCS_BUCKET!), env.PUBLIC_MEDIA_BASE_URL);
  }
  return new LocalStorageDriver(
    path.resolve(env.UPLOAD_DIR),
    env.PUBLIC_MEDIA_BASE_URL ?? `http://localhost:${env.PORT}/uploads`,
  );
}

export function getStorage(): StorageDriver {
  driver ??= createDriver();
  return driver;
}

export function setStorage(next: StorageDriver | undefined): void {
  driver = next;
}

export type { StorageDriver } from './types';
```

`src/middlewares/upload.middleware.ts`:
```ts
import multer from 'multer';
import { ApiError } from '../utils/ApiError';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP'));
  },
}).single('file');
```

`src/modules/media/media.model.ts`:
```ts
import { model, Schema, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export interface IMedia {
  key: string;
  url: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  alt?: string;
  uploadedBy: Types.ObjectId;
  refs: { entity: string; entityId: string }[];
}

const mediaSchema = new Schema<IMedia>(
  {
    key: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    alt: { type: String, trim: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refs: [{ _id: false, entity: { type: String, required: true }, entityId: { type: String, required: true } }],
  },
  schemaOptions(),
);

export const Media = model<IMedia>('Media', mediaSchema);
```

`src/modules/media/media.service.ts`:
```ts
import { randomUUID } from 'node:crypto';
import type { FilterQuery } from 'mongoose';
import sharp from 'sharp';
import { z } from 'zod';
import { listQuerySchema, paginate, type ListQuery } from '../../shared/mongoose/paginate';
import { getStorage } from '../../shared/storage';
import { vnYearMonthPath } from '../../shared/time';
import { ApiError } from '../../utils/ApiError';
import { escapeRegex } from '../../utils/regex';
import { Media, type IMedia } from './media.model';

export const uploadBodySchema = z.object({ alt: z.string().trim().max(255).optional() });
export const listMediaQuerySchema = listQuerySchema;

async function toWebp(buffer: Buffer) {
  try {
    return await sharp(buffer)
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw ApiError.badRequest('File không phải ảnh hợp lệ');
  }
}

export async function uploadMedia(file: Express.Multer.File | undefined, alt: string | undefined, actorId: string) {
  if (!file) throw ApiError.badRequest('Thiếu file ảnh (trường "file")', [{ path: 'body.file', message: 'Bắt buộc' }]);
  const { data, info } = await toWebp(file.buffer);
  const key = `${vnYearMonthPath(new Date())}/${randomUUID()}.webp`;
  const { url } = await getStorage().put(key, data, 'image/webp');
  return Media.create({
    key,
    url,
    mimeType: 'image/webp',
    size: info.size,
    width: info.width,
    height: info.height,
    alt,
    uploadedBy: actorId,
    refs: [],
  });
}

export async function listMedia(query: ListQuery) {
  const filter: FilterQuery<IMedia> = {};
  if (query.q) filter.alt = new RegExp(escapeRegex(query.q), 'i');
  return paginate(Media, filter, query);
}
```

`src/modules/media/media.controller.ts`:
```ts
import type { Request, Response } from 'express';
import { validated } from '../../middlewares/validate.middleware';
import type { ListQuery } from '../../shared/mongoose/paginate';
import { sendData, sendList } from '../../utils/response';
import { listMedia, uploadMedia } from './media.service';

export async function upload(req: Request, res: Response): Promise<void> {
  const { alt } = validated<{ alt?: string }>(req, 'body');
  sendData(res, await uploadMedia(req.file, alt, req.user!.id), 201);
}

export async function list(req: Request, res: Response): Promise<void> {
  sendList(res, await listMedia(validated<ListQuery>(req, 'query')));
}
```

`src/modules/media/media.routes.ts`:
```ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { uploadImage } from '../../middlewares/upload.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './media.controller';
import { listMediaQuerySchema, uploadBodySchema } from './media.service';

export function createMediaRouter(): Router {
  const router = Router();
  router.use(authenticate);
  router.post('/', authorize('media.upload'), uploadImage, validate({ body: uploadBodySchema }), controller.upload);
  router.get('/', authorize('media.read'), validate({ query: listMediaQuerySchema }), controller.list);
  return router;
}
```

Trong `src/routes/index.ts`: `router.use('/media', createMediaRouter());`

- [ ] **Step 4: Chạy test**

Run: `npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add -A .
git commit -m "feat(be): upload ảnh, resize webp, lưu local hoặc Google Cloud Storage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Seed dữ liệu ban đầu

**Files:**
- Create: `src/scripts/seed-data.ts`, `src/scripts/seed.ts`
- Test: `tests/integration/seed.test.ts`

**Interfaces:**
- Consumes: `Branch`, `WITH_DELETED`, `Setting`, `settingSchemas`, `SettingsValues`, `User`, `hashPassword`, `usernameSchema`, `phoneSchema`, `connectDb`, `disconnectDb`, `env`, `logger`.
- Produces: `seedBranches`, `seedSettings`, `runSeed(opts?: { adminUsername?: string; adminPhone?: string; adminPassword?: string }): Promise<void>` — idempotent, không ghi đè dữ liệu admin đã sửa.

- [ ] **Step 1: Viết test (failing)** — `tests/integration/seed.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { Branch } from '../../src/modules/branches/branch.model';
import { Setting } from '../../src/modules/settings/setting.model';
import { User } from '../../src/modules/users/user.model';
import { runSeed } from '../../src/scripts/seed';

const admin = { adminUsername: 'Admin', adminPhone: '0779 666 664', adminPassword: 'Matkhau123' };

describe('runSeed', () => {
  it('tạo 5 chi nhánh, cài đặt và super_admin; chạy lại không nhân đôi', async () => {
    await runSeed(admin);
    await runSeed(admin);
    expect(await Branch.countDocuments()).toBe(5);
    expect(await User.countDocuments({ role: 'super_admin' })).toBe(1);
    expect(await Setting.countDocuments()).toBe(8);

    const vungLiem = await Branch.findOne({ slug: 'vung-liem' });
    expect(vungLiem).toMatchObject({ officeName: 'VP Vũng Liêm', order: 5 });

    const login = await request(createApp())
      .post('/api/v1/auth/login')
      .send({ identifier: '0779666664', password: 'Matkhau123' });
    expect(login.status).toBe(200);
  });

  it('không ghi đè giá trị admin đã sửa', async () => {
    await runSeed();
    await Setting.updateOne({ key: 'hotline' }, { value: '0909 000 000' });
    await runSeed();
    expect((await Setting.findOne({ key: 'hotline' }))?.value).toBe('0909 000 000');
  });

  it('bỏ qua tạo admin khi thiếu username, SĐT hoặc mật khẩu', async () => {
    await runSeed();
    expect(await User.countDocuments()).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/seed.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Viết code**

`src/scripts/seed-data.ts` (lấy từ `front-end/lib/contact.ts`, `front-end/lib/admin-data.ts`, `front-end/components/consultation-form.tsx`, `front-end/app/page.tsx`):
```ts
import type { IBranch } from '../modules/branches/branch.model';
import type { SettingsValues } from '../modules/settings/settings.schema';

type SeedBranch = Pick<IBranch, 'name' | 'slug' | 'officeName' | 'address' | 'openingHours' | 'order'> & { mapUrl?: string };

export const seedBranches: SeedBranch[] = [
  {
    name: 'Tân Ngãi',
    slug: 'tan-ngai',
    officeName: 'VP1 — Tân Ngãi',
    address: 'Số 331A, P. Tân Ngãi, T. Vĩnh Long',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=331A+T%C3%A2n+Ng%C3%A3i+V%C4%A9nh+Long',
    openingHours: '7:30–17:30 · T2–T7',
    order: 1,
  },
  {
    name: 'Thanh Đức',
    slug: 'thanh-duc',
    officeName: 'VP2 — Thanh Đức',
    address: 'Số 183, P. Thanh Đức, T. Vĩnh Long',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=183+Thanh+%C4%90%E1%BB%A9c+V%C4%A9nh+Long',
    openingHours: '7:30–17:30 · T2–T7',
    order: 2,
  },
  {
    name: 'Long Châu',
    slug: 'long-chau',
    officeName: 'VP3 — Long Châu',
    address: 'Số 15C, đường Phạm Hùng, P. Long Châu, T. Vĩnh Long',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=15C+Ph%E1%BA%A1m+H%C3%B9ng+Long+Ch%C3%A2u+V%C4%A9nh+Long',
    openingHours: '7:30–17:00 · T2–T7',
    order: 3,
  },
  {
    name: 'Phú Quới',
    slug: 'phu-quoi',
    officeName: 'VP4 — Phú Quới',
    address: 'Ấp Long Hòa, xã Phú Quới, T. Vĩnh Long',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Long+Ho%C3%A0+Ph%C3%BA+Qu%E1%BB%9Bi+V%C4%A9nh+Long',
    openingHours: '8:00–17:00 · T2–T6',
    order: 4,
  },
  {
    name: 'Vũng Liêm',
    slug: 'vung-liem',
    officeName: 'VP Vũng Liêm',
    address: 'TT GDTX Vũng Liêm, QL 53, xã Trung Thành, T. Vĩnh Long',
    openingHours: '7:30–17:30 · T2–T7',
    order: 5,
  },
];

export const seedSettings: Required<SettingsValues> = {
  hotline: '0779 666 664',
  zaloOa: 'Gia Thịnh Vĩnh Long',
  supportEmail: 'support@giathinh.vn',
  socials: [],
  supportContacts: [
    { label: 'Hotline tư vấn', value: '0779 666 664', note: '8:00–17:30 hằng ngày, kể cả thứ 7' },
    { label: 'Zalo OA', value: 'Gia Thịnh Vĩnh Long', note: 'Dùng để gửi thông báo lịch ôn và lịch thi' },
    { label: 'Email vận hành', value: 'support@giathinh.vn', note: 'Báo sai lệch dữ liệu, cấp lại tài khoản' },
  ],
  supportPlaybook: [
    {
      title: 'Tiếp nhận hồ sơ mới',
      steps: 'Đối chiếu CCCD, ảnh thẻ và giấy khám sức khỏe, sau đó xếp lịch tư vấn trong Lịch đăng ký.',
      href: '/admin/lich-dang-ky',
      linkLabel: 'Mở lịch đăng ký',
    },
    {
      title: 'Mở lớp khi sắp hết chỗ',
      steps: 'Theo dõi tỷ lệ lấp chỗ ở màn hình Lớp học; lớp còn dưới 10 chỗ thì tạo lớp kế tiếp cùng hạng.',
      href: '/admin/lop-hoc',
      linkLabel: 'Mở danh sách lớp',
    },
    {
      title: 'Đối soát học phí còn nợ',
      steps: 'Lọc hồ sơ quá hạn ở màn hình Học phí, gọi nhắc trước ngày thi tốt nghiệp.',
      href: '/admin/hoc-phi',
      linkLabel: 'Mở sổ học phí',
    },
    {
      title: 'Xử lý bài viết chờ duyệt',
      steps: 'Duyệt tin khai giảng và học phí trước khi xuất bản; bài quá 3 ngày chưa duyệt thì nhắc người phụ trách.',
      href: '/admin/bai-viet',
      linkLabel: 'Mở danh sách bài viết',
    },
  ],
  registerNotes: [
    'Học phí công khai giá gốc — nên đến trực tiếp văn phòng Gia Thịnh để đăng ký.',
    'Đã có GPLX trước đây phải trình báo cho nhân viên tư vấn khi đăng ký.',
    'Đăng ký xong nhớ lấy biên lai và liên hệ Gia Thịnh để vào nhóm Zalo nhận lịch ôn, thi.',
    'Có hỗ trợ ôn kèm luật 1:1 (phí riêng) nếu có nhu cầu.',
  ],
  consultationContactTimes: [
    { label: 'Buổi sáng, 07:00–11:30', value: 'Buổi sáng (07:00–11:30)' },
    { label: 'Buổi chiều, 13:00–17:30', value: 'Buổi chiều (13:00–17:30)' },
    { label: 'Buổi tối, 18:00–21:00', value: 'Buổi tối (18:00–21:00)' },
    { label: 'Liên hệ lúc nào cũng được', value: 'Bất kỳ thời gian nào' },
  ],
};
```

`src/scripts/seed.ts`:
```ts
import { connectDb, disconnectDb } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Branch } from '../modules/branches/branch.model';
import { Setting } from '../modules/settings/setting.model';
import { settingSchemas, type SettingKey } from '../modules/settings/settings.schema';
import { hashPassword, User } from '../modules/users/user.model';
import { phoneSchema, usernameSchema } from '../modules/users/users.validation';
import { WITH_DELETED } from '../shared/mongoose/softDelete';
import { seedBranches, seedSettings } from './seed-data';

export async function runSeed(
  opts: { adminUsername?: string; adminPhone?: string; adminPassword?: string } = {},
): Promise<void> {
  for (const branch of seedBranches) {
    await Branch.updateOne({ slug: branch.slug, ...WITH_DELETED }, { $setOnInsert: branch }, { upsert: true });
  }

  for (const key of Object.keys(seedSettings) as SettingKey[]) {
    const value = settingSchemas[key].parse(seedSettings[key]);
    await Setting.updateOne({ key }, { $setOnInsert: { key, value } }, { upsert: true });
  }

  if (opts.adminUsername && opts.adminPhone && opts.adminPassword) {
    const username = usernameSchema.parse(opts.adminUsername);
    const phone = phoneSchema.parse(opts.adminPhone);
    if (!(await User.exists({ $or: [{ username }, { phone }], ...WITH_DELETED }))) {
      await User.create({
        name: 'Quản trị viên',
        username,
        phone,
        role: 'super_admin',
        branchIds: [],
        passwordHash: await hashPassword(opts.adminPassword),
      });
      logger.info({ username }, 'Đã tạo tài khoản super_admin');
    }
  }
}

if (require.main === module) {
  (async () => {
    await connectDb();
    await runSeed({
      adminUsername: env.SEED_ADMIN_USERNAME,
      adminPhone: env.SEED_ADMIN_PHONE,
      adminPassword: env.SEED_ADMIN_PASSWORD,
    });
    logger.info('Seed xong');
    await disconnectDb();
  })().catch((err: unknown) => {
    logger.fatal({ err }, 'Seed thất bại');
    process.exit(1);
  });
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add -A .
git commit -m "feat(be): seed chi nhánh, cài đặt và tài khoản super_admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Swagger, Docker, README và kiểm tra cuối

**Files:**
- Create: `src/docs/openapi.ts`, `docker-compose.yml`, `Dockerfile` (thay toàn bộ), `.dockerignore` (thay toàn bộ), `README.md` (thay toàn bộ)
- Modify: `src/app.ts` (mount `/api/docs`, `/api/docs.json`)
- Test: `tests/integration/docs.test.ts`

**Interfaces:**
- Produces: `openApiDocument` (OpenAPI 3.0 object).

- [ ] **Step 1: Viết test (failing)** — `tests/integration/docs.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('tài liệu API', () => {
  it('/api/docs.json liệt kê endpoint đợt 1', async () => {
    const res = await request(createApp()).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/health',
        '/auth/login',
        '/auth/refresh',
        '/users',
        '/users/{id}/status',
        '/branches',
        '/settings',
        '/media',
        '/audit',
        '/public/branches',
        '/public/settings',
      ]),
    );
  });

  it('/api/docs/ trả trang Swagger UI', async () => {
    const res = await request(createApp()).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/integration/docs.test.ts`
Expected: FAIL — 404.

- [ ] **Step 3: Viết `src/docs/openapi.ts`**

```ts
type Op = {
  tags: string[];
  summary: string;
  security?: Record<string, string[]>[];
  parameters?: Record<string, unknown>[];
  requestBody?: Record<string, unknown>;
  responses: Record<string, { description: string }>;
};

const bearer = [{ bearerAuth: [] }];
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const listParams = ['page', 'limit', 'sort', 'q'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }));

function json(example: Record<string, unknown>) {
  return { required: true, content: { 'application/json': { example } } };
}

function op(tag: string, summary: string, extra: Partial<Op> = {}, auth = true): Op {
  return {
    tags: [tag],
    summary,
    ...(auth ? { security: bearer } : {}),
    responses: { '200': { description: 'Thành công' }, '4XX': { description: 'Lỗi, xem schema Error' } },
    ...extra,
  };
}

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Gia Thịnh API',
    version: '0.1.0',
    description:
      'Đợt 1 — nền tảng. Thời gian trả về theo giờ Việt Nam (+07:00). Lỗi có dạng { error: { code, message, details? } }.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': { get: op('Hệ thống', 'Kiểm tra trạng thái', {}, false) },
    '/auth/login': {
      post: op('Auth', 'Đăng nhập bằng SĐT hoặc username', { requestBody: json({ identifier: '0779666664', password: 'Matkhau123' }) }, false),
    },
    '/auth/refresh': { post: op('Auth', 'Cấp lại access token (cookie gt_refresh)', {}, false) },
    '/auth/logout': { post: op('Auth', 'Đăng xuất', {}, false) },
    '/auth/me': {
      get: op('Auth', 'Thông tin tài khoản và quyền'),
      patch: op('Auth', 'Sửa hồ sơ', { requestBody: json({ name: 'Mỹ Duyên', phone: '0779666664' }) }),
    },
    '/auth/change-password': {
      post: op('Auth', 'Đổi mật khẩu', { requestBody: json({ currentPassword: 'Matkhau123', newPassword: 'Moimatkhau1' }) }),
    },
    '/users': {
      get: op('Người dùng', 'Danh sách nhân viên', {
        parameters: [...listParams, { name: 'role', in: 'query', schema: { type: 'string' } }],
      }),
      post: op('Người dùng', 'Tạo nhân viên', {
        requestBody: json({
          name: 'Trần Mỹ Duyên',
          username: 'duyen.tran',
          phone: '0779666664',
          password: 'Matkhau123',
          role: 'consultant',
          branchIds: ['<branchId>'],
        }),
      }),
    },
    '/users/{id}': {
      get: op('Người dùng', 'Chi tiết nhân viên', { parameters: [idParam] }),
      patch: op('Người dùng', 'Sửa nhân viên', { parameters: [idParam], requestBody: json({ name: 'Tên mới' }) }),
      delete: op('Người dùng', 'Xóa (mềm) nhân viên', { parameters: [idParam] }),
    },
    '/users/{id}/status': {
      patch: op('Người dùng', 'Khóa/mở khóa', { parameters: [idParam], requestBody: json({ status: 'suspended' }) }),
    },
    '/users/{id}/reset-password': {
      post: op('Người dùng', 'Cấp mật khẩu tạm', { parameters: [idParam] }),
    },
    '/branches': {
      get: op('Chi nhánh', 'Danh sách chi nhánh', { parameters: listParams }),
      post: op('Chi nhánh', 'Tạo chi nhánh', {
        requestBody: json({ name: 'Tân Ngãi', officeName: 'VP1 — Tân Ngãi', address: 'Số 331A, P. Tân Ngãi, T. Vĩnh Long' }),
      }),
    },
    '/branches/{id}': {
      get: op('Chi nhánh', 'Chi tiết chi nhánh', { parameters: [idParam] }),
      patch: op('Chi nhánh', 'Sửa chi nhánh', { parameters: [idParam], requestBody: json({ openingHours: '7:30–17:30 · T2–T7' }) }),
      delete: op('Chi nhánh', 'Xóa (mềm) chi nhánh', { parameters: [idParam] }),
    },
    '/settings': {
      get: op('Cài đặt', 'Đọc cài đặt'),
      patch: op('Cài đặt', 'Cập nhật cài đặt (super_admin)', { requestBody: json({ hotline: '0779 666 664' }) }),
    },
    '/media': {
      get: op('Media', 'Danh sách ảnh', { parameters: listParams }),
      post: op('Media', 'Upload ảnh (multipart: file, alt)', {
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' }, alt: { type: 'string' } },
              },
            },
          },
        },
      }),
    },
    '/audit': {
      get: op('Audit', 'Lịch sử thao tác (super_admin)', {
        parameters: [
          ...listParams,
          ...['entity', 'entityId', 'actor', 'from', 'to'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })),
        ],
      }),
    },
    '/public/branches': { get: op('Công khai', 'Văn phòng/chi nhánh đang hoạt động', {}, false) },
    '/public/settings': { get: op('Công khai', 'Hotline, Zalo, mạng xã hội, lưu ý đăng ký', {}, false) },
  },
};
```

- [ ] **Step 4: Mount trong `src/app.ts`**

Thêm import:
```ts
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './docs/openapi';
```
Thêm ngay sau `app.use('/api/v1', createApiRouter());`:
```ts
  if (env.NODE_ENV !== 'production') {
    app.get('/api/docs.json', (_req, res) => {
      res.json(openApiDocument);
    });
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  }
```

- [ ] **Step 5: Chạy test**

Run: `npx vitest run`
Expected: PASS toàn bộ. Nếu Swagger UI bị helmet CSP chặn khi mở trên trình duyệt, đổi dòng helmet thành `helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false })`.

- [ ] **Step 6: Docker, compose, dockerignore**

`Dockerfile` (thay toàn bộ):
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

`docker-compose.yml` (chỉ MongoDB cho môi trường dev):
```yaml
services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    ports:
      - '27017:27017'
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

`.dockerignore` (thay toàn bộ):
```
node_modules
dist
coverage
uploads
.test-uploads
tests
.env
.env.*
!.env.example
*.log
```

- [ ] **Step 7: README** — `README.md` (thay toàn bộ)

````markdown
# Gia Thịnh — Backend API

API cho website và trang quản trị Trường lái Gia Thịnh. Express 5 + MongoDB + TypeScript.

Thiết kế: `../docs/superpowers/specs/2026-10-03-backend-api-design.md`

## Chạy ở máy dev

```bash
docker compose up -d          # MongoDB ở localhost:27017
cp .env.example .env          # điền JWT_ACCESS_SECRET, SEED_ADMIN_USERNAME, SEED_ADMIN_PHONE, SEED_ADMIN_PASSWORD
npm install
npm run seed                  # chi nhánh, cài đặt, tài khoản super_admin
npm run dev                   # http://localhost:4000/api/v1
```

- Tài liệu API: http://localhost:4000/api/docs
- Kiểm tra: `curl http://localhost:4000/api/v1/health`

## Lệnh

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy dev, tự reload |
| `npm test` | Toàn bộ test (MongoDB trong RAM) |
| `npm run typecheck` / `npm run lint` | Kiểm tra kiểu / lint |
| `npm run build` && `npm start` | Build và chạy bản production |
| `npm run seed` / `npm run seed:prod` | Seed dữ liệu (dev / sau khi build) |

## Tài khoản nhân viên

- Không có đăng ký và không gửi email. Admin tạo tài khoản ở màn Người dùng (`POST /api/v1/users`) và gửi thông tin đăng nhập trực tiếp cho nhân viên.
- Nhân viên đăng nhập bằng **số điện thoại hoặc username** + mật khẩu.
- Quên mật khẩu: liên hệ admin để được cấp mật khẩu tạm (`POST /api/v1/users/:id/reset-password`).

## Lưu ảnh trên Google Cloud Storage

1. Tạo bucket, bật *Uniform bucket-level access*, cấp `allUsers` quyền `Storage Object Viewer` để ảnh xem công khai.
2. Tạo service account có quyền `Storage Object Admin` trên bucket, tải file JSON key.
3. Trong `.env`: `STORAGE_DRIVER=gcs`, `GCS_BUCKET=<tên bucket>`, `GOOGLE_APPLICATION_CREDENTIALS=<đường dẫn file JSON>`.
   Nếu đặt CDN/domain riêng: `PUBLIC_MEDIA_BASE_URL=https://cdn.giathinh.vn`.

## Cấu trúc

`src/modules/<tính năng>/` chứa model, service, controller, routes, validation của từng nghiệp vụ.
Middleware dùng chung ở `src/middlewares/`, helper ở `src/shared/` và `src/utils/`.
````

- [ ] **Step 8: Kiểm tra toàn bộ**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Expected: tất cả pass, có thư mục `dist/` chứa `server.js`.

- [ ] **Step 9: Smoke test với MongoDB thật**

```bash
docker compose up -d
npm run seed
npm run dev
```
Ở terminal khác:
```bash
curl -s http://localhost:4000/api/v1/health
curl -s http://localhost:4000/api/v1/public/branches | head -c 300
curl -s -X POST http://localhost:4000/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"identifier":"<SEED_ADMIN_USERNAME>","password":"<SEED_ADMIN_PASSWORD>"}' | head -c 200
```
Expected: health `{"data":{"status":"ok","time":"…+07:00"}}`; public branches có 5 chi nhánh; login trả `accessToken`.

- [ ] **Step 10: Commit**

```bash
git add -A .
git commit -m "docs(be): Swagger, Dockerfile, docker-compose và README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
