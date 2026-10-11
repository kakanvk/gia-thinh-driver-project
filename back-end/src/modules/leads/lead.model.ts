import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';
import { LEAD_STATUSES, type LeadStatus } from './lead.status';

export { LEAD_STATUSES, type LeadStatus };

export const LEAD_SOURCES = ['website', 'facebook', 'tiktok', 'zalo', 'referral', 'walk_in', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export interface ILeadUtm {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface ILead {
  code: string;
  name: string;
  phone: string;
  email?: string | null;
  courseId: Types.ObjectId | null;
  courseCode: string | null;
  branchId: Types.ObjectId;
  preferredContactTime?: string | null;
  note?: string | null;
  source: LeadSource;
  utm?: ILeadUtm | null;
  status: LeadStatus;
  lostReason?: string | null;
  assigneeId?: Types.ObjectId | null;
  nextFollowUpAt?: Date | null;
  studentId?: Types.ObjectId | null;
  lastActivityAt: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LeadDoc = HydratedDocument<ILead>;

const utmSchema = new Schema<ILeadUtm>(
  { source: String, medium: String, campaign: String, term: String, content: String },
  { _id: false },
);

const leadSchema = new Schema<ILead>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: null },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
    courseCode: { type: String, default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    preferredContactTime: { type: String, trim: true, default: null },
    note: { type: String, trim: true, default: null },
    source: { type: String, enum: LEAD_SOURCES, required: true },
    utm: { type: utmSchema, default: null },
    status: { type: String, enum: LEAD_STATUSES, default: 'new' },
    lostReason: { type: String, trim: true, default: null },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    nextFollowUpAt: { type: Date, default: null },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', default: null },
    lastActivityAt: { type: Date, required: true, default: () => new Date() },
  },
  schemaOptions<ILead>(),
);

leadSchema.plugin(softDeletePlugin);
leadSchema.index({ branchId: 1, status: 1, createdAt: -1 });
leadSchema.index({ phone: 1, branchId: 1 });
leadSchema.index({ assigneeId: 1, status: 1 });
leadSchema.index({ nextFollowUpAt: 1 });

export const Lead = model<ILead>('Lead', leadSchema);
