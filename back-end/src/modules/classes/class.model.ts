import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const CLASS_STATUSES = ['enrolling', 'upcoming', 'ongoing', 'finished'] as const;
export type ClassStatus = (typeof CLASS_STATUSES)[number];
export const ACTIVE_CLASS_STATUSES: ClassStatus[] = ['enrolling', 'upcoming', 'ongoing'];
export const SEATED_STUDENT_STATUSES = ['studying', 'paused', 'completed'];

export interface ITrainingClass {
  code: string;
  courseId: Types.ObjectId;
  courseCode: string;
  transmission: 'manual' | 'automatic' | null;
  branchId: Types.ObjectId;
  instructorId: Types.ObjectId | null;
  startDate: Date;
  endDate: Date;
  scheduleText: string;
  capacity: number;
  status: ClassStatus;
  note?: string | null;
  deletedAt?: Date | null;
}

export type TrainingClassDoc = HydratedDocument<ITrainingClass>;

const classSchema = new Schema<ITrainingClass>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseCode: { type: String, required: true },
    transmission: { type: String, enum: ['manual', 'automatic', null], default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    instructorId: { type: Schema.Types.ObjectId, ref: 'Instructor', default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    scheduleText: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, max: 200 },
    status: { type: String, enum: CLASS_STATUSES, default: 'enrolling' },
    note: { type: String, trim: true, default: null },
  },
  schemaOptions<ITrainingClass>(),
);

classSchema.plugin(softDeletePlugin);
classSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { deletedAt: { $type: 'null' } } });
classSchema.index({ branchId: 1, status: 1, startDate: 1 });
classSchema.index({ instructorId: 1, status: 1 });

export const TrainingClass = model<ITrainingClass>('TrainingClass', classSchema);
