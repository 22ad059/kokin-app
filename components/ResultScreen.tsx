import { ChatMessage } from '@/types/game';

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

  const cefrCounts = history.reduce<Record<string, number>>((acc, h) => {
    if (h.cefr) acc[h.cefr] = (acc[h.cefr] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="w-full max-w-sm flex flex-col gap-4">
      {/* 結果ヘッダー */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
        <div className={`px-6 pt-8 pb-6 text-center ${isPvP ? 'bg-gradient-to-b from-amber-50 to-white' : 'bg-gradient-to-b from-indigo-50 to-white'}`}>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            テーマ：{theme.toUpperCase()}
          </p>
          {isPvP ? (
            <>
              <p className="text-5xl mb-2">🏆</p>
              <p className="text-2xl font-bold text-slate-800">
                プレイヤー {winningPlayer} の勝利！
              </p>
              {reason && (
                <p className="text-sm text-slate-400 mt-2 bg-slate-50 rounded-xl px-4 py-2">
                  {reason}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-5xl mb-2">🎯</p>
              <p className="text-4xl font-black text-indigo-600">{totalScore} <span className="text-lg font-bold text-slate-400">pt</span></p>
              <p className="text-slate-500 text-sm mt-1">トータルスコア</p>
              {reason && (
                <p className="text-sm text-slate-400 mt-3 bg-slate-50 rounded-xl px-4 py-2">
                  {reason}
                </p>
              )}
            </>
          )}
        </div>

        {/* スコア詳細 */}
        <div className="px-6 pb-6">
          {isPvP ? (
            <div className="grid grid-cols-2 gap-3">
              {([1, 2] as const).map(p => {
                const isWinner = p === winningPlayer;
                const score = p === 1 ? scores.p1 : scores.p2;
                const words = p === 1 ? p1Words : p2Words;
                return (
                  <div
                    key={p}
                    className={`rounded-2xl p-4 text-center border-2 transition-all ${
                      isWinner
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-slate-100 bg-slate-50 opacity-60'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-500 mb-1">
                      {isWinner ? '👑 ' : ''}プレイヤー {p}
                    </p>
                    <p className={`text-3xl font-black ${isWinner ? 'text-slate-800' : 'text-slate-400'}`}>
                      {score}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{words} 単語</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">回答した単語数</span>
                <span className="font-bold text-slate-700">{soloWords} 語</span>
              </div>
              {Object.keys(cefrCounts).length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">CEFRレベル内訳</p>
                  <div className="flex gap-2 flex-wrap">
                    {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map(level =>
                      cefrCounts[level] ? (
                        <span key={level} className="bg-yellow-100 text-yellow-800 border border-yellow-300 px-2.5 py-1 rounded-full text-xs font-bold">
                          {level} × {cefrCounts[level]}
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
          className="py-4 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
        >
          もう一回
        </button>
        <button
          onClick={onReset}
          className="py-4 rounded-2xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
        >
          ロビーへ
        </button>
      </div>
    </div>
  );
}
