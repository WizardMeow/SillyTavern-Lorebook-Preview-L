import type { ImportSourceAdapter } from './contracts';
import { jsonTextImportAdapter } from './json-text';
import { localFileImportAdapter } from './local-file';
import { remoteUrlImportAdapter } from './remote-url';

export { importInputSchema, isHttpUrl, looksLikeHttpUrl, type ImportInput, type ImportSourceAdapter } from './contracts';
export { normalizeImportUrl } from './remote-url';

export const importSourceAdapters: readonly ImportSourceAdapter[] = [
  remoteUrlImportAdapter,
  jsonTextImportAdapter,
  localFileImportAdapter,
];
