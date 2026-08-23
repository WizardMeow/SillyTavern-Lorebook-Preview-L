import { parseLorebook } from '../adapters';
import { looksLikeHttpUrl, type ImportSourceAdapter } from './contracts';

export const jsonTextImportAdapter: ImportSourceAdapter = {
  id: 'json-text',
  canHandle: (input) => input.kind === 'text' && !looksLikeHttpUrl(input.value.trim()),
  async import(input) {
    if (input.kind !== 'text') throw new Error('JSON 文本适配器无法读取此输入。');
    const text = input.value.trim();
    if (!text) throw new Error('请粘贴世界书 JSON 或输入 URL。');
    return parseLorebook(text);
  },
};
