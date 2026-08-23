import { z } from 'zod';
import { lorebookEntrySchema, lorebookSchema, type Lorebook } from '../../../domain/lorebook';
import { entriesCollectionSchema, entryPairs, jsonRecordSchema, numberAt, positionAt, strings, stringListSchema } from './shared';

const characterBookSchema = z.object({
  name: z.string().optional(),
  entries: entriesCollectionSchema,
}).passthrough();
const characterCardSchema = z.object({
  data: z.object({ character_book: characterBookSchema }).passthrough(),
}).passthrough();
export type CharacterCard = z.infer<typeof characterCardSchema>;

const characterBookEntrySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  keys: stringListSchema.optional(),
  secondary_keys: stringListSchema.optional(),
  comment: z.string().optional(),
  content: z.string().optional(),
  enabled: z.boolean().optional(),
  insertion_order: z.number().optional(),
}).passthrough();
type CharacterBookEntry = z.infer<typeof characterBookEntrySchema>;

export function isCharacterCard(document: z.infer<typeof jsonRecordSchema>): boolean {
  return characterCardSchema.safeParse(document).success;
}

function normalizeEntry(raw: CharacterBookEntry, fallbackId: string, warnings: string[]) {
  const id = String(raw.id ?? fallbackId);
  if (raw.content === undefined) warnings.push(`角色卡世界书条目 ${id} 没有 content，仍会以空内容显示。`);
  return lorebookEntrySchema.parse({
    id,
    keys: strings(raw.keys),
    secondaryKeys: strings(raw.secondary_keys),
    comment: raw.comment ?? '',
    content: raw.content ?? '',
    disabled: raw.enabled === false,
    constant: raw.constant === true,
    position: positionAt(raw),
    order: raw.insertion_order ?? numberAt(raw, 'order'),
    depth: numberAt(raw, 'depth'),
    raw,
  });
}

/** Adapts only a character card's embedded `data.character_book` document. */
export function adaptCharacterCard(document: z.infer<typeof jsonRecordSchema>, source: string): Lorebook {
  const card = characterCardSchema.parse(document);
  const warnings: string[] = [];
  const entries = entryPairs(card.data.character_book.entries).flatMap(([fallbackId, unknownEntry]) => {
    const entry = characterBookEntrySchema.safeParse(unknownEntry);
    if (!entry.success) {
      warnings.push(`已跳过角色卡世界书条目 ${fallbackId}：它不是 JSON 对象。`);
      return [];
    }
    return [normalizeEntry(entry.data, fallbackId, warnings)];
  });
  return lorebookSchema.parse({
    kind: 'character-card',
    name: card.data.character_book.name?.trim() || source.replace(/\.json$/i, '') || '未命名角色卡世界书',
    entries,
    raw: document,
    source,
    warnings,
  });
}
