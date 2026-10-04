import mongoose, { Schema } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { paginate, listQuerySchema } from '../../src/shared/mongoose/paginate';
import { schemaOptions } from '../../src/shared/mongoose/schemaOptions';
import { softDeletePlugin, WITH_DELETED } from '../../src/shared/mongoose/softDelete';

type Thing = { name: string; secret?: string; deletedAt?: Date | null };
const thingSchema = new Schema<Thing>({ name: String, secret: String }, schemaOptions<Thing>({ hidden: ['secret'] }));
thingSchema.plugin(softDeletePlugin);
const Thing = (mongoose.models.Thing as mongoose.Model<Thing>) ?? mongoose.model<Thing>('Thing', thingSchema);

describe('schemaOptions', () => {
  it('toJSON có id dạng string, không có _id, __v, field ẩn', async () => {
    const doc = await Thing.create({ name: 'A', secret: 'x' });
    const json = doc.toJSON() as Record<string, unknown>;
    expect(json.id).toBe(doc._id.toString());
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
    expect(json).not.toHaveProperty('secret');
    expect(json).toHaveProperty('createdAt');
  });
});

describe('softDeletePlugin', () => {
  it('ẩn bản ghi đã xóa mềm, WITH_DELETED lấy lại được', async () => {
    const [a] = await Thing.create([{ name: 'A' }, { name: 'B' }]);
    await Thing.updateOne({ _id: a!._id }, { deletedAt: new Date() });
    expect(await Thing.countDocuments()).toBe(1);
    expect(await Thing.findById(a!._id)).toBeNull();
    expect(await Thing.countDocuments(WITH_DELETED)).toBe(2);
  });

  it('find() ẩn bản ghi đã xóa mềm', async () => {
    const [a] = await Thing.create([{ name: 'A' }, { name: 'B' }]);
    await Thing.updateOne({ _id: a!._id }, { deletedAt: new Date() });
    const docs = await Thing.find();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.name).toBe('B');
  });

  it('updateOne với filter được trả về matchedCount = 0 khi bản ghi đã xóa mềm', async () => {
    const [a] = await Thing.create([{ name: 'A' }, { name: 'B' }]);
    await Thing.updateOne({ _id: a!._id }, { deletedAt: new Date() });
    const result = await Thing.updateOne({ _id: a!._id }, { name: 'X' });
    expect(result.matchedCount).toBe(0);
  });

  it('aggregate() ẩn bản ghi đã xóa mềm', async () => {
    const [a] = await Thing.create([{ name: 'A' }, { name: 'B' }]);
    await Thing.updateOne({ _id: a!._id }, { deletedAt: new Date() });
    const docs = await Thing.aggregate([{ $match: {} }]);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.name).toBe('B');
  });

  it('distinct() ẩn bản ghi đã xóa mềm', async () => {
    const [a] = await Thing.create([{ name: 'A' }, { name: 'B' }]);
    await Thing.updateOne({ _id: a!._id }, { deletedAt: new Date() });
    const names = await Thing.distinct('name');
    expect(names).toEqual(['B']);
  });

  it('find với explicit deletedAt filter bỏ qua soft delete', async () => {
    const [a] = await Thing.create([{ name: 'A' }, { name: 'B' }]);
    await Thing.updateOne({ _id: a!._id }, { deletedAt: new Date() });
    const docs = await Thing.find({ deletedAt: { $ne: null } });
    expect(docs).toHaveLength(1);
    expect(docs[0]!.name).toBe('A');
  });
});

describe('paginate', () => {
  it('trả data + meta và áp dụng sort/skip/limit', async () => {
    await Thing.create(['c', 'a', 'b', 'd', 'e'].map((name) => ({ name })));
    const query = listQuerySchema.parse({ page: '2', limit: '2', sort: 'name' });
    const result = await paginate(Thing, {}, query);
    expect(result.meta).toEqual({ page: 2, limit: 2, total: 5 });
    expect(result.data.map((item) => item.name)).toEqual(['c', 'd']);
  });

  it('listQuerySchema chặn limit > 100 và sort có ký tự lạ', () => {
    expect(listQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(listQuerySchema.safeParse({ sort: '$where' }).success).toBe(false);
    expect(listQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });
});
