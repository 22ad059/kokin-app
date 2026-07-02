import { ChatMessage } from '@/types/game';
import { LEVEL_COLORS } from '@/lib/constants';

interface ResultScreenProps {
  isPvP: boolean;
  losingPlayer: number | null;
  scores: { p1: number; p2: number };
  totalScore: number;
  history: ChatMessage[];
  theme: string;
  reason: string;
  onRematch: () => void;
  onReset: () => void;
}

export default function ResultScreen({
  isPvP, losingPlayer, scores, totalScore, history, theme, reason, onRematch, onReset,
}: ResultScreenProps) {
  const winningPlayer = losingPlayer === 1 ? 2 : 1;
  const p1Words = history.filter(h => h.isUser).length;
  const p2Words = history.filter(h => !h.isUser).length;
  const soloWords = history.filter(h => h.isUser).length;

  // ソロでは AI の単語を除き、自分が回答した単語だけを集計する
  const levelCounts = (isPvP ? history : history.filter(h => h.isUser))
    .reduce<Record<string, number>>((acc, h) => {
      if (h.level) acc[h.level] = (acc[h.level] || 0) + 1;
      return acc;
    }, {});


  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
      {/* 結果ヘッダー */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
        <div className={`px-6 pt-8 pb-6 text-center ${
          isPvP
            ? 'bg-gradient-to-b from-amber-500/20 to-transparent'
            : 'bg-gradient-to-b from-indigo-500/20 to-transparent'
        }`}>
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">
            テーマ：{theme.toUpperCase()}
          </p>
          {isPvP ? (
            <>
              <p className="text-5xl mb-3 animate-pop-in">🏆</p>
              <p className="text-2xl font-black text-white">
                プレイヤー {winningPlayer} の勝利！
              </p>
              {reason && (
                <p className="text-sm text-white/40 mt-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                  {reason}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-5xl mb-3 animate-pop-in">🎯</p>
              <p className="text-5xl font-black text-white tabular-nums drop-shadow-[0_0_16px_rgba(129,140,248,0.5)]">
                {totalScore}
                <span className="text-lg font-bold text-white/30 ml-1">pt</span>
              </p>
              <p className="text-white/40 text-sm mt-1">トータルスコア</p>
              {reason && (
                <p className="text-sm text-white/40 mt-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                  {reason}
                </p>
              )}
            </>
          )}
        </div>

        {/* スコア詳細 */}
        <div className="px-6 pb-6">
          {isPvP ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {([1, 2] as const).map(p => {
                  const isWinner = p === winningPlayer;
                  const score = p === 1 ? scores.p1 : scores.p2;
                  const words = p === 1 ? p1Words : p2Words;
                  const gradient = p === 1 ? 'from-indigo-500/20 to-violet-500/20 border-indigo-400/30' : 'from-rose-500/20 to-pink-500/20 border-rose-400/30';
                  return (
                    <div
                      key={p}
                      className={`rounded-2xl p-4 text-center border bg-gradient-to-br transition-all ${
                        isWinner ? gradient : 'border-white/5 bg-white/3 opacity-50'
                      }`}
                    >
                      <p className="text-xs font-bold text-white/40 mb-1">
                        {isWinner ? '👑 ' : ''}プレイヤー {p}
                      </p>
                      <p className="text-3xl font-black text-white">{score}</p>
                      <p className="text-xs text-white/30 mt-1">{words} 単語</p>
                    </div>
                  );
                })}
              </div>
              {Object.keys(levelCounts).length > 0 && (
                <div>
                  <p className="text-xs text-white/30 mb-2">JACET8000 レベル内訳</p>
                  <div className="flex gap-2 flex-wrap">
                    {(['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7', 'Level 8', 'Unknown'] as const).map(lv =>
                      levelCounts[lv] ? (
                        <span key={lv} className={`border px-2.5 py-1 rounded-full text-xs font-black ${LEVEL_COLORS[lv]}`}>
                          {lv === 'Unknown' ? '圏外' : lv.replace('Level ', 'Lv.')} × {levelCounts[lv]}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-sm text-white/40">回答した単語数</span>
                <span className="font-black text-white">{soloWords} 語</span>
              </div>
              {Object.keys(levelCounts).length > 0 && (
                <div>
                  <p className="text-xs text-white/30 mb-2">JACET8000 レベル内訳</p>
                  <div className="flex gap-2 flex-wrap">
                    {(['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7', 'Level 8', 'Unknown'] as const).map(lv =>
                      levelCounts[lv] ? (
                        <span
                          key={lv}
                          className={`border px-2.5 py-1 rounded-full text-xs font-black ${LEVEL_COLORS[lv]}`}
                        >
                          {lv === 'Unknown' ? '圏外' : lv.replace('Level ', 'Lv.')} × {levelCounts[lv]}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* アクションボタン */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onRematch}
          className="py-4 rounded-2xl font-black text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 hover:from-indigo-400 hover:to-violet-500 transition-all active:scale-95"
        >
          もう一回
        </button>
        <button
          onClick={onReset}
          className="py-4 rounded-2xl font-black text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95 backdrop-blur-sm"
        >
          ロビーへ
        </button>
      </div>
    </div>
  );
}
