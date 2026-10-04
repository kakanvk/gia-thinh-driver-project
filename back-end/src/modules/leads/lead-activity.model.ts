import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { LEAD_STATUSES, type LeadStatus } from './lead.status';

export const ACTIVITY_TYPES = [
  'created',
  'updated',
  'status_change',
  'assign',
  'form_resubmit',
  'appointment',
  'call',
  'note',
  'sms',
  'meeting',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const MANUAL_ACTIVITY_TYPES = ['call', 'note', 'sms', 'meeting'] as const;

export interface ILeadActivity {
  leadId: Types.ObjectId;
  type: ActivityType;
  fromStatus?: LeadStatus | null;
  toStatus?: LeadStatus | null;
  content?: string | null;
  byUserId?: Types.ObjectId | null;
  at: Date;
}

const leadActivitySchema = new Schema<ILeadActivity>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    fromStatus: { type: String, enum: [...LEAD_STATUSES, null], default: null },
    toStatus: { type: String, enum: [...LEAD_STATUSES, null], default: null },
    content: { type: String, default: null },
    byUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, required: true, default: () => new Date() },
  },
  schemaOptions<ILeadActivity>({ timestamps: false }),
);

leadActivitySchema.index({ leadId: 1, at: -1 });

export const LeadActivity = model<ILeadActivity>('LeadActivity', leadActivitySchema);

export type LeadActivityDoc = HydratedDocument<ILeadActivity>;
