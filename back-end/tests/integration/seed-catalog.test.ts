import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { Category } from '../../src/modules/categories/category.model';
import { Course } from '../../src/modules/courses/course.model';
import { Post } from '../../src/modules/posts/post.model';
import { PriceItem } from '../../src/modules/pricing/price-item.model';
import { PriceOverride } from '../../src/modules/pricing/price-override.model';
import { Setting } from '../../src/modules/settings/setting.model';
import { runSeed } from '../../src/scripts/seed';
import { seedPriceItems } from '../../src/scripts/seed-catalog-data';
import { authHeader, createUser } from '../helpers/factories';

type PublicCourse = { code: string; price: number; fees: { label: string }[]; discounts: { label: string }[] };

describe('seed gói học, giá, nội dung', () => {
  it('idempotent: chạy 2 lần không nhân đôi', async () => {
    await runSeed();
    await runSeed();
    expect(await Course.countDocuments()).toBe(4);
    expect(await PriceOverride.countDocuments()).toBe(2);
    expect(await PriceItem.countDocuments()).toBe(seedPriceItems.length);
    expect(await Category.countDocuments()).toBe(5);
    expect(await Post.countDocuments({ status: 'published' })).toBe(6);
  });

  it('bảng giá công khai khớp website hiện tại (Tân Ngãi vs Vũng Liêm)', async () => {
    await runSeed();
    const app = createApp();
    const tanNgai = (await request(app).get('/api/v1/public/pricing?branch=tan-ngai')).body.data.courses as PublicCourse[];
    const vungLiem = (await request(app).get('/api/v1/public/pricing?branch=vung-liem')).body.data.courses as PublicCourse[];
    const at = (list: PublicCourse[], code: string) => list.find((course) => course.code === code)!;

    expect(tanNgai.map((course) => course.code)).toEqual(['A1', 'A', 'B', 'C1']);
    expect(at(tanNgai, 'A')).toMatchObject({ price: 1_750_000 });
    expect(at(tanNgai, 'A').fees.map((fee) => fee.label)).toEqual(['Xe cảm biến A', 'Thi thử máy tính']);
    expect(at(tanNgai, 'A').discounts.map((d) => d.label)).toEqual([
      'Có bằng ô tô: miễn lý thuyết',
      'HSSV học hạng A (mang thẻ khi đăng ký)',
    ]);

    expect(at(vungLiem, 'A1')).toMatchObject({ price: 790_000 });
    expect(at(vungLiem, 'A')).toMatchObject({ price: 1_595_000 });
    expect(at(vungLiem, 'A').fees.map((fee) => fee.label)).toEqual(['Cảm biến A tay ga Vespa', 'Cảm biến A tay côn']);
    expect(at(vungLiem, 'A').discounts.map((d) => d.label)).toEqual(['Có bằng ô tô: miễn lý thuyết']);
    expect(at(vungLiem, 'A1').fees.map((fee) => fee.label)).toEqual(['Xe cảm biến A1']);
    expect(at(vungLiem, 'B')).toMatchObject({ price: 16_500_000 });
  });

  it('không ghi đè giá admin đã sửa', async () => {
    await runSeed();
    await Course.updateOne({ code: 'B' }, { defaultPrice: 17_000_000 });
    await runSeed();
    expect((await Course.findOne({ code: 'B' }))?.defaultPrice).toBe(17_000_000);
  });

  it('bài viết seed có nội dung Plate, giờ đăng 08:00 giờ VN và hiện ở /public/posts', async () => {
    await runSeed();
    const res = await request(createApp()).get('/api/v1/public/posts/5-luu-y-truoc-ngay-thi-sat-hach-a1');
    expect(res.status).toBe(200);
    expect(res.body.data.publishedAt).toBe('2026-09-06T08:00:00+07:00');
    expect(res.body.data.content[0]).toMatchObject({ type: 'p', children: [{ text: expect.stringContaining('CCCD') }] });
    expect(res.body.data.category.slug).toBe('kinh-nghiem-thi');
  });

  it('chỉ nạp catalog một lần: dữ liệu admin đã xóa không bị nạp lại', async () => {
    await runSeed();
    await PriceItem.deleteOne({ kind: seedPriceItems[0]!.kind, key: seedPriceItems[0]!.key });
    await PriceOverride.deleteOne({});
    await runSeed();
    expect(await PriceItem.countDocuments()).toBe(seedPriceItems.length - 1);
    expect(await PriceOverride.countDocuments()).toBe(1);
    expect(await Course.countDocuments()).toBe(4);
    expect(await Post.countDocuments({ status: 'published' })).toBe(6);
  });

  it('marker __seed_catalog_v1 không lộ qua /settings và /public/settings', async () => {
    await runSeed();
    expect(await Setting.exists({ key: '__seed_catalog_v1' })).toBeTruthy();
    const app = createApp();
    const { user: admin } = await createUser();
    const pub = await request(app).get('/api/v1/public/settings');
    const priv = await request(app).get('/api/v1/settings').set(authHeader(admin));
    expect(JSON.stringify(pub.body)).not.toContain('__seed_catalog_v1');
    expect(JSON.stringify(priv.body)).not.toContain('__seed_catalog_v1');
  });
});
