import type { MongooseQueryMiddleware, Query, Schema } from 'mongoose';

export const WITH_DELETED = { deletedAt: { $exists: true } } as const;

const HOOKS: MongooseQueryMiddleware[] = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'countDocuments',
  'updateOne',
  'updateMany',
  'distinct',
  'findOneAndDelete',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
];

export function softDeletePlugin(schema: Schema): void {
  schema.add({ deletedAt: { type: Date, default: null } });
  schema.pre(HOOKS, function hideDeleted(this: Query<unknown, unknown>) {
    if (!('deletedAt' in this.getFilter())) this.where({ deletedAt: null });
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema.pre('aggregate', function hideDeletedInAggregate(this: any) {
    const pipeline = this.pipeline();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstStage = pipeline[0] as any;
    const hasDeletedAtInMatch =
      firstStage && typeof firstStage === 'object' && '$match' in firstStage && 'deletedAt' in firstStage.$match;
    if (!hasDeletedAtInMatch) {
      this.pipeline().unshift({ $match: { deletedAt: null } });
    }
  });
}
