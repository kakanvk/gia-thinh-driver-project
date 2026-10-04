import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export interface IGalleryItem {
  mediaId: Types.ObjectId;
  /** Ảnh bìa, chỉ dùng cho mục video. */
  posterMediaId?: Types.ObjectId | null;
  caption?: string | null;
  order: number;
  visible: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type GalleryItemDoc = HydratedDocument<IGalleryItem>;

const galleryItemSchema = new Schema<IGalleryItem>(
  {
    mediaId: { type: Schema.Types.ObjectId, ref: 'Media', required: true },
    posterMediaId: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
    caption: { type: String, trim: true, maxlength: 300, default: null },
    order: { type: Number, default: 0 },
    visible: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  schemaOptions<IGalleryItem>(),
);

galleryItemSchema.index({ order: 1 });

export const GalleryItem = model<IGalleryItem>('GalleryItem', galleryItemSchema);
