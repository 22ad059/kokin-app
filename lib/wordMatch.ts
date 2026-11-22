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

/**
 * a と b が「1文字だけ違う」か（1文字の置き換え・抜け・余分・隣どうしの入れ替え）。
 * 同じ単語のときは false。
 */
export function oneEditApart(a: string, b: string): boolean {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) return true;
    // 隣どうしの入れ替え（例: freind → friend）
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < s.length && s[i] === l[i]) i++;
  return s.slice(i) === l.slice(i + 1);
}
