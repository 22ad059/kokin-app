interface LobbyProps {
  isPvP: boolean;
  setIsPvP: (v: boolean) => void;
  theme: string;
  setTheme: (v: string) => void;
  charLimit: number | null;
  setCharLimit: (v: number | null) => void;
  onStart: () => void;
  onBack: () => void;
}

const PRESETS = ['ANIMAL', 'OCEAN', 'SPORT', 'FOOD', 'NATURE', 'BODY'];

const MODES = [
  { label: 'ソロ', sub: 'AI と対戦', icon: '🤖', pvp: false, gradient: 'from-indigo-500 to-violet-600 shadow-indigo-500/30' },
  { label: '対戦', sub: '2人で勝負', icon: '⚔️', pvp: true,  gradient: 'from-rose-500 to-pink-600 shadow-rose-500/30' },
] as const;

export default function Lobby({ isPvP, setIsPvP, theme, setTheme, charLimit, setCharLimit, onStart, onBack }: LobbyProps) {
  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
      <header className="mb-5">
        <button onClick={onBack} className="self-start inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors mb-6">
          ← トップへ戻る
        </button>
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-3xl">⚔️</span>
          <h1 className="text-3xl font-black text-white tracking-tight">対戦ゲーム</h1>
        </div>
        <p className="text-white/40 text-sm text-center">テーマを決めて英単語を出し合おう</p>
      </header>

      {/* モード選択 */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">ゲームモード</p>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map(({ label, sub, icon, pvp, gradient }) => (
            <button
              key={label}
              onClick={() => setIsPvP(pvp)}
              className={`py-4 rounded-2xl font-bold text-sm transition-all border ${
                isPvP === pvp
                  ? `bg-gradient-to-br ${gradient} text-white shadow-lg border-transparent`
                  : 'bg-white/5 text-white/40 hover:bg-white/10 border-white/10'
              }`}
            >
              <div className="text-2xl mb-1">{icon}</div>
              <div>{label}</div>
              <div className="text-[10px] opacity-60 mt-0.5">{sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* テーマ入力 */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">テーマ</p>
        <input
          autoFocus
          className="w-full bg-white/10 border border-white/10 text-white font-bold text-lg text-center p-3 rounded-2xl outline-none focus:border-indigo-400 focus:bg-white/15 transition-all placeholder:text-white/20"
          placeholder="例：OCEAN、ANIMAL..."
          value={theme}
          onChange={(e) => setTheme(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && theme && onStart()}
        />
        <div className="flex flex-wrap gap-1.5 mt-3">
          {PRESETS.map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all ${
                theme === t
                  ? 'bg-indigo-500/30 border-indigo-400/50 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 文字数制限 */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">文字数制限</p>
          <button
            onClick={() => setCharLimit(charLimit === null ? 5 : null)}
            className={`relative w-11 h-6 rounded-full transition-colors ${charLimit !== null ? 'bg-indigo-500' : 'bg-white/15'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${charLimit !== null ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        {charLimit !== null ? (
          <div className="flex items-center gap-3">
            <button onClick={() => setCharLimit(Math.max(2, charLimit - 1))}
              className="w-10 h-10 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors border border-white/10">−</button>
            <div className="flex-1 text-center">
              <span className="text-3xl font-black text-white">{charLimit}</span>
              <span className="text-sm text-white/40 ml-1">文字</span>
            </div>
            <button onClick={() => setCharLimit(Math.min(12, charLimit + 1))}
              className="w-10 h-10 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors border border-white/10">＋</button>
          </div>
        ) : (
          <p className="text-xs text-white/30">オフのときは文字数制限なし</p>
        )}
      </div>

      {/* スタートボタン */}
      <button
        onClick={onStart}
        disabled={!theme}
        className={`w-full py-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed shadow-xl ${
          isPvP
            ? 'bg-gradient-to-r from-rose-500 to-pink-600 shadow-rose-500/30 hover:from-rose-400 hover:to-pink-500'
            : 'bg-gradient-to-r from-indigo-500 to-violet-600 shadow-indigo-500/30 hover:from-indigo-400 hover:to-violet-500'
        }`}
      >
        ゲームスタート！
      </button>
    </div>
  );
}
