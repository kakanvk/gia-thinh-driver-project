import { Branch } from '../modules/branches/branch.model';
import { Category } from '../modules/categories/category.model';
import { Course } from '../modules/courses/course.model';
import { paragraphsToPlate, plateToText, readTimeMinutes } from '../modules/posts/plate';
import { Setting } from '../modules/settings/setting.model';
import { Post } from '../modules/posts/post.model';
import { PriceItem } from '../modules/pricing/price-item.model';
import { PriceOverride } from '../modules/pricing/price-override.model';
import { WITH_DELETED } from '../shared/mongoose/softDelete';
import { parseDateTime } from '../shared/time';
import { seedCategories, seedCourses, seedOverrides, seedPriceItems } from './seed-catalog-data';
import { seedPosts } from './seed-posts-data';

function vnDateToPublishedAt(date: string): Date {
  const [day, month, year] = date.split('/');
  return parseDateTime(`${year}-${month}-${day}T08:00`);
}

function idMap<T extends { _id: unknown }>(docs: T[], keyOf: (doc: T) => string): Map<string, unknown> {
  return new Map(docs.map((doc) => [keyOf(doc), doc._id]));
}

const CATALOG_MARKER = '__seed_catalog_v1';

export async function seedCatalog(): Promise<void> {
  if (await Setting.exists({ key: CATALOG_MARKER })) return;
  for (const course of seedCourses) {
    await Course.updateOne({ code: course.code, ...WITH_DELETED }, { $setOnInsert: course }, { upsert: true });
  }
  for (const category of seedCategories) {
    await Category.updateOne({ slug: category.slug }, { $setOnInsert: category }, { upsert: true });
  }

  const courseIds = idMap(await Course.find(WITH_DELETED), (course) => course.code);
  const branchIds = idMap(await Branch.find(WITH_DELETED), (branch) => branch.slug);
  const categoryIds = idMap(await Category.find(), (category) => category.slug);
  const required = (map: Map<string, unknown>, key: string, what: string) => {
    const id = map.get(key);
    if (!id) throw new Error(`Seed thiếu ${what}: ${key}`);
    return id;
  };

  for (const override of seedOverrides) {
    const branchId = required(branchIds, override.branchSlug, 'chi nhánh');
    const courseId = required(courseIds, override.courseCode, 'gói học');
    await PriceOverride.updateOne(
      { branchId, courseId },
      { $setOnInsert: { branchId, courseId, price: override.price } },
      { upsert: true },
    );
  }

  for (const { courseCode, branchSlug, ...item } of seedPriceItems) {
    const courseId = courseCode ? required(courseIds, courseCode, 'gói học') : null;
    const branchId = branchSlug ? required(branchIds, branchSlug, 'chi nhánh') : null;
    await PriceItem.updateOne(
      { kind: item.kind, key: item.key, courseId, branchId },
      { $setOnInsert: { ...item, courseId, branchId, hidden: item.hidden ?? false } },
      { upsert: true },
    );
  }

  for (const post of seedPosts) {
    const content = paragraphsToPlate(post.content);
    const contentText = plateToText(content);
    await Post.updateOne(
      { slug: post.slug, ...WITH_DELETED },
      {
        $setOnInsert: {
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          excerptAuto: false,
          content,
          contentText,
          readTimeMinutes: readTimeMinutes(contentText),
          cover: { url: post.image, alt: post.imageAlt, mediaId: null },
          categoryId: required(categoryIds, post.categorySlug, 'chuyên mục'),
          tags: [],
          authorId: null,
          authorName: 'Ban biên tập',
          status: 'published',
          publishedAt: vnDateToPublishedAt(post.date),
          views: 0,
          seo: null,
          deletedAt: null,
        },
      },
      { upsert: true },
    );
  }
  await Setting.updateOne({ key: CATALOG_MARKER }, { $setOnInsert: { key: CATALOG_MARKER, value: true } }, { upsert: true });
}
