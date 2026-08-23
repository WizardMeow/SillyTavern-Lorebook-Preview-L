import { LorebookParseError, type Lorebook } from '../../../domain/lorebook';
import { adaptCharacterCard, isCharacterCard } from './character-card';
import { jsonRecordSchema } from './shared';
import { adaptWorldInfo, isWorldInfo } from './world-info';

/**
 * The single import seam. Adding another source format means adding another
 * adapter here; callers never need to know that format's fields.
 */
export function parseLorebook(jsonText: string, source = '已粘贴的 JSON'): Lorebook {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonText) as unknown;
  } catch {
    throw new LorebookParseError('这不是有效的 JSON。请确认没有多余逗号或不完整的引号。');
  }
  const document = jsonRecordSchema.safeParse(parsedJson);
  if (!document.success) throw new LorebookParseError('输入的根节点必须是 JSON 对象。');

  if (isWorldInfo(document.data)) return adaptWorldInfo(document.data, source);
  if (isCharacterCard(document.data)) return adaptCharacterCard(document.data, source);
  throw new LorebookParseError('未识别为独立 SillyTavern 世界书，也未识别为带 data.character_book 的角色卡。');
}
