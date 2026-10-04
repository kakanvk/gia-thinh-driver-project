import { model, Schema, type HydratedDocument } from 'mongoose';
import { imageSubSchema, type IImage } from '../../shared/mongoose/image';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const VEHICLE_TYPES = ['moto', 'car', 'truck'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface ICourse {
  code: string;
  name: string;
  vehicleType: VehicleType;
  description?: string;
  duration?: string;
  defaultPrice: number;
  priceNote?: string;
  image?: IImage | null;
  order: number;
  active: boolean;
  deletedAt?: Date | null;
}

export type CourseDoc = HydratedDocument<ICourse>;

const courseSchema = new Schema<ICourse>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    description: { type: String, trim: true },
    duration: { type: String, trim: true },
    defaultPrice: { type: Number, required: true, min: 0 },
    priceNote: { type: String, trim: true },
    image: { type: imageSubSchema, default: null },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  schemaOptions<ICourse>(),
);

courseSchema.plugin(softDeletePlugin);

export const Course = model<ICourse>('Course', courseSchema);
