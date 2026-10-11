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
