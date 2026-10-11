import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { imageSubSchema, type IImage } from '../../shared/mongoose/image';
import { schemaOptions } from '../../shared/mongoose/schemaOptions';
import { softDeletePlugin } from '../../shared/mongoose/softDelete';

export const POST_STATUSES = ['draft', 'pending', 'published', 'archived'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export interface IPost {
  title: string;
  slug: string;
  excerpt: string;
  excerptAuto: boolean;
  content: unknown[];
  contentText: string;
  readTimeMinutes: number;
  cover?: IImage | null;
  categoryId: Types.ObjectId;
  tags: string[];
  authorId?: Types.ObjectId | null;
  authorName: string;
  status: PostStatus;
  publishedAt?: Date | null;
  views: number;
  seo?: { title?: string; description?: string } | null;
  deletedAt?: Date | null;
}

export type PostDoc = HydratedDocument<IPost>;

const postSchema = new Schema<IPost>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, default: '', trim: true },
    excerptAuto: { type: Boolean, default: false },
    content: { type: [Schema.Types.Mixed], required: true },
    contentText: { type: String, default: '' },
    readTimeMinutes: { type: Number, default: 1 },
    cover: { type: imageSubSchema, default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    tags: { type: [String], default: [] },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    authorName: { type: String, required: true, trim: true },
    status: { type: String, enum: POST_STATUSES, default: 'draft' },
    publishedAt: { type: Date, default: null },
    views: { type: Number, default: 0 },
    seo: { type: new Schema({ title: String, description: String }, { _id: false }), default: null },
  },
  schemaOptions<IPost>(),
);

postSchema.plugin(softDeletePlugin);
postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ categoryId: 1, status: 1, publishedAt: -1 });
postSchema.index({ tags: 1 });

export const Post = model<IPost>('Post', postSchema);
