import { parseLorebook } from '../adapters';
import { MAX_PNG_CARD_BYTES, parsePngCharacterCard } from '../adapters/png-character-card';
import type { ImportSourceAdapter } from './contracts';

function isPngFile(file: File): boolean {
  return file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
}

export const localFileImportAdapter: ImportSourceAdapter = {
  id: 'local-file',
  canHandle: (input) => input.kind === 'file',
  async import(input) {
    if (input.kind !== 'file') throw new Error('本地文件适配器无法读取此输入。');
    const { file } = input;
    if (isPngFile(file)) {
      if (file.size > MAX_PNG_CARD_BYTES) throw new Error(`PNG 角色卡超过 ${MAX_PNG_CARD_BYTES / 1024 / 1024} MB 的本地解析上限。`);
      return parsePngCharacterCard(await file.arrayBuffer(), file.name);
    }
    return parseLorebook(await file.text(), file.name);
  },
};
