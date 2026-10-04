import type { FilterQuery } from 'mongoose';
import { z } from 'zod';
import { addFixedDays } from '../../shared/time';
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
      ...(query.to ? { $lt: addFixedDays(query.to, 1) } : {}),
    };
  }
  return paginate(AuditLog, filter, query, '-at');
}
