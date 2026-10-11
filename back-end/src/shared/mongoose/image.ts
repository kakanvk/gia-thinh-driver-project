import { Schema, type Types } from 'mongoose';

export interface IImage {
  url: string;
  alt: string;
  mediaId?: Types.ObjectId | null;
}

export const imageSubSchema = new Schema<IImage>(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, default: '', trim: true },
    mediaId: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
  },
  { _id: false },
);
