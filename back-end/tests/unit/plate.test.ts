import { describe, expect, it } from 'vitest';
import { paragraphsToPlate, plateContentSchema, plateToText, readTimeMinutes } from '../../src/modules/posts/plate';

const paragraph = (text: string) => ({ type: 'p', children: [{ text }] });

describe('plateContentSchema', () => {
  it('chấp nhận đoạn văn, định dạng chữ, link và ảnh hợp lệ', () => {
    const content = [
      { type: 'h2', children: [{ text: 'Tiêu đề' }] },
      { type: 'p', children: [{ text: 'Đậm', bold: true }, { type: 'a', url: 'https://giathinh.vn', children: [{ text: 'link' }] }] },
      { type: 'img', url: '/media/a.webp', children: [{ text: '' }] },
    ];
    expect(plateContentSchema.safeParse(content).success).toBe(true);
  });

  it.each(['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html;base64,xx', '//evil.com/x'])(
    'từ chối url không an toàn %s',
    (url) => {
      const result = plateContentSchema.safeParse([{ type: 'a', url, children: [{ text: 'x' }] }]);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual([0, 'url']);
    },
  );

  it('từ chối link nguy hiểm trong caption (mảng node ngoài children)', () => {
    const result = plateContentSchema.safeParse([
      {
        type: 'img',
        url: '/a.png',
        caption: [{ type: 'a', url: 'javascript:alert(1)', children: [{ text: 'x' }] }],
        children: [{ text: '' }],
      },
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.join('.') === '0.caption.0.url')).toBe(true);
  });

  it.each(['href', 'src', 'poster', 'link', 'thumbUrl'])('từ chối khóa %s không an toàn', (key) => {
    const result = plateContentSchema.safeParse([
      { type: 'a', url: '/x', [key]: 'javascript:alert(1)', children: [{ text: 'x' }] },
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.join('.') === `0.${key}`)).toBe(true);
  });

  it('chấp nhận href/src an toàn và từ chối /\\evil.com', () => {
    expect(
      plateContentSchema.safeParse([{ type: 'a', url: '/x', href: 'https://a.vn', children: [{ text: 'x' }] }]).success,
    ).toBe(true);
    expect(
      plateContentSchema.safeParse([{ type: 'a', url: '/\\evil.com', children: [{ text: 'x' }] }]).success,
    ).toBe(false);
  });

  it('từ chối node có text kèm url không an toàn hoặc type/children', () => {
    const bad = plateContentSchema.safeParse([{ type: 'a', text: 'x', url: 'javascript:alert(1)' }]);
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.some((i) => i.path.join('.') === '0.url')).toBe(true);
    expect(plateContentSchema.safeParse([{ text: 'x', url: 'javascript:alert(1)' }]).success).toBe(false);
    expect(plateContentSchema.safeParse([{ type: 'p', text: 'x' }]).success).toBe(false);
  });

  it('từ chối mảng rỗng, node thiếu children, text không phải chuỗi', () => {
    expect(plateContentSchema.safeParse([]).success).toBe(false);
    expect(plateContentSchema.safeParse([{ type: 'p' }]).success).toBe(false);
    expect(plateContentSchema.safeParse([{ type: 'p', children: [{ text: 1 }] }]).success).toBe(false);
  });

  it('từ chối nội dung lồng quá 12 cấp', () => {
    let node: Record<string, unknown> = { text: 'x' };
    for (let i = 0; i < 13; i += 1) node = { type: 'div', children: [node] };
    expect(plateContentSchema.safeParse([node]).success).toBe(false);
  });
});

describe('plateToText / readTimeMinutes / paragraphsToPlate', () => {
  it('ghép chữ trong một block, mỗi block một dòng, bỏ block rỗng', () => {
    const content = [
      { type: 'p', children: [{ text: 'Xin ' }, { text: 'chào', bold: true }] },
      { type: 'p', children: [{ text: '  ' }] },
      { type: 'ul', children: [{ type: 'li', children: [{ text: 'Mục 1' }] }] },
    ];
    expect(plateToText(content)).toBe('Xin chào\nMục 1');
  });

  it('tách mục của danh sách nhiều mục, giữ link inline liền mạch', () => {
    const content = [
      { type: 'ul', children: [{ type: 'li', children: [{ text: 'Mục 1' }] }, { type: 'li', children: [{ text: 'Mục 2' }] }] },
      { type: 'p', children: [{ text: 'Xem ' }, { type: 'a', url: '/x', children: [{ text: 'đây' }] }, { text: ' nhé' }] },
    ];
    expect(plateToText(content)).toBe('Mục 1\nMục 2\nXem đây nhé');
  });

  it('200 từ một phút, tối thiểu 1 phút', () => {
    expect(readTimeMinutes('')).toBe(1);
    expect(readTimeMinutes(Array.from({ length: 401 }, () => 'từ').join(' '))).toBe(3);
  });

  it('paragraphsToPlate tạo đoạn văn Plate hợp lệ', () => {
    const content = paragraphsToPlate(['Một', 'Hai']);
    expect(content).toEqual([paragraph('Một'), paragraph('Hai')]);
    expect(plateContentSchema.safeParse(content).success).toBe(true);
  });
});
