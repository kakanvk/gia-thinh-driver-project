import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export const PAYMENT_METHODS = ['cash', 'transfer'] as const;

export interface IPayment {
  tuitionAccountId: Types.ObjectId;
  studentId: Types.ObjectId;
  branchId: Types.ObjectId;
  courseCode: string;
  amount: number;
  method: (typeof PAYMENT_METHODS)[number];
  paidAt: Date;
  receivedBy: Types.ObjectId;
  receiptNo: string;
  note: string | null;
  voidedAt: Date | null;
  voidedBy: Types.ObjectId | null;
  voidReason: string | null;
}

export type PaymentDoc = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    tuitionAccountId: { type: Schema.Types.ObjectId, ref: 'TuitionAccount', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    courseCode: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    paidAt: { type: Date, required: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiptNo: { type: String, required: true, unique: true },
    note: { type: String, default: null },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    voidReason: { type: String, default: null },
  },
  schemaOptions<IPayment>(),
);

paymentSchema.index({ tuitionAccountId: 1, paidAt: -1 });
paymentSchema.index({ branchId: 1, paidAt: -1 });

export const Payment = model<IPayment>('Payment', paymentSchema);
