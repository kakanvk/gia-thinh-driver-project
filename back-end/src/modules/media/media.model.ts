import { model, Schema, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export interface IMedia {
  key: string;
  url: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  alt?: string;
  uploadedBy: Types.ObjectId;
  refs: { entity: string; entityId: string }[];
}

const mediaSchema = new Schema<IMedia>(
  {
    key: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    alt: { type: String, trim: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refs: [{ _id: false, entity: { type: String, required: true }, entityId: { type: String, required: true } }],
  },
  schemaOptions<IMedia>(),
);

export const Media = model<IMedia>('Media', mediaSchema);
