import { z } from 'zod';
import { lorebookEntrySchema, lorebookSchema, type Lorebook } from '../../../domain/lorebook';
import { entriesCollectionSchema, entryPairs, jsonRecordSchema, numberAt, positionAt, strings, stringListSchema } from './shared';

export const worldInfoDocumentSchema = z.object({
  name: z.string().optional(),
  entries: entriesCollectionSchema,
}).passthrough();
export type WorldInfoDocument = z.infer<typeof worldInfoDocumentSchema>;

const worldInfoEntrySchema = z.object({
  uid: z.union([z.string(), z.number()]).optional(),
  key: stringListSchema.optional(),
  keysecondary: stringListSchema.optional(),
  comment: z.string().optional(),
  content: z.string().optional(),
}).passthrough();
type WorldInfoEntry = z.infer<typeof worldInfoEntrySchema>;

export function isWorldInfo(document: z.infer<typeof jsonRecordSchema>): boolean {
  return Object.hasOwn(document, 'entries');
}

function normalizeEntry(raw: WorldInfoEntry, fallbackId: string, warnings: string[]) {
  const id = String(raw.uid ?? fallbackId);
  if (raw.content === undefined) warnings.push(`原生条目 ${id} 没有 content，仍会以空内容显示。`);
  return lorebookEntrySchema.parse({
    id,
    keys: strings(raw.key),
    secondaryKeys: strings(raw.keysecondary),
    comment: raw.comment ?? '',
    content: raw.content ?? '',
    disabled: raw.disable === true,
    constant: raw.constant === true,
    position: positionAt(raw),
    order: numberAt(raw, 'order'),
    depth: numberAt(raw, 'depth'),
    raw,
  });
}

/** Adapts only SillyTavern's standalone World Info document shape. */
export function adaptWorldInfo(document: z.infer<typeof jsonRecordSchema>, source: string): Lorebook {
  const parsed = worldInfoDocumentSchema.safeParse(document);
  if (!parsed.success) throw new Error('这是顶层含 `entries` 的文档，但 `entries` 必须是对象或数组。');
  const warnings: string[] = [];
  const entries = entryPairs(parsed.data.entries).flatMap(([fallbackId, unknownEntry]) => {
    const entry = worldInfoEntrySchema.safeParse(unknownEntry);
    if (!entry.success) {
      warnings.push(`已跳过原生条目 ${fallbackId}：它不是 JSON 对象。`);
      return [];
    }
    return [normalizeEntry(entry.data, fallbackId, warnings)];
  });
  return lorebookSchema.parse({
    kind: 'world-info',
    name: parsed.data.name?.trim() || source.replace(/\.json$/i, '') || '未命名世界书',
    entries,
    raw: document,
    source,
    warnings,
  });
}
