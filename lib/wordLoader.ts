import type { WordEntry } from '@/types/study';
// scripts/buildWords.mjs が Excel から生成する（predev / prebuild で自動実行）。
// Cloudflare Workers は実行時にファイルを読めないため、データをコードに同梱している。
import words from '@/data/words.generated.json';
import { baseWord, altWords } from '@/lib/wordMatch';

export type { WordEntry };

export function loadWords(): WordEntry[] {
  return words as WordEntry[];
}

function findEntry(word: string): WordEntry | undefined {
  const words = loadWords();
  const lower = word.trim().toLowerCase();
  return words.find(w => w.word.toLowerCase() === lower || baseWord(w.word) === lower)
    ?? words.find(w => altWords(w.word).includes(lower));
}

export function lookupTranslation(word: string): string {
  return findEntry(word)?.translation || '';
}

export function lookupEntry(word: string): WordEntry | undefined {
  return findEntry(word);
}
