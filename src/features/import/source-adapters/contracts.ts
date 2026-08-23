import { z } from 'zod';
import type { Lorebook } from '../../../domain/lorebook';

export const textImportInputSchema = z.object({
  kind: z.literal('text'),
  value: z.string(),
});

export const fileImportInputSchema = z.object({
  kind: z.literal('file'),
  file: z.custom<File>((value) => typeof File !== 'undefined' && value instanceof File, {
    message: '导入文件无效。',
  }),
});

export const importInputSchema = z.discriminatedUnion('kind', [textImportInputSchema, fileImportInputSchema]);
export type ImportInput = z.infer<typeof importInputSchema>;

export type ImportSourceAdapter = {
  readonly id: string;
  canHandle(input: ImportInput): boolean;
  import(input: ImportInput): Promise<Lorebook>;
};

export function looksLikeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function isHttpUrl(value: string): boolean {
  if (!looksLikeHttpUrl(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
