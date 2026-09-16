import { z } from 'zod';
import { lorebookEntrySchema, lorebookSchema, type Lorebook } from '../../../domain/lorebook';
import { jsonRecordSchema } from './shared';

/** The export shape used by SillyTavern's Quick Replies extension. */
const quickRepliesDocumentSchema = z.object({
  name: z.string().optional(),
  qrList: z.array(z.unknown()),
}).passthrough();

const quickReplySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  label: z.string().optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  isHidden: z.boolean().optional(),
}).passthrough();
type QuickReply = z.infer<typeof quickReplySchema>;

export function isQuickReplies(document: z.infer<typeof jsonRecordSchema>): boolean {
  return quickRepliesDocumentSchema.safeParse(document).success;
}

function normalizeEntry(raw: QuickReply, fallbackId: string, sourceIndex: number, warnings: string[]) {
  const id = String(raw.id ?? fallbackId);
  if (raw.message === undefined) warnings.push(`快捷回复 ${id} 没有 message，仍会以空内容显示。`);
  return lorebookEntrySchema.parse({
    id,
    // Quick Replies do not have trigger keywords. Use its visible label as a
    // searchable title while retaining every source field in raw.
    keys: raw.label?.trim() ? [raw.label.trim()] : [],
    secondaryKeys: [],
    comment: raw.title?.trim() || raw.label?.trim() || '',
    content: raw.message ?? '',
    disabled: false,
    constant: false,
    sourceIndex,
    raw,
  });
}

export function adaptQuickReplies(document: z.infer<typeof jsonRecordSchema>, source: string): Lorebook {
  const parsed = quickRepliesDocumentSchema.parse(document);
  const warnings: string[] = [];
  const entries = parsed.qrList.flatMap((unknownEntry, sourceIndex) => {
    const entry = quickReplySchema.safeParse(unknownEntry);
    if (!entry.success) {
      warnings.push(`已跳过快捷回复 ${sourceIndex}：它不是 JSON 对象。`);
      return [];
    }
    return [normalizeEntry(entry.data, String(sourceIndex), sourceIndex, warnings)];
  });

  return lorebookSchema.parse({
    kind: 'quick-replies',
    name: parsed.name?.trim() || source.replace(/\.json$/i, '') || '未命名快捷回复',
    entries,
    raw: document,
    source,
    warnings,
  });
}
