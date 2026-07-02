import { useRef, useEffect } from 'react';
import { ChatMessage } from '@/types/game';
import { LEVEL_BADGE } from '@/lib/constants';

interface GameBoardProps {
  isPvP: boolean;
  currentPlayer: number;
  scores: { p1: number; p2: number };
  totalScore: number;
  theme: string;
  charLimit: number | null;
  posLimit: string | null;
  history: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  errorMsg?: string;
  onPlayTurn: () => void;
  onReset: () => void;
  onEndGame: () => void;
}

export default function GameBoard({
  isPvP, currentPlayer, scores, totalScore,
  theme, charLimit, posLimit, history, input, setInput, loading, errorMsg,
  onPlayTurn, onReset, onEndGame,
}: GameBoardProps) {
  const isP1Turn = !isPvP || currentPlayer === 1;
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [history]);

  const statusGradient = isP1Turn
    ? 'from-indigo-500 to-violet-600'
    : 'from-rose-500 to-pink-600';

  const sendBtnGradient = isP1Turn
    ? 'from-indigo-500 to-violet-600 shadow-indigo-500/40'
    : 'from-rose-500 to-pink-600 shadow-rose-500/40';

  const bubbleStyle = (item: ChatMessage) => {
    if (item.isUser) return 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-tr-none shadow-lg shadow-indigo-500/20';
    if (isPvP) return 'bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-tl-none shadow-lg shadow-rose-500/20';
    return 'bg-white/10 text-white border border-white/10 rounded-tl-none backdrop-blur-sm';
  };

  return (
    <div className="w-full max-w-lg flex flex-col gap-3">
      {/* ナビゲーション */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors"
        >
          ← 戻る
        </button>
        <div className="flex items-center gap-2 bg-white/10 border border-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <span className="text-white/40 text-xs font-semibold">テーマ</span>
          <span className="text-white text-sm font-black tracking-wide">{theme.toUpperCase()}</span>
          {posLimit && (
            <span className="text-indigo-300 text-xs font-bold border-l border-white/15 pl-2">{posLimit}</span>
          )}
        </div>
        {!isPvP && history.length > 0 && (
          <button
            onClick={onEndGame}
            className="text-white/40 hover:text-white/70 text-sm font-medium transition-colors"
          >
            終了 →
          </button>
        )}
        {isPvP && <div className="w-16" />}
      </div>

      {/* ステータス＆スコア */}
      <div className={`bg-gradient-to-r ${statusGradient} rounded-2xl p-4 shadow-lg`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-white/60">
              {isPvP ? '2人対戦モード' : 'ソロモード'}
            </p>
            <p className="text-lg font-black text-white mt-0.5">
              {isPvP ? `プレイヤー ${currentPlayer} の番！` : 'AI と対戦中'}
            </p>
          </div>
          <div className="text-right">
            {isPvP ? (
              <div className="flex gap-4">
                {(['P1', 'P2'] as const).map((p, i) => (
                  <div key={p} className="text-center">
                    <p className="text-[10px] font-bold text-white/50">{p}</p>
                    <p className={`text-2xl font-black text-white ${(i === 0 ? currentPlayer === 1 : currentPlayer === 2) ? 'opacity-100' : 'opacity-40'}`}>
                      {i === 0 ? scores.p1 : scores.p2}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[10px] font-bold text-white/50">SCORE</p>
                <p className="text-3xl font-black text-white tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">{totalScore}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* チャット履歴 */}
      <div ref={chatRef} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 h-96 overflow-y-auto flex flex-col gap-3">
        {history.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-sm font-medium">最初の英単語を入力してください</p>
          </div>
        ) : (
          history.map((item, i) => (
            <div key={i} className={`flex animate-bubble-in ${item.isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] px-4 py-3 rounded-2xl ${bubbleStyle(item)}`}>
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
      {errorMsg && (
        <div role="alert" className="bg-rose-500/15 border border-rose-400/30 text-rose-300 text-sm font-bold rounded-2xl px-4 py-3 text-center backdrop-blur-sm">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 入力エリア */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2">
        {charLimit !== null && (
          <div className="flex justify-center mb-2">
            {Array.from({ length: charLimit }).map((_, i) => (
              <span
                key={i}
                className={`mx-0.5 w-5 h-1.5 rounded-full transition-colors ${
                  i < input.length
                    ? input.length === charLimit ? 'bg-emerald-400' : 'bg-indigo-400'
                    : 'bg-white/15'
                }`}
              />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            className="flex-1 bg-transparent px-3 py-2.5 outline-none text-white font-bold placeholder:text-white/20"
            value={input}
            maxLength={charLimit ?? undefined}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && onPlayTurn()}
            placeholder={
              charLimit !== null || posLimit
                ? `${[posLimit, charLimit !== null ? `${charLimit}文字` : ''].filter(Boolean).join('・')}の英単語...`
                : '英単語を入力...'
            }
            autoFocus
          />
          {charLimit !== null && (
            <span className={`text-sm font-black tabular-nums w-10 text-center ${
              input.length === charLimit ? 'text-emerald-400' : input.length > charLimit ? 'text-rose-400' : 'text-white/20'
            }`}>
              {input.length}/{charLimit}
            </span>
          )}
          <button
            onClick={onPlayTurn}
            disabled={loading || !input.trim() || (charLimit !== null && input.trim().length !== charLimit)}
            className={`px-6 py-2.5 rounded-xl font-black text-white bg-gradient-to-r ${sendBtnGradient} shadow-lg transition-all active:scale-95 disabled:opacity-30`}
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin align-[-2px]" />
            ) : '送信'}
          </button>
        </div>
      </div>
    </div>
  );
}
