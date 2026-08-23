import type { Lorebook } from '../../domain/lorebook';
import { importInputSchema, importSourceAdapters, type ImportInput } from './source-adapters';

export { isHttpUrl, looksLikeHttpUrl, normalizeImportUrl, type ImportInput } from './source-adapters';

/**
 * The single import seam. Source adapters own acquisition; format adapters own
 * the subsequent Lorebook decoding. Callers only provide a text or file input.
 */
export async function importLorebook(input: ImportInput): Promise<Lorebook> {
  const parsedInput = importInputSchema.safeParse(input);
  if (!parsedInput.success) throw new Error('无法读取导入内容。');

  const adapter = importSourceAdapters.find((candidate) => candidate.canHandle(parsedInput.data));
  if (!adapter) throw new Error('未找到能够处理此导入内容的适配器。');
  return adapter.import(parsedInput.data);
}
