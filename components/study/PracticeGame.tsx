import { useRef, useEffect } from 'react';
import { LEVEL_BADGE } from '@/lib/constants';
import type { WordEntry, PracticeMessage } from '@/types/study';

type Variant = 'violet' | 'amber';

const COLORS: Record<Variant, {
  scoreBadge: string;
  progressBar: string;
  userBubble: string;
  chipHover: string;
  spinner: string;
  restartBtn: string;
}> = {
  violet: {
    scoreBadge:  'from-violet-500/20 to-indigo-500/20 border-violet-400/20',
    progressBar: 'from-violet-400 to-indigo-400 shadow-[0_0_8px_rgba(139,92,246,0.6)]',
    userBubble:  'from-violet-500 to-indigo-600 shadow-violet-500/20',
    chipHover:   'hover:bg-violet-500/20 hover:border-violet-400/30',
    spinner:     'border-violet-400/40 border-t-violet-400',
    restartBtn:  'from-violet-500 to-indigo-600',
  },
  amber: {
    scoreBadge:  'from-amber-500/20 to-orange-500/20 border-amber-400/20',
    progressBar: 'from-amber-400 to-orange-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
    userBubble:  'from-amber-500 to-orange-600 shadow-amber-500/20',
    chipHover:   'hover:bg-amber-500/20 hover:border-amber-400/30',
    spinner:     'border-amber-400/40 border-t-amber-400',
    restartBtn:  'from-amber-500 to-orange-600',
  },
};

interface Props {
  wordList: WordEntry[];
  history: PracticeMessage[];
  score: number;
  gameOver: boolean;
  gameOverReason: string;
  gameLoading: boolean;
  errorMsg?: string;
  onPlayWord: (word: string) => void;
  onRestart: () => void;
  onBack: () => void;
  backLabel?: string;
  variant?: Variant;
}

export default function PracticeGame({
  wordList, history, score, gameOver, gameOverReason,
  gameLoading, errorMsg, onPlayWord, onRestart, onBack, backLabel = '← 戻る', variant = 'violet',
}: Props) {
  const c = COLORS[variant];
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [history]);

  const usedSet = new Set(history.map(h => h.word.toLowerCase()));
  const remaining = wordList.filter(w => !usedSet.has(w.word.toLowerCase()));
  const progressPct = wordList.length ? Math.round((usedSet.size / wordList.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors">
          {backLabel}
        </button>
        <div className={`flex items-center gap-2 bg-gradient-to-r ${c.scoreBadge} border px-4 py-2 rounded-full`}>
          <span className="text-white font-black text-xl">{score}</span>
          <span className="text-white/40 text-xs">pt</span>
        </div>
      </div>

      {/* 進捗バー */}
      <div>
        <div className="flex justify-between text-xs text-white/30 mb-1.5">
          <span>練習モード · {wordList.length} 語</span>
          <span>{usedSet.size} / {wordList.length} 使用済み</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1">
          <div
            className={`bg-gradient-to-r ${c.progressBar} h-1 rounded-full transition-all duration-500`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* チャット履歴 */}
      <div ref={chatRef} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 h-72 overflow-y-auto flex flex-col gap-3">
        {history.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20">
            <p className="text-3xl mb-2">🎯</p>
            <p className="text-sm font-medium">下のカードから単語を選んで始めよう</p>
          </div>
        ) : (
          history.map((item, i) => (
            <div key={i} className={`flex animate-bubble-in ${item.isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] px-4 py-3 rounded-2xl ${
                item.isUser
                  ? `bg-gradient-to-br ${c.userBubble} text-white rounded-tr-none shadow-lg`
                  : 'bg-white/10 text-white border border-white/10 rounded-tl-none backdrop-blur-sm'
              }`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-black">{item.word}</span>
                  {item.level && item.level !== 'Unknown' && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${LEVEL_BADGE[item.level] ?? 'bg-white/20 text-white'}`}>
                      {item.level.replace('Level ', 'Lv.')}
                    </span>
                  )}
                </div>
                {item.translation && (
                  <p className="text-xs mt-1 text-white/60">{item.translation}</p>
                )}
                {item.score != null && item.score > 0 && (
                  <p className="text-[11px] mt-1.5 font-bold text-white/50">+{item.score} pt</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* エラー表示 */}
      {errorMsg && !gameOver && (
        <div role="alert" className="bg-rose-500/15 border border-rose-400/30 text-rose-300 text-sm font-bold rounded-2xl px-4 py-3 text-center backdrop-blur-sm">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 単語チップ or ゲームオーバー */}
      {gameOver ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center animate-fade-up">
          <p className="text-4xl mb-3 animate-pop-in">🎉</p>
          <p className="text-white font-black text-xl">{gameOverReason}</p>
          <p className="text-white/40 text-sm mt-1">スコア: {score} pt</p>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              onClick={onRestart}
              className={`py-3 rounded-2xl font-black text-white bg-gradient-to-r ${c.restartBtn} text-sm active:scale-95 transition-all`}
            >
              もう一回
            </button>
            <button
              onClick={onBack}
              className="py-3 rounded-2xl font-black text-white/50 bg-white/5 border border-white/10 text-sm active:scale-95 transition-all hover:bg-white/10"
            >
              戻る
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-white/30 mb-3">
            {gameLoading ? 'AI が考え中...' : `残り ${remaining.length} 語（タップして使う）`}
          </p>
          {gameLoading ? (
            <div className="flex justify-center py-2">
              <div className={`w-6 h-6 border-2 ${c.spinner} rounded-full animate-spin`} />
            </div>
          ) : remaining.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-2">使える単語がありません</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
              {remaining.map(w => (
                <button
                  key={w.word}
                  onClick={() => onPlayWord(w.word)}
                  disabled={gameLoading}
                  className={`flex flex-col items-start px-3 py-2.5 rounded-xl bg-white/8 border border-white/10 text-left ${c.chipHover} transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between w-full gap-1 mb-0.5">
                    <span className="font-black text-sm text-white truncate">{w.word}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${LEVEL_BADGE[w.level] ?? 'bg-white/10 text-white/40'}`}>
                      {w.level.replace('Level ', 'Lv.')}
                    </span>
                  </div>
                  {w.translation && (
                    <span className="text-[11px] text-white/40 truncate w-full leading-tight">{w.translation}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
