interface LobbyProps {
  isPvP: boolean;
  setIsPvP: (v: boolean) => void;
  isOvertake: boolean;
  setIsOvertake: (v: boolean) => void;
  isSpellTrap: boolean;
  setIsSpellTrap: (v: boolean) => void;
  theme: string;
  setTheme: (v: string) => void;
  charLimit: number | null;
  setCharLimit: (v: number | null) => void;
  posLimit: string | null;
  setPosLimit: (v: string | null) => void;
  timeLimit: number | null;
  setTimeLimit: (v: number | null) => void;
  starting: boolean;
  onStart: () => void;
  onBack: () => void;
}

const PRESETS = ['ANIMAL', 'OCEAN', 'SPORT', 'FOOD', 'NATURE', 'BODY'];
const POS_OPTIONS = ['名詞', '動詞', '形容詞', '副詞'];

const MODES = [
  { label: 'ソロ', sub: 'AI と対戦', icon: '🤖', pvp: false, gradient: 'from-indigo-500 to-violet-600 shadow-indigo-500/30' },
  { label: '対戦', sub: '2人で勝負', icon: '⚔️', pvp: true,  gradient: 'from-rose-500 to-pink-600 shadow-rose-500/30' },
] as const;

export default function Lobby({ isPvP, setIsPvP, isOvertake, setIsOvertake, isSpellTrap, setIsSpellTrap, theme, setTheme, charLimit, setCharLimit, posLimit, setPosLimit, timeLimit, setTimeLimit, starting, onStart, onBack }: LobbyProps) {
  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
      <header className="mb-5">
        <button onClick={onBack} className="self-start inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors mb-6">
          ← トップへ戻る
        </button>
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-3xl">⚔️</span>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-300 to-white bg-clip-text text-transparent animate-gradient-x">対戦ゲーム</h1>
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

        {/* スペルチェックモード（ソロのみ） */}
        {!isPvP && (
          <div className="mt-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">🔍 スペルチェック</p>
                <p className="text-[11px] text-white/30 mt-1">AIがときどきスペルを間違える</p>
              </div>
              <button
                onClick={() => setIsSpellTrap(!isSpellTrap)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${isSpellTrap ? 'bg-indigo-500' : 'bg-white/15'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isSpellTrap ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {isSpellTrap && (
              <p className="text-[11px] text-white/30 mt-2">
                ミスを見抜いて「指摘」できたらあなたの勝ち。正しい単語を誤って指摘すると負け。
              </p>
            )}
          </div>
        )}

        {/* ターン交代ルール（対戦時のみ） */}
        {isPvP && (
          <div className="mt-4 animate-fade-up">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">ターン交代ルール</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsOvertake(false)}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                  !isOvertake
                    ? 'bg-rose-500/25 border-rose-400/50 text-rose-200'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 border-white/10'
                }`}
              >
                <div>交互</div>
                <div className="text-[10px] opacity-60 mt-0.5 font-medium">1語ごとに交代</div>
              </button>
              <button
                onClick={() => setIsOvertake(true)}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                  isOvertake
                    ? 'bg-rose-500/25 border-rose-400/50 text-rose-200'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 border-white/10'
                }`}
              >
                <div>スコア</div>
                <div className="text-[10px] opacity-60 mt-0.5 font-medium">相手を超えるまで続ける</div>
              </button>
            </div>
            {isOvertake && (
              <p className="text-[11px] text-white/30 mt-2">
                相手のスコアを超えるまで連続で回答。難しい単語で一気に逆転しよう。
              </p>
            )}
          </div>
        )}
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
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && theme.trim() && onStart()}
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

      {/* 制限設定（品詞・文字数・時間をまとめた1枚） */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
        {/* 品詞 */}
        <div>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2.5">品詞制限</p>
          <div className="flex flex-wrap gap-1.5">
            {[null, ...POS_OPTIONS].map(pos => (
              <button
                key={pos ?? 'none'}
                onClick={() => setPosLimit(pos)}
                className={`text-sm font-bold px-3.5 py-1.5 rounded-full border transition-all ${
                  posLimit === pos
                    ? 'bg-indigo-500/30 border-indigo-400/50 text-indigo-300'
                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10'
                }`}
              >
                {pos ?? 'なし'}
              </button>
            ))}
          </div>
        </div>

        {/* 文字数 */}
        <div className="border-t border-white/10 mt-4 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">文字数制限</p>
            <div className="flex items-center gap-3">
              {charLimit !== null && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setCharLimit(Math.max(2, charLimit - 1))} disabled={charLimit <= 2}
                    className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20 transition-colors border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed">−</button>
                  <span className="text-lg font-black text-white tabular-nums w-12 text-center">{charLimit}<span className="text-xs text-white/40 font-bold ml-0.5">字</span></span>
                  <button onClick={() => setCharLimit(Math.min(12, charLimit + 1))} disabled={charLimit >= 12}
                    className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20 transition-colors border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed">＋</button>
                </div>
              )}
              <button
                onClick={() => setCharLimit(charLimit === null ? 5 : null)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${charLimit !== null ? 'bg-indigo-500' : 'bg-white/15'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${charLimit !== null ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* 時間 */}
        <div className="border-t border-white/10 mt-4 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">時間制限</p>
            <div className="flex items-center gap-3">
              {timeLimit !== null && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setTimeLimit(Math.max(5, timeLimit - 5))} disabled={timeLimit <= 5}
                    className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20 transition-colors border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed">−</button>
                  <span className="text-lg font-black text-white tabular-nums w-12 text-center">{timeLimit}<span className="text-xs text-white/40 font-bold ml-0.5">秒</span></span>
                  <button onClick={() => setTimeLimit(Math.min(60, timeLimit + 5))} disabled={timeLimit >= 60}
                    className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20 transition-colors border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed">＋</button>
                </div>
              )}
              <button
                onClick={() => setTimeLimit(timeLimit === null ? 15 : null)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${timeLimit !== null ? 'bg-indigo-500' : 'bg-white/15'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${timeLimit !== null ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
          {timeLimit !== null && (
            <p className="text-[11px] text-white/30 mt-2">1手 {timeLimit} 秒。時間切れになるとそのプレイヤーの負け</p>
          )}
        </div>
      </div>

      {/* スタートボタン */}
      <button
        onClick={onStart}
        disabled={!theme.trim() || starting}
        className={`w-full py-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed shadow-xl animate-glow ${
          isPvP
            ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 [--glow:rgba(244,63,94,0.4)]'
            : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 [--glow:rgba(99,102,241,0.4)]'
        }`}
      >
        {starting ? 'お題を準備中...' : 'ゲームスタート！'}
      </button>
    </div>
  );
}
