import fs from 'node:fs';
import path from 'node:path';
import { openApiDocument } from '../docs/openapi';

// Sinh Postman collection (v2.1) + environment từ openApiDocument.
// Chạy: npm run postman → docs/postman/*.json

type Param = { name: string; in: string; required?: boolean; example?: string };
type Op = {
  tags: string[];
  summary: string;
  security?: unknown[];
  parameters?: Param[];
  requestBody?: { content: Record<string, { example?: unknown; schema?: { properties?: Record<string, { format?: string }> } }> };
};

const OUT_DIR = path.resolve(__dirname, '../../docs/postman');
const DEFAULT_BASE_URL = 'http://localhost:4000/api/v1';

// Biến lưu id theo tên tài nguyên (đoạn đường dẫn) → tên biến Postman
const ID_VARS: Record<string, string> = {
  users: 'userId',
  branches: 'branchId',
  media: 'mediaId',
  courses: 'courseId',
  items: 'pricingItemId',
  categories: 'categoryId',
  posts: 'postId',
  leads: 'leadId',
  appointments: 'appointmentId',
  instructors: 'instructorId',
  vehicles: 'vehicleId',
  classes: 'classId',
  students: 'studentId',
  exams: 'examId',
  candidates: 'candidateId',
  tuition: 'tuitionId',
  payments: 'paymentId',
};

// POST tạo mới → lưu id vào biến; key là đường dẫn, value là [biến, khoá trong data chứa bản ghi]
const SAVE_ID: Record<string, [string, string?]> = {
  '/users': ['userId'],
  '/branches': ['branchId'],
  '/media': ['mediaId'],
  '/courses': ['courseId'],
  '/pricing/items': ['pricingItemId'],
  '/categories': ['categoryId'],
  '/posts': ['postId'],
  '/leads': ['leadId'],
  '/appointments': ['appointmentId'],
  '/instructors': ['instructorId'],
  '/vehicles': ['vehicleId'],
  '/classes': ['classId'],
  '/students': ['studentId'],
  '/leads/{id}/convert': ['studentId', 'student'],
  '/exams': ['examId'],
  '/tuition': ['tuitionId'],
  '/tuition/{id}/payments': ['paymentId', 'payment'],
};

function idVarFor(pathStr: string, param: string): string {
  if (param !== 'id') return param;
  const segments = pathStr.split('/').filter(Boolean);
  const idx = segments.indexOf('{id}');
  return ID_VARS[segments[idx - 1] ?? ''] ?? 'id';
}

// '<branchId>' trong ví dụ → '{{branchId}}'
function withVars(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value).replace(/"<([A-Za-z]+)>"/g, '"{{$1}}"'));
}

function buildUrl(pathStr: string, params: Param[]) {
  const raw = pathStr.replace(/\{(\w+)\}/g, ':$1');
  const query = params
    .filter((p) => p.in === 'query')
    .map((p) => ({ key: p.name, value: p.example ?? '', disabled: !p.required }));
  const variable = params
    .filter((p) => p.in === 'path')
    .map((p) => ({ key: p.name, value: `{{${idVarFor(pathStr, p.name)}}}` }));
  return {
    raw: `{{baseUrl}}${raw}`,
    host: ['{{baseUrl}}'],
    path: raw.split('/').filter(Boolean),
    ...(query.length ? { query } : {}),
    ...(variable.length ? { variable } : {}),
  };
}

function buildBody(op: Op) {
  const content = op.requestBody?.content;
  if (!content) return undefined;
  if (content['application/json']) {
    return {
      mode: 'raw',
      raw: JSON.stringify(withVars(content['application/json'].example ?? {}), null, 2),
      options: { raw: { language: 'json' } },
    };
  }
  const form = content['multipart/form-data'];
  if (form) {
    return {
      mode: 'formdata',
      formdata: Object.entries(form.schema?.properties ?? {}).map(([key, prop]) =>
        prop.format === 'binary' ? { key, type: 'file', src: [] } : { key, type: 'text', value: '' },
      ),
    };
  }
  return undefined;
}

function testScript(pathStr: string, method: string): string[] | undefined {
  // GET danh sách: lấy id bản ghi đầu tiên nếu biến còn trống (dữ liệu seed sẵn có)
  if (method === 'get' && SAVE_ID[pathStr] && !pathStr.includes('{')) {
    const [variable] = SAVE_ID[pathStr];
    return [
      `if (pm.response.code === 200 && !pm.collectionVariables.get('${variable}')) {`,
      '  const first = (pm.response.json().data || [])[0];',
      `  if (first && first.id) pm.collectionVariables.set('${variable}', first.id);`,
      '}',
    ];
  }
  if (method !== 'post') return undefined;
  if (pathStr === '/auth/login' || pathStr === '/auth/refresh') {
    return [
      'const body = pm.response.json();',
      'if (body.data && body.data.accessToken) {',
      "  pm.collectionVariables.set('accessToken', body.data.accessToken);",
      '}',
    ];
  }
  const save = SAVE_ID[pathStr];
  if (!save) return undefined;
  const [variable, key] = save;
  const pick = key ? `(body.data && body.data.${key}) || body.data` : 'body.data';
  return [
    'if (pm.response.code < 300) {',
    `  const record = (() => { const body = pm.response.json(); return ${pick}; })();`,
    `  if (record && record.id) pm.collectionVariables.set('${variable}', record.id);`,
    '}',
  ];
}

function buildItem(pathStr: string, method: string, op: Op) {
  const params = op.parameters ?? [];
  const body = buildBody(op);
  const exec = testScript(pathStr, method);
  return {
    name: `${op.summary}`,
    request: {
      method: method.toUpperCase(),
      ...(op.security ? {} : { auth: { type: 'noauth' } }),
      header: body?.mode === 'raw' ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      url: buildUrl(pathStr, params),
      ...(body ? { body } : {}),
      description: `${method.toUpperCase()} /api/v1${pathStr}`,
    },
    ...(exec ? { event: [{ listen: 'test', script: { type: 'text/javascript', exec } }] } : {}),
    response: [],
  };
}

export function buildCollection() {
  const folders = new Map<string, Map<string, unknown[]>>();
  const paths = openApiDocument.paths as Record<string, Record<string, Op>>;
  for (const [pathStr, ops] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(ops)) {
      const tag = op.tags[0] ?? 'Khác';
      const resource = pathStr.split('/').filter(Boolean)[0] ?? '';
      const byResource = folders.get(tag) ?? new Map<string, unknown[]>();
      folders.set(tag, byResource);
      const items = byResource.get(resource) ?? [];
      byResource.set(resource, items);
      items.push(buildItem(pathStr, method, op));
    }
  }

  const item = [...folders].map(([tag, byResource]) => ({
    name: tag,
    item:
      byResource.size === 1
        ? [...byResource.values()][0]
        : [...byResource].map(([resource, items]) => ({ name: resource, item: items })),
  }));

  const idVariables = [...new Set([...Object.values(ID_VARS), 'slug'])].map((key) => ({ key, value: '' }));

  return {
    info: {
      name: openApiDocument.info.title,
      description:
        'Sinh tự động từ src/docs/openapi.ts (npm run postman). Chạy "Auth → Đăng nhập" trước: access token tự lưu vào biến accessToken; cookie gt_refresh do Postman giữ cho "Cấp lại access token". Các request tạo mới tự lưu id (userId, branchId, …) để dùng ở request sau.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
    variable: [
      { key: 'baseUrl', value: DEFAULT_BASE_URL },
      { key: 'identifier', value: 'admin' },
      { key: 'password', value: '' },
      { key: 'accessToken', value: '' },
      ...idVariables,
    ],
    item,
  };
}

export function buildEnvironment() {
  return {
    name: 'Gia Thịnh — local',
    values: [
      { key: 'baseUrl', value: DEFAULT_BASE_URL, type: 'default', enabled: true },
      { key: 'identifier', value: 'admin', type: 'default', enabled: true },
      { key: 'password', value: '', type: 'secret', enabled: true },
    ],
  };
}

if (require.main === module) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const collection = buildCollection();
  // Đăng nhập dùng biến môi trường thay cho ví dụ cứng
  const login = JSON.stringify(collection).replace(
    JSON.stringify(JSON.stringify({ identifier: '0779666664', password: 'Matkhau123' }, null, 2)),
    JSON.stringify(JSON.stringify({ identifier: '{{identifier}}', password: '{{password}}' }, null, 2)),
  );
  fs.writeFileSync(path.join(OUT_DIR, 'gia-thinh-api.postman_collection.json'), JSON.stringify(JSON.parse(login), null, 2) + '\n');
  fs.writeFileSync(
    path.join(OUT_DIR, 'gia-thinh-local.postman_environment.json'),
    JSON.stringify(buildEnvironment(), null, 2) + '\n',
  );
  console.log(`Đã ghi Postman collection vào ${path.relative(process.cwd(), OUT_DIR)}/`);
}
