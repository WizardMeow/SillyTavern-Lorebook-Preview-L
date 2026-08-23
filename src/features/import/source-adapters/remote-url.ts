import { parseLorebook } from '../adapters';
import { MAX_PNG_CARD_BYTES, parsePngCharacterCard } from '../adapters/png-character-card';
import { looksLikeHttpUrl, type ImportSourceAdapter } from './contracts';

/** Discord's media proxy can transcode a PNG to WebP and strip its card data. */
export function normalizeImportUrl(value: string): string {
  const url = new URL(value);
  if (url.hostname.toLowerCase() === 'media.discordapp.net') {
    url.searchParams.delete('format');
    url.searchParams.delete('quality');
    url.searchParams.delete('');
    return url.toString();
  }
  return value;
}

export const remoteUrlImportAdapter: ImportSourceAdapter = {
  id: 'remote-url',
  canHandle: (input) => input.kind === 'text' && looksLikeHttpUrl(input.value.trim()),
  async import(input) {
    if (input.kind !== 'text') throw new Error('URL 适配器无法读取此输入。');
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeImportUrl(input.value.trim());
    } catch {
      throw new Error('请输入有效的绝对 HTTP(S) URL。');
    }

    let response: Response;
    try {
      response = await fetch(normalizedUrl, { headers: { Accept: 'application/json, image/png;q=0.9' } });
    } catch {
      throw new Error('无法请求此 URL。它可能不允许跨域访问（CORS），可先下载后拖入本页。');
    }
    if (!response.ok) throw new Error(`URL 返回了 HTTP ${response.status}。`);

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (contentType.includes('image/png')) {
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_PNG_CARD_BYTES) throw new Error(`PNG 角色卡超过 ${MAX_PNG_CARD_BYTES / 1024 / 1024} MB 的本地解析上限。`);
      return parsePngCharacterCard(await response.arrayBuffer(), normalizedUrl);
    }
    return parseLorebook(await response.text(), normalizedUrl);
  },
};
