import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const INSTRUCTOR_STATUSES = ['active', 'on_leave', 'inactive'] as const;
export type InstructorStatus = (typeof INSTRUCTOR_STATUSES)[number];

export interface IInstructor {
  name: string;
  phone: string;
  userId: Types.ObjectId | null;
  specialties: string[];
  branchId: Types.ObjectId;
  status: InstructorStatus;
  note?: string | null;
  deletedAt?: Date | null;
}

export type InstructorDoc = HydratedDocument<IInstructor>;

const instructorSchema = new Schema<IInstructor>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    specialties: { type: [String], default: [] },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    status: { type: String, enum: INSTRUCTOR_STATUSES, default: 'active' },
    note: { type: String, trim: true, default: null },
  },
  schemaOptions<IInstructor>(),
);

instructorSchema.plugin(softDeletePlugin);
instructorSchema.index({ branchId: 1, status: 1 });
instructorSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });

export const Instructor = model<IInstructor>('Instructor', instructorSchema);
