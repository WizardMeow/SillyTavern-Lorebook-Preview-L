import { z } from 'zod';

export const jsonRecordSchema = z.record(z.string(), z.unknown());
export const stringListSchema = z.union([z.string(), z.array(z.string())]);
export const entriesCollectionSchema = z.union([z.array(z.unknown()), jsonRecordSchema]);

export function strings(value: z.infer<typeof stringListSchema> | undefined): string[] {
  return typeof value === 'string'
    ? (value.trim() ? [value.trim()] : [])
    : value?.map((item) => item.trim()).filter(Boolean) ?? [];
}

export function numberAt(record: z.infer<typeof jsonRecordSchema>, field: string): number | undefined {
  const value = record[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function positionAt(record: z.infer<typeof jsonRecordSchema>): number | string | undefined {
  const position = record.position;
  if (typeof position === 'number' || typeof position === 'string') return position;
  const extensions = jsonRecordSchema.safeParse(record.extensions);
  const extensionPosition = extensions.success ? extensions.data.position : undefined;
  return typeof extensionPosition === 'number' || typeof extensionPosition === 'string' ? extensionPosition : undefined;
}

/** SillyTavern persists its draggable editor order in extensions.display_index. */
export function displayIndexAt(record: z.infer<typeof jsonRecordSchema>): number | undefined {
  const directValue = numberAt(record, 'displayIndex');
  if (directValue !== undefined) return directValue;

  const extensions = jsonRecordSchema.safeParse(record.extensions);
  return extensions.success ? numberAt(extensions.data, 'display_index') : undefined;
}

export function entryPairs(collection: z.infer<typeof entriesCollectionSchema>): Array<[string, unknown]> {
  return Array.isArray(collection)
    ? collection.map((entry, index) => [String(index), entry])
    : Object.entries(collection);
}
