import type { WordEntry } from '@/types/study';
// scripts/buildWords.mjs が Excel から生成する（predev / prebuild で自動実行）。
// Cloudflare Workers は実行時にファイルを読めないため、データをコードに同梱している。
import words from '@/data/words.generated.json';
import { baseWord, altWords } from '@/lib/wordMatch';

export type { WordEntry };

export function loadWords(): WordEntry[] {
  return words as WordEntry[];
}

/**
 * 見出し語の索引（最初に 1 回だけ作る）。
 * 毎回 8000 語を先頭から探すと、出た単語が増えるほど判定が重くなり、
 * Cloudflare の計算時間の上限を超えて「通信エラー」になっていたため。
 * main: 見出し語そのもの・括弧を除いた本体 → 語 / alt: 括弧内の別の言い方 → 語
 * （どちらも辞書の並びで最初に出てくる語を使う。前の「先頭から探す」と同じ結果になる）
 */
let index: { main: Map<string, WordEntry>; alt: Map<string, WordEntry> } | null = null;
function getIndex() {
  if (index) return index;
  const main = new Map<string, WordEntry>();
  const alt = new Map<string, WordEntry>();
  for (const w of loadWords()) {
    for (const k of [w.word.toLowerCase(), baseWord(w.word)]) if (!main.has(k)) main.set(k, w);
    for (const k of altWords(w.word)) if (!alt.has(k)) alt.set(k, w);
  }
  index = { main, alt };
  return index;
}

function findEntry(word: string): WordEntry | undefined {
  const lower = word.trim().toLowerCase();
  const { main, alt } = getIndex();
  return main.get(lower) ?? alt.get(lower);
}

export function lookupTranslation(word: string): string {
  return findEntry(word)?.translation || '';
}

export function lookupEntry(word: string): WordEntry | undefined {
  return findEntry(word);
}
