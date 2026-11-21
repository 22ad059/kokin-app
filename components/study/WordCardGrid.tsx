import type { WordEntry } from '@/types/study';
import { LEVEL_BADGE } from '@/lib/constants';

interface Props {
  words: WordEntry[];
  /** JACET8000 の順位を表示する */
  showRank?: boolean;
  /** 選択モード: カードを押すと onToggle が呼ばれ、selected に含まれる単語に印が付く */
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (word: string) => void;
}

/** 単語カード一覧（練習ゲーム・単語学習で共通） */
export default function WordCardGrid({ words, showRank, selectable, selected, onToggle }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {words.map((w, i) => {
        const isSelected = !!selectable && !!selected?.has(w.word);
        const content = (
          <>
            {/* 1段目: レベルと品詞（と順位） */}
            <p className="flex items-center justify-center gap-1.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${LEVEL_BADGE[w.level] ?? 'bg-white/10 text-white/40'}`}>
                {w.level.replace('Level ', 'Lv.')}
              </span>
              {w.pos && <span className="text-[10px] text-white/40">{w.pos}</span>}
              {showRank && <span className="text-[10px] text-white/25 tabular-nums">#{w.rank}</span>}
            </p>
            {/* 英単語（大きく）の下に和訳（小さく）。どのカードも同じ形になる */}
            {/* 「mom (mommy, mum, ...)」のような括弧内の別の言い方は小さく分けて表示する */}
            {(() => {
              const m = w.word.match(/^(.*?)\s*\((.*)\)\s*$/);
              return (
                <p className="leading-tight break-words">
                  <span className="font-black text-xl text-white tracking-wide">{m ? m[1] : w.word}</span>
                  {m && <span className="block text-[11px] font-bold text-white/45 mt-0.5">({m[2]})</span>}
                </p>
              );
            })()}
            <p className="text-[13px] font-medium text-white/60 leading-snug">{w.translation || '—'}</p>
            {isSelected && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded bg-violet-500 text-[10px] text-white font-black flex items-center justify-center">✓</span>
            )}
          </>
        );
        const base = 'relative w-full h-full flex flex-col items-center justify-center gap-1 text-center rounded-2xl px-3 py-2.5 border transition-colors';
        return (
          <li key={`${w.word}-${i}`}>
            {selectable ? (
              <button
                type="button"
                onClick={() => onToggle?.(w.word)}
                aria-pressed={isSelected}
                className={`${base} ${isSelected ? 'bg-violet-500/15 border-violet-400/60' : 'bg-white/[0.07] border-white/10 hover:bg-white/10'}`}
              >
                {content}
              </button>
            ) : (
              <div className={`${base} bg-white/[0.07] border-white/10`}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
