import type { SchemaOptions } from 'mongoose';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function schemaOptions<T = any, TMethods = object>(
  opts: { hidden?: string[]; timestamps?: boolean } = {},
): SchemaOptions<T, TMethods> {
  const hidden = opts.hidden ?? [];
  return {
    timestamps: opts.timestamps ?? true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        for (const field of hidden) delete ret[field];
        return ret;
      },
    },
  } as SchemaOptions<T, TMethods>;
}
