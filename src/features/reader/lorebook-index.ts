import { sortLorebookEntries, type Lorebook, type LorebookEntry } from '../../domain/lorebook';

export type LorebookIndex = {
  get(id: string | null): LorebookEntry | undefined;
  search(query: string): LorebookEntry[];
};

function searchText(entry: LorebookEntry): string {
  return [entry.id, entry.comment, entry.content, ...entry.keys, ...entry.secondaryKeys]
    .join('\n')
    .toLocaleLowerCase();
}

/**
 * Reader-facing index seam. It performs work that is invariant for a loaded
 * book once, so rendering only asks for the currently visible entries.
 */
export function createLorebookIndex(book: Lorebook): LorebookIndex {
  const entries = sortLorebookEntries(book.entries);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const searchableEntries = entries.map((entry) => ({ entry, text: searchText(entry) }));

  return {
    get: (id) => (id ? byId.get(id) : undefined),
    search(query) {
      const needle = query.trim().toLocaleLowerCase();
      if (!needle) return entries;
      return searchableEntries.filter(({ text }) => text.includes(needle)).map(({ entry }) => entry);
    },
  };
}
