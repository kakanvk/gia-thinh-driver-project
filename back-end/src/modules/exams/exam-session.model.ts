import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const EXAM_TYPES = ['graduation', 'official'] as const;
export const EXAM_SESSION_STATUSES = ['scheduled', 'done', 'cancelled'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export interface IExamSession {
  code: string;
  type: ExamType;
  courseId: Types.ObjectId;
  courseCode: string;
  branchId: Types.ObjectId;
  date: Date;
  location?: string | null;
  status: (typeof EXAM_SESSION_STATUSES)[number];
  note?: string | null;
  deletedAt?: Date | null;
}

export type ExamSessionDoc = HydratedDocument<IExamSession>;

const examSessionSchema = new Schema<IExamSession>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, enum: EXAM_TYPES, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseCode: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    date: { type: Date, required: true },
    location: { type: String, trim: true, default: null },
    status: { type: String, enum: EXAM_SESSION_STATUSES, default: 'scheduled' },
    note: { type: String, trim: true, default: null },
  },
  schemaOptions<IExamSession>(),
);

examSessionSchema.plugin(softDeletePlugin);
examSessionSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { deletedAt: { $type: 'null' } } });
examSessionSchema.index({ branchId: 1, date: -1 });
examSessionSchema.index({ status: 1, date: 1 });

export const ExamSession = model<IExamSession>('ExamSession', examSessionSchema);
