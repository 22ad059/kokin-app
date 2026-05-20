import { ChatMessage } from '@/types/game';

interface GameBoardProps {
  isPvP: boolean;
  currentPlayer: number;
  scores: { p1: number; p2: number };
  totalScore: number;
  theme: string;
  charLimit: number | null;
  history: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  onPlayTurn: () => void;
  onReset: () => void;
  onEndGame: () => void;
}

export default function GameBoard({
  isPvP, currentPlayer, scores, totalScore,
  theme, charLimit, history, input, setInput, loading,
  onPlayTurn, onReset, onEndGame,
}: GameBoardProps) {
  const isP1Turn = !isPvP || currentPlayer === 1;
  const accentBg = isP1Turn ? 'bg-indigo-600' : 'bg-rose-500';

  const bubbleColor = (item: ChatMessage) => {
    if (item.isUser) return 'bg-indigo-600 text-white rounded-tr-none';
    if (isPvP) return 'bg-rose-500 text-white rounded-tl-none';
    return 'bg-slate-100 text-slate-700 rounded-tl-none';
  };

  return (
    <div className="w-full max-w-lg flex flex-col gap-3">
      {/* ナビゲーション */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
        >
          ← 戻る
        </button>
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
          <span className="text-slate-400 text-xs font-semibold">テーマ</span>
          <span className="text-slate-700 text-sm font-bold">{theme.toUpperCase()}</span>
        </div>
        {!isPvP && history.length > 0 && (
          <button
            onClick={onEndGame}
            className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
          >
            終了 →
          </button>
        )}
        {isPvP && <div className="w-16" />}
      </div>

      {/* ステータス＆スコア */}
      <div className={`${accentBg} rounded-2xl p-4 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold opacity-70">
              {isPvP ? `プレイヤー ${currentPlayer} のターン` : 'ソロモード'}
            </p>
            <p className="text-lg font-bold mt-0.5">
              {isPvP ? (currentPlayer === 1 ? 'あなたが先手！' : '後手のターン') : 'AI と勝負中'}
            </p>
          </div>
          <div className="text-right">
            {isPvP ? (
              <div className="flex gap-3">
                <div className="text-center">
                  <p className="text-xs opacity-70">P1</p>
                  <p className="text-xl font-black">{scores.p1}</p>
                </div>
                <div className="w-px bg-white/30" />
                <div className="text-center">
                  <p className="text-xs opacity-70">P2</p>
                  <p className="text-xl font-black">{scores.p2}</p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xs opacity-70">スコア</p>
                <p className="text-2xl font-black">{totalScore}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* チャット履歴 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 h-96 overflow-y-auto flex flex-col gap-3">
        {history.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-sm font-medium">最初の英単語を入力してください</p>
          </div>
        ) : (
          history.map((item, i) => (
            <div key={i} className={`flex ${item.isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm ${bubbleColor(item)}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold">{item.word}</span>
                  {item.cefr && (
                    <span className="bg-yellow-400 text-slate-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {item.cefr}
                    </span>
                  )}
                </div>
                {item.translation && (
                  <p className={`text-xs mt-1 ${item.isUser || isPvP ? 'opacity-80' : 'text-slate-500'}`}>
                    {item.translation}
                  </p>
                )}
                {item.score && (
                  <p className="text-[11px] mt-1.5 font-bold opacity-80">+{item.score} pt</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 入力エリア */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2">
        {charLimit !== null && (
          <div className="flex justify-center mb-1.5">
            {Array.from({ length: charLimit }).map((_, i) => (
              <span
                key={i}
                className={`mx-0.5 w-5 h-1.5 rounded-full transition-colors ${i < input.length ? (input.length === charLimit ? 'bg-emerald-400' : 'bg-indigo-400') : 'bg-slate-200'}`}
              />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            className="flex-1 px-3 py-2.5 outline-none text-slate-700 font-medium placeholder:text-slate-300"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onPlayTurn()}
            placeholder={charLimit !== null ? `${charLimit}文字の英単語...` : '英単語を入力...'}
            autoFocus
          />
          {charLimit !== null && (
            <span className={`text-sm font-bold tabular-nums w-10 text-center ${input.length === charLimit ? 'text-emerald-500' : input.length > charLimit ? 'text-rose-500' : 'text-slate-300'}`}>
              {input.length}/{charLimit}
            </span>
          )}
          <button
            onClick={onPlayTurn}
            disabled={loading || !input || (charLimit !== null && input.length !== charLimit)}
            className={`px-6 py-2.5 rounded-xl font-bold text-white transition-all active:scale-95 disabled:opacity-40 ${accentBg}`}
          >
            {loading ? '判定中...' : '送信'}
          </button>
        </div>
      </div>
    </div>
  );
}
