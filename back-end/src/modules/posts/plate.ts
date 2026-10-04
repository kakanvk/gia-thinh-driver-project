import { z } from 'zod';

const MAX_DEPTH = 12;
const MAX_JSON_LENGTH = 500_000;
const SAFE_URL = /^(https?:\/\/|\/(?![/\\])|#|mailto:|tel:)/i;

const INLINE_TYPES = new Set(['a', 'link']);

type PlateRecord = Record<string, unknown>;
export type PlateContent = unknown[];

function checkNode(node: unknown, depth: number, path: (string | number)[], ctx: z.RefinementCtx): void {
  if (depth > MAX_DEPTH) {
    ctx.addIssue({ code: 'custom', path, message: 'Nội dung lồng quá sâu' });
    return;
  }
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    ctx.addIssue({ code: 'custom', path, message: 'Node nội dung không hợp lệ' });
    return;
  }
  const record = node as PlateRecord;
  if ('text' in record) {
    if (typeof record.text !== 'string') {
      ctx.addIssue({ code: 'custom', path: [...path, 'text'], message: 'text phải là chuỗi' });
    }
    if ('type' in record || 'children' in record) {
      ctx.addIssue({ code: 'custom', path, message: 'Node chữ không được có type hoặc children' });
    }
    return;
  }
  if (typeof record.type !== 'string' || record.type.length === 0 || record.type.length > 50) {
    ctx.addIssue({ code: 'custom', path: [...path, 'type'], message: 'type không hợp lệ' });
  }
  if (!Array.isArray(record.children) || record.children.length === 0) {
    ctx.addIssue({ code: 'custom', path: [...path, 'children'], message: 'children phải là mảng không rỗng' });
    return;
  }
  record.children.forEach((child, index) => checkNode(child, depth + 1, [...path, 'children', index], ctx));
}

const MAX_WALK_DEPTH = MAX_DEPTH * 2 + 2;
const MAX_WALK_NODES = 50_000;
const URL_KEYS = new Set(['url', 'href', 'src', 'poster', 'link']);

function isUrlKey(key: string): boolean {
  return URL_KEYS.has(key.toLowerCase()) || key.toLowerCase().endsWith('url');
}

// Deep walk over every object/array value (not only `children`), e.g. image `caption`.
function checkUrls(root: unknown, ctx: z.RefinementCtx): void {
  let visited = 0;
  const walk = (value: unknown, depth: number, path: (string | number)[]): boolean => {
    if (typeof value !== 'object' || value === null) return true;
    if (depth > MAX_WALK_DEPTH || ++visited > MAX_WALK_NODES) {
      ctx.addIssue({ code: 'custom', path, message: 'Nội dung lồng quá sâu' });
      return false;
    }
    const entries: [string | number, unknown][] = Array.isArray(value)
      ? value.map((v, i) => [i, v])
      : Object.entries(value);
    for (const [key, child] of entries) {
      if (typeof key === 'string' && isUrlKey(key) && (typeof child !== 'string' || !SAFE_URL.test(child.trim()))) {
        ctx.addIssue({ code: 'custom', path: [...path, key], message: 'Đường dẫn không an toàn' });
        continue;
      }
      if (!walk(child, depth + 1, [...path, key])) return false;
    }
    return true;
  };
  walk(root, 0, []);
}

export const plateContentSchema = z
  .array(z.unknown())
  .min(1, 'Nội dung không được để trống')
  .max(2000, 'Nội dung quá nhiều khối')
  .superRefine((nodes, ctx) => {
    if (JSON.stringify(nodes).length > MAX_JSON_LENGTH) {
      ctx.addIssue({ code: 'custom', message: 'Nội dung quá dài' });
      return;
    }
    nodes.forEach((node, index) => checkNode(node, 1, [index], ctx));
    checkUrls(nodes, ctx);
  });

function collectText(node: unknown): string {
  if (typeof node !== 'object' || node === null) return '';
  const record = node as PlateRecord;
  if (typeof record.text === 'string') return record.text;
  if (!Array.isArray(record.children)) return '';
  let out = '';
  for (const child of record.children) {
    const isBlock =
      typeof child === 'object' &&
      child !== null &&
      'children' in child &&
      !INLINE_TYPES.has(String((child as PlateRecord).type));
    const text = collectText(child);
    if (isBlock) out += (out && !out.endsWith('\n') ? '\n' : '') + text + '\n';
    else out += text;
  }
  return out.trim();
}

export function plateToText(nodes: unknown[]): string {
  return nodes
    .map((node) => collectText(node).trim())
    .filter(Boolean)
    .join('\n');
}

export function readTimeMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function paragraphsToPlate(paragraphs: string[]): PlateContent {
  return paragraphs.map((text) => ({ type: 'p', children: [{ text }] }));
}
