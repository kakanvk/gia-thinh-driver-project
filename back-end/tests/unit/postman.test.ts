import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../../src/docs/openapi';
import { buildCollection } from '../../src/scripts/postman';

type Item = { name: string; item?: Item[]; request?: { method: string; url: { raw: string } }; event?: unknown[] };

function requests(items: Item[]): Item[] {
  return items.flatMap((item) => (item.item ? requests(item.item) : [item]));
}

describe('Postman collection', () => {
  const collection = buildCollection();
  const all = requests(collection.item as Item[]);

  it('có đủ mọi endpoint trong OpenAPI', () => {
    const opCount = Object.values(openApiDocument.paths).reduce((sum, ops) => sum + Object.keys(ops).length, 0);
    expect(all).toHaveLength(opCount);
  });

  it('thay placeholder <xxxId> bằng biến Postman', () => {
    expect(JSON.stringify(collection)).not.toMatch(/"<[A-Za-z]+>"/);
    expect(JSON.stringify(collection)).toContain('{{branchId}}');
  });

  it('đăng nhập tự lưu access token', () => {
    const login = all.find((item) => item.request?.url.raw === '{{baseUrl}}/auth/login');
    expect(JSON.stringify(login?.event)).toContain("pm.collectionVariables.set('accessToken'");
  });

  it('đường dẫn có :id dùng biến id theo tài nguyên', () => {
    const payment = all.find((item) => item.request?.url.raw === '{{baseUrl}}/tuition/:id/payments/:paymentId');
    expect(JSON.stringify(payment?.request)).toContain('{{tuitionId}}');
    expect(JSON.stringify(payment?.request)).toContain('{{paymentId}}');
  });
});
