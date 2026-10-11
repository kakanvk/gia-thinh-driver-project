import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export interface IPriceOverride {
  branchId: Types.ObjectId;
  courseId: Types.ObjectId;
  price: number;
  priceNote?: string | null;
}

export type PriceOverrideDoc = HydratedDocument<IPriceOverride>;

const priceOverrideSchema = new Schema<IPriceOverride>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    price: { type: Number, required: true, min: 0 },
    priceNote: { type: String, trim: true, default: null },
  },
  schemaOptions<IPriceOverride>(),
);

priceOverrideSchema.index({ branchId: 1, courseId: 1 }, { unique: true });

export const PriceOverride = model<IPriceOverride>('PriceOverride', priceOverrideSchema);
