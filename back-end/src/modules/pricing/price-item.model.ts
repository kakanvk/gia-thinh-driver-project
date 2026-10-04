import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export const PRICE_ITEM_KINDS = ['fee', 'discount'] as const;
export type PriceItemKind = (typeof PRICE_ITEM_KINDS)[number];

export interface IPriceItem {
  kind: PriceItemKind;
  key: string;
  courseId: Types.ObjectId | null;
  branchId: Types.ObjectId | null;
  label: string;
  amount?: number | null;
  amountMax?: number | null;
  unit?: string | null;
  note?: string | null;
  hidden: boolean;
  order: number;
}

export type PriceItemDoc = HydratedDocument<IPriceItem>;

const priceItemSchema = new Schema<IPriceItem>(
  {
    kind: { type: String, enum: PRICE_ITEM_KINDS, required: true },
    key: { type: String, required: true, trim: true, lowercase: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    label: { type: String, required: true, trim: true },
    amount: { type: Number, min: 0, default: null },
    amountMax: { type: Number, min: 0, default: null },
    unit: { type: String, trim: true, default: null },
    note: { type: String, trim: true, default: null },
    hidden: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  schemaOptions<IPriceItem>(),
);

priceItemSchema.index({ kind: 1, key: 1, courseId: 1, branchId: 1 }, { unique: true });
priceItemSchema.index({ branchId: 1 });

export const PriceItem = model<IPriceItem>('PriceItem', priceItemSchema);
