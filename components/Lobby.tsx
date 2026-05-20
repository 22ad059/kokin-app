interface LobbyProps {
  isPvP: boolean;
  setIsPvP: (v: boolean) => void;
  theme: string;
  setTheme: (v: string) => void;
  charLimit: number | null;
  setCharLimit: (v: number | null) => void;
  onStart: () => void;
}

export default function Lobby({ isPvP, setIsPvP, theme, setTheme, charLimit, setCharLimit, onStart }: LobbyProps) {
  return (
    <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
      {/* モード選択 */}
      <div className="p-6 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">ゲームモード</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setIsPvP(false)}
            className={`py-4 rounded-2xl font-bold text-sm transition-all ${
              !isPvP
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
            }`}
          >
            <div className="text-2xl mb-1">🤖</div>
            <div>ソロ</div>
            <div className="text-[10px] opacity-70 mt-0.5">AI と対戦</div>
          </button>
          <button
            onClick={() => setIsPvP(true)}
            className={`py-4 rounded-2xl font-bold text-sm transition-all ${
              isPvP
                ? 'bg-rose-500 text-white shadow-md shadow-rose-200'
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
            }`}
          >
            <div className="text-2xl mb-1">⚔️</div>
            <div>対戦</div>
            <div className="text-[10px] opacity-70 mt-0.5">2人で勝負</div>
          </button>
        </div>
      </div>

      {/* テーマ入力 */}
      <div className="p-6 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">テーマ</p>
        <input
          className="w-full border-2 border-slate-200 p-3 rounded-2xl outline-none focus:border-indigo-400 transition-all text-center font-bold text-lg text-slate-700 placeholder:text-slate-300"
          placeholder="例：OCEAN、ANIMAL..."
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && theme && onStart()}
        />
        <p className="text-xs text-slate-400 mt-2 text-center">英語でテーマを入力してください</p>
      </div>

      {/* 文字数制限 */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">文字数制限</p>
          <button
            onClick={() => setCharLimit(charLimit === null ? 5 : null)}
            className={`relative w-10 h-6 rounded-full transition-colors ${charLimit !== null ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${charLimit !== null ? 'left-5' : 'left-1'}`} />
          </button>
        </div>
        {charLimit !== null && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCharLimit(Math.max(2, charLimit - 1))}
              className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
            >−</button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-black text-slate-800">{charLimit}</span>
              <span className="text-sm text-slate-400 ml-1">文字</span>
            </div>
            <button
              onClick={() => setCharLimit(Math.min(12, charLimit + 1))}
              className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
            >＋</button>
          </div>
        )}
        {charLimit === null && (
          <p className="text-xs text-slate-400">オフのときは文字数制限なし</p>
        )}
      </div>

      {/* スタートボタン */}
      <div className="p-6">
        <button
          onClick={onStart}
          disabled={!theme}
          className={`w-full py-4 rounded-2xl font-bold text-white text-base transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
            isPvP
              ? 'bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-200'
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
          }`}
        >
          ゲームスタート！
        </button>
      </div>
    </div>
  );
}
