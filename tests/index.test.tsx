import { expect, test } from '@rstest/core';
import { parseLorebook } from '../src/features/import/adapters';
import { parsePngCharacterCard } from '../src/features/import/adapters/png-character-card';
import { getLorebookEntrySortMode, sortLorebookEntries } from '../src/domain/lorebook';
import { createLorebookIndex } from '../src/features/reader/lorebook-index';

function pngWithTextMetadata(keyword: string, text: string): ArrayBuffer {
  const encoder = new TextEncoder();
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunkData = encoder.encode(`${keyword}\0${text}`);
  const chunk = new Uint8Array(12 + chunkData.length);
  new DataView(chunk.buffer).setUint32(0, chunkData.length);
  chunk.set(encoder.encode('tEXt'), 4);
  chunk.set(chunkData, 8);
  chunk.set(encoder.encode('IEND'), 8 + chunkData.length);
  return new Uint8Array([...signature, ...chunk]).buffer;
}

test('normalizes an object-shaped SillyTavern entries collection without dropping extra fields', () => {
  const book = parseLorebook(JSON.stringify({
    name: 'Example',
    entries: { '12': { uid: 12, key: ['Ciri'], keysecondary: ['witcher'], comment: 'Character', content: 'A skilled traveler.', disable: true, custom_extension: { color: 'blue' } } },
  }), 'book.json');

  expect(book.name).toBe('Example');
  expect(book.kind).toBe('world-info');
  expect(book.entries).toHaveLength(1);
  expect(book.entries[0]).toMatchObject({ id: '12', keys: ['Ciri'], secondaryKeys: ['witcher'], disabled: true });
  expect(book.entries[0].raw.custom_extension).toEqual({ color: 'blue' });
});

test('accepts an array-shaped entries collection and makes absent content readable', () => {
  const book = parseLorebook(JSON.stringify({ entries: [{ key: 'tavern' }] }));
  expect(book.entries[0]).toMatchObject({ id: '0', keys: ['tavern'], content: '' });
  expect(book.warnings[0]).toContain('没有 content');
});

test('uses the complete custom display index sequence before insertion priority', () => {
  const book = parseLorebook(JSON.stringify({ entries: {
    '2': { uid: 2, key: ['first'], order: 100, extensions: { display_index: 0 } },
    '7': { uid: 7, key: ['second'], constant: true, order: 50, extensions: { display_index: 1 } },
    '10': { uid: 10, key: ['third'], order: 250, extensions: { display_index: 2 } },
  } }));

  expect(getLorebookEntrySortMode(book.entries)).toBe('custom');
  expect(sortLorebookEntries(book.entries).map((entry) => entry.id)).toEqual(['2', '7', '10']);
});

test('preserves source order when custom display indexes are incomplete', () => {
  const book = parseLorebook(JSON.stringify({ entries: {
    '2': { uid: 2, key: ['low'], order: 100, extensions: { display_index: 0 } },
    '7': { uid: 7, key: ['constant'], constant: true, order: 50 },
    '10': { uid: 10, key: ['high'], order: 250 },
    '12': { uid: 12, key: ['disabled'], disable: true, order: 999 },
  } }));

  expect(getLorebookEntrySortMode(book.entries)).toBe('source');
  expect(sortLorebookEntries(book.entries).map((entry) => entry.id)).toEqual(['2', '7', '10', '12']);
});

test('indexes normalized search text and entry ids once per loaded book', () => {
  const book = parseLorebook(JSON.stringify({ entries: {
    '0': { uid: 20, key: ['Alpha'], content: 'First entry' },
    '1': { uid: 10, key: ['Beta'], content: 'Second entry' },
  } }));
  const index = createLorebookIndex(book);

  expect(index.get('10')?.content).toBe('Second entry');
  expect(index.search('ALPHA').map((entry) => entry.id)).toEqual(['20']);
});

test('recognizes a character card embedded character_book', () => {
  const book = parseLorebook(JSON.stringify({ data: { character_book: { name: 'Companion lore', entries: [{ id: 3, keys: ['Kael'], enabled: false, insertion_order: 42, content: 'A ranger.' }] } } }));
  expect(book.name).toBe('Companion lore');
  expect(book.kind).toBe('character-card');
  expect(book.entries[0]).toMatchObject({ id: '3', keys: ['Kael'], disabled: true, order: 42 });
});

test('recognizes a SillyTavern Quick Replies export', () => {
  const book = parseLorebook(JSON.stringify({
    version: 2,
    name: '露出玩法QR',
    qrList: [{ id: 2, label: '风险检定系统', title: '', message: '/rand from=1 to=100', isHidden: false }],
  }), 'quick-replies.json');

  expect(book).toMatchObject({ kind: 'quick-replies', name: '露出玩法QR' });
  expect(book.entries[0]).toMatchObject({ id: '2', keys: ['风险检定系统'], comment: '风险检定系统', content: '/rand from=1 to=100' });
});

test('extracts an embedded character-book from a PNG character card', () => {
  const card = { data: { character_book: { name: 'PNG Lore', entries: [{ id: 8, keys: ['harbor'], content: 'The harbor never sleeps.' }] } } };
  const base64 = btoa(new TextEncoder().encode(JSON.stringify(card)).reduce((text, byte) => text + String.fromCharCode(byte), ''));
  const book = parsePngCharacterCard(pngWithTextMetadata('chara', base64), 'card.png');

  expect(book).toMatchObject({ kind: 'character-card', name: 'PNG Lore' });
  expect(book.entries[0]).toMatchObject({ id: '8', keys: ['harbor'] });
});
