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
  schemaOptions<IAuditLog>({ timestamps: false }),
);

auditSchema.index({ entity: 1, entityId: 1, at: -1 });
auditSchema.index({ actorId: 1, at: -1 });
auditSchema.index({ at: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditSchema);
