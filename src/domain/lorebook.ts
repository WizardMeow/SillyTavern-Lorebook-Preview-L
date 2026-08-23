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
