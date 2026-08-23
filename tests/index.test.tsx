import { expect, test } from '@rstest/core';
import { parseLorebook } from '../src/features/import/adapters';
import { parsePngCharacterCard } from '../src/features/import/adapters/png-character-card';

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

test('recognizes a character card embedded character_book', () => {
  const book = parseLorebook(JSON.stringify({ data: { character_book: { name: 'Companion lore', entries: [{ id: 3, keys: ['Kael'], enabled: false, insertion_order: 42, content: 'A ranger.' }] } } }));
  expect(book.name).toBe('Companion lore');
  expect(book.kind).toBe('character-card');
  expect(book.entries[0]).toMatchObject({ id: '3', keys: ['Kael'], disabled: true, order: 42 });
});

test('extracts an embedded character-book from a PNG character card', () => {
  const card = { data: { character_book: { name: 'PNG Lore', entries: [{ id: 8, keys: ['harbor'], content: 'The harbor never sleeps.' }] } } };
  const base64 = btoa(new TextEncoder().encode(JSON.stringify(card)).reduce((text, byte) => text + String.fromCharCode(byte), ''));
  const book = parsePngCharacterCard(pngWithTextMetadata('chara', base64), 'card.png');

  expect(book).toMatchObject({ kind: 'character-card', name: 'PNG Lore' });
  expect(book.entries[0]).toMatchObject({ id: '8', keys: ['harbor'] });
});
