import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const STUDENT_STATUSES = ['studying', 'paused', 'completed', 'dropped'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export interface IStudent {
  code: string;
  name: string;
  phone: string;
  email?: string | null;
  dob?: Date | null;
  idNumber?: string | null;
  address?: string | null;
  courseId: Types.ObjectId;
  courseCode: string;
  branchId: Types.ObjectId;
  classId: Types.ObjectId | null;
  leadId?: Types.ObjectId | null;
  status: StudentStatus;
  enrolledAt: Date;
  note?: string | null;
  deletedAt?: Date | null;
}

export type StudentDoc = HydratedDocument<IStudent>;

const studentSchema = new Schema<IStudent>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: null },
    dob: { type: Date, default: null },
    idNumber: { type: String, trim: true, default: null },
    address: { type: String, trim: true, default: null },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseCode: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'TrainingClass', default: null },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    status: { type: String, enum: STUDENT_STATUSES, default: 'studying' },
    enrolledAt: { type: Date, required: true },
    note: { type: String, trim: true, default: null },
  },
  schemaOptions<IStudent>(),
);

studentSchema.plugin(softDeletePlugin);
// Unique only among live rows so a CCCD can be reused after a soft delete.
studentSchema.index(
  { idNumber: 1 },
  { unique: true, partialFilterExpression: { idNumber: { $type: 'string' }, deletedAt: { $type: 'null' } } },
);
studentSchema.index({ branchId: 1, status: 1, createdAt: -1 });
studentSchema.index({ classId: 1, status: 1 });
studentSchema.index({ phone: 1 });

export const Student = model<IStudent>('Student', studentSchema);
