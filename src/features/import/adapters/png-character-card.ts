import { LorebookParseError, type Lorebook } from '../../../domain/lorebook';
import { parseLorebook } from './index';

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
export const MAX_PNG_CARD_BYTES = 25 * 1024 * 1024;
const MAX_PNG_CHUNK_BYTES = 8 * 1024 * 1024;

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}

function readTextChunk(bytes: Uint8Array): { keyword: string; text: string } | null {
  const separator = bytes.indexOf(0);
  if (separator < 1) return null;
  return {
    keyword: new TextDecoder('latin1').decode(bytes.slice(0, separator)),
    text: new TextDecoder('latin1').decode(bytes.slice(separator + 1)),
  };
}

function decodeBase64Utf8(value: string): string {
  try {
    const binary = atob(value.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new LorebookParseError('PNG 角色卡的 `chara` / `ccv3` 元数据不是有效的 Base64 UTF-8 JSON。');
  }
}

/**
 * Reads the PNG carriage layer only. The decoded character-card JSON is passed
 * to the existing character-card adapter, which remains the sole owner of the
 * `data.character_book` document format.
 */
export function parsePngCharacterCard(buffer: ArrayBuffer, source: string): Lorebook {
  if (buffer.byteLength > MAX_PNG_CARD_BYTES) {
    throw new LorebookParseError(`PNG 角色卡超过 ${MAX_PNG_CARD_BYTES / 1024 / 1024} MB 的本地解析上限。`);
  }
  const bytes = new Uint8Array(buffer);
  if (!isPng(bytes)) throw new LorebookParseError('此文件不是有效的 PNG。请上传原始角色卡文件，而不是重命名后的图片。');

  const view = new DataView(buffer);
  let offset = PNG_SIGNATURE.length;
  let chara: string | undefined;
  let ccv3: string | undefined;

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (length > MAX_PNG_CHUNK_BYTES || dataEnd + 4 > bytes.length) {
      throw new LorebookParseError('PNG 的元数据区块损坏或过大，已停止解析。');
    }
    const type = new TextDecoder('ascii').decode(bytes.slice(offset + 4, dataStart));
    if (type === 'tEXt') {
      const textChunk = readTextChunk(bytes.slice(dataStart, dataEnd));
      if (textChunk?.keyword.toLowerCase() === 'ccv3') ccv3 = textChunk.text;
      if (textChunk?.keyword.toLowerCase() === 'chara') chara = textChunk.text;
    }
    offset = dataEnd + 4;
  }

  const payload = ccv3 ?? chara;
  if (!payload) {
    throw new LorebookParseError('这个 PNG 没有嵌入 `chara` 或 `ccv3` 角色卡元数据；它可能只是普通图片。');
  }
  return parseLorebook(decodeBase64Utf8(payload), source);
}
