import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const BRANCH_STATUSES = ['active', 'inactive'] as const;

export interface IBranch {
  name: string;
  slug: string;
  officeName: string;
  address: string;
  mapUrl?: string;
  phone?: string;
  managerId?: Types.ObjectId | null;
  openingHours?: string;
  order: number;
  status: (typeof BRANCH_STATUSES)[number];
  deletedAt?: Date | null;
}

export type BranchDoc = HydratedDocument<IBranch>;

const branchSchema = new Schema<IBranch>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    officeName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    mapUrl: { type: String, trim: true },
    phone: { type: String, trim: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    openingHours: { type: String, trim: true },
    order: { type: Number, default: 0 },
    status: { type: String, enum: BRANCH_STATUSES, default: 'active' },
  },
  schemaOptions<IBranch>(),
);

branchSchema.plugin(softDeletePlugin);

export const Branch = model<IBranch>('Branch', branchSchema);
