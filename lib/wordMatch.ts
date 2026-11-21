/**
 * JACET8000 には「doctor (doc)」「mom (mommy, mum, ...)」のように、括弧で別の言い方が
 * 付いた見出し語がある。入力された単語と見出し語を照合するときはこれを考慮する。
 */

/** 見出し語の本体（括弧を除いた部分）を小文字で返す。例: "doctor (doc)" → "doctor" */
export function baseWord(word: string): string {
  return word.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
}

/** 括弧内の別の言い方を小文字で返す。例: "doctor (doc)" → ["doc"] */
export function altWords(word: string): string[] {
  const m = word.match(/\(([^)]*)\)\s*$/);
  return m ? m[1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
}

/** 2つの単語（入力・見出し語のどちらでもよい）が同じ語を指しているか */
export function sameWord(a: string, b: string): boolean {
  const keysA = [baseWord(a), ...altWords(a)];
  const keysB = [baseWord(b), ...altWords(b)];
  return keysA.some(k => keysB.includes(k));
}
