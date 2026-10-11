import { model, Schema, type HydratedDocument } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export interface ICategory {
  name: string;
  slug: string;
  description?: string;
  isAnnouncement: boolean;
  order: number;
}

export type CategoryDoc = HydratedDocument<ICategory>;

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    isAnnouncement: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  schemaOptions<ICategory>(),
);

export const Category = model<ICategory>('Category', categorySchema);
