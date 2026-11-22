/**
 * つづりを直したときに、どの文字をまちがえたかを見せる。
 * 例: natrue → nature なら「tr」「ur」の部分に色を付ける。
 * 文字が抜けていたときは、入力の側の抜けた位置に「_」を出す。
 */
export default function SpellDiff({ typed, correct }: { typed: string; correct: string }) {
  const a = typed.toLowerCase();
  const b = correct.toLowerCase();
  // 前から同じ部分と、後ろから同じ部分を取り除いた残りが、まちがえた部分
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;

  const parts = (w: string) => ({
    head: w.slice(0, pre),
    mid: w.slice(pre, w.length - suf),
    tail: w.slice(w.length - suf),
  });
  const t = parts(typed);
  const c = parts(correct);

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap text-[13px] font-bold tracking-wide">
      <span>
        {t.head}
        <mark className="bg-rose-600 text-white rounded px-0.5 mx-px">{t.mid || '_'}</mark>
        {t.tail}
      </span>
      <span className="opacity-60">→</span>
      <span>
        {c.head}
        {/* 余分な文字を入れていたときは、正しいつづりの側には色を付ける文字がない */}
        {c.mid && <mark className="bg-emerald-500 text-white rounded px-0.5 mx-px">{c.mid}</mark>}
        {c.tail}
      </span>
    </span>
  );
}
