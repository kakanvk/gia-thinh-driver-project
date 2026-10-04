import { model, Schema, type Types } from 'mongoose';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';

export const MEDIA_KINDS = ['image', 'video'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface IMedia {
  kind: MediaKind;
  key: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  /** Thời lượng video (giây), client gửi khi biết. */
  duration?: number;
  alt?: string;
  uploadedBy: Types.ObjectId;
  refs: { entity: string; entityId: string }[];
}

type JsonTransform = (doc: unknown, ret: Record<string, unknown>) => Record<string, unknown>;
const options = schemaOptions<IMedia>();
const toJSON = options.toJSON!;
const baseTransform = toJSON.transform as unknown as JsonTransform;
const withRefsCount: JsonTransform = (doc, ret) => {
  const json = baseTransform(doc, ret);
  json.refsCount = Array.isArray(json.refs) ? json.refs.length : 0;
  return json;
};
toJSON.transform = withRefsCount as unknown as typeof toJSON.transform;

const mediaSchema = new Schema<IMedia>(
  {
    // Dữ liệu cũ không có `kind` → mặc định ảnh
    kind: { type: String, enum: MEDIA_KINDS, default: 'image' },
    key: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
    duration: { type: Number, min: 0 },
    alt: { type: String, trim: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refs: [{ _id: false, entity: { type: String, required: true }, entityId: { type: String, required: true } }],
  },
  options,
);

mediaSchema.index({ kind: 1, createdAt: -1 });

export const Media = model<IMedia>('Media', mediaSchema);
