import { z } from 'zod';
import { atLeastOneField, objectIdSchema } from '../../shared/zod';
import { MEDIA_KINDS } from '../media/media.model';

export const MAX_GALLERY_ITEMS = 500;

const captionSchema = z.string().trim().max(300);

export const listGalleryQuerySchema = z.object({
  kind: z.enum(MEDIA_KINDS).optional(),
  visible: z.enum(['true', 'false']).optional(),
});
export const publicGalleryQuerySchema = z.object({ kind: z.enum(MEDIA_KINDS).optional() });

export const createGalleryItemSchema = z.object({
  mediaId: objectIdSchema,
  posterMediaId: objectIdSchema.optional(),
  caption: captionSchema.optional(),
  visible: z.boolean().optional(),
});

export const updateGalleryItemSchema = atLeastOneField(
  z
    .object({
      posterMediaId: objectIdSchema.nullable(),
      caption: captionSchema.nullable(),
      visible: z.boolean(),
    })
    .partial(),
);

export const reorderGallerySchema = z.object({ ids: z.array(objectIdSchema).min(1).max(MAX_GALLERY_ITEMS) });

export type ListGalleryQuery = z.infer<typeof listGalleryQuerySchema>;
export type PublicGalleryQuery = z.infer<typeof publicGalleryQuerySchema>;
export type CreateGalleryItemInput = z.infer<typeof createGalleryItemSchema>;
export type UpdateGalleryItemInput = z.infer<typeof updateGalleryItemSchema>;
