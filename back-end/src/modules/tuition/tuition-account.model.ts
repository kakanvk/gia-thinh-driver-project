import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import type { Discount, Installment, TuitionStatus } from './tuition.calc';

export const TUITION_STATUSES = ['paid', 'partial', 'overdue'] as const;
export const TUITION_PLANS = ['one_time', 'installments'] as const;
export const DEFAULT_DUE_DAYS = 14;

export interface ITuitionAccount {
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  courseCode: string;
  branchId: Types.ObjectId;
  listPrice: number;
  priceNote: string | null;
  discounts: Discount[];
  total: number;
  plan: (typeof TUITION_PLANS)[number];
  installments: Installment[];
  paidAmount: number;
  status: TuitionStatus;
  lastPaymentAt: Date | null;
  note: string | null;
  archived: boolean;
}

export type TuitionAccountDoc = HydratedDocument<ITuitionAccount>;

const tuitionAccountSchema = new Schema<ITuitionAccount>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseCode: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    listPrice: { type: Number, required: true, min: 0 },
    priceNote: { type: String, default: null },
    discounts: {
      type: [
        new Schema<Discount>(
          { label: { type: String, required: true }, amount: { type: Number, required: true, min: 0 } },
          { _id: false },
        ),
      ],
      default: [],
    },
    total: { type: Number, required: true, min: 0 },
    plan: { type: String, enum: TUITION_PLANS, default: 'one_time' },
    installments: {
      type: [
        new Schema<Installment>(
          { dueDate: { type: Date, required: true }, amount: { type: Number, required: true, min: 1 } },
          { _id: false },
        ),
      ],
      default: [],
    },
    paidAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: TUITION_STATUSES, default: 'partial' },
    lastPaymentAt: { type: Date, default: null },
    note: { type: String, default: null },
    archived: { type: Boolean, default: false },
  },
  schemaOptions<ITuitionAccount>(),
);

tuitionAccountSchema.index({ branchId: 1, status: 1 });

export const TuitionAccount = model<ITuitionAccount>('TuitionAccount', tuitionAccountSchema);
