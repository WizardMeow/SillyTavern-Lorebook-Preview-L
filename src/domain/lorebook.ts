import { z } from 'zod';

export const lorebookSourceKindSchema = z.enum(['world-info', 'character-card']);
export type LorebookSourceKind = z.infer<typeof lorebookSourceKindSchema>;

export const contentRenderModeSchema = z.enum(['text', 'markdown']);
export type ContentRenderMode = z.infer<typeof contentRenderModeSchema>;

export const lorebookEntrySchema = z.object({
  id: z.string(),
  keys: z.array(z.string()),
  secondaryKeys: z.array(z.string()),
  comment: z.string(),
  content: z.string(),
  disabled: z.boolean(),
  constant: z.boolean(),
  position: z.union([z.number(), z.string()]).optional(),
  displayIndex: z.number().optional(),
  order: z.number().optional(),
  depth: z.number().optional(),
  raw: z.record(z.string(), z.unknown()),
});
export type LorebookEntry = z.infer<typeof lorebookEntrySchema>;

export const lorebookSchema = z.object({
  kind: lorebookSourceKindSchema,
  name: z.string(),
  entries: z.array(lorebookEntrySchema),
  raw: z.record(z.string(), z.unknown()),
  source: z.string(),
  warnings: z.array(z.string()),
});
export type Lorebook = z.infer<typeof lorebookSchema>;

export type LorebookEntrySortMode = 'custom' | 'insertion';

export function getLorebookEntrySortMode(entries: LorebookEntry[]): LorebookEntrySortMode {
  return entries.length > 0 && entries.every((entry) => entry.displayIndex !== undefined)
    ? 'custom'
    : 'insertion';
}

function compareEntryIds(left: LorebookEntry, right: LorebookEntry): number {
  const leftId = Number(left.id);
  const rightId = Number(right.id);
  if (Number.isFinite(leftId) && Number.isFinite(rightId)) return leftId - rightId;
  return left.id.localeCompare(right.id, undefined, { numeric: true });
}

function priorityRank(entry: LorebookEntry): number {
  return entry.disabled ? 2 : entry.constant ? 0 : 1;
}

function compareInsertionPriority(left: LorebookEntry, right: LorebookEntry): number {
  return priorityRank(left) - priorityRank(right)
    || (right.order ?? 100) - (left.order ?? 100)
    || compareEntryIds(left, right);
}

/**
 * Mirrors the two useful SillyTavern list views without exposing a sort control:
 * complete draggable metadata uses the custom sequence, otherwise prompt priority.
 */
export function sortLorebookEntries(entries: LorebookEntry[]): LorebookEntry[] {
  const mode = getLorebookEntrySortMode(entries);
  return [...entries].sort((left, right) => {
    if (mode === 'custom') {
      return (left.displayIndex ?? 0) - (right.displayIndex ?? 0)
        || (right.order ?? 100) - (left.order ?? 100)
        || compareEntryIds(left, right);
    }
    return compareInsertionPriority(left, right);
  });
}

export class LorebookParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LorebookParseError';
  }
}

export function matchesEntry(entry: LorebookEntry, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [entry.id, entry.comment, entry.content, ...entry.keys, ...entry.secondaryKeys].some((value) =>
    value.toLocaleLowerCase().includes(needle),
  );
}
