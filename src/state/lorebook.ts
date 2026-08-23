import { atom } from 'jotai';
import type { ContentRenderMode, Lorebook } from '../domain/lorebook';

export const lorebookAtom = atom<Lorebook | null>(null);
export const searchQueryAtom = atom('');
export const selectedEntryIdAtom = atom<string | null>(null);
export const contentRenderModeAtom = atom<ContentRenderMode>('markdown');
