/**
 * 対戦ルールの設定欄（ロビーとオンライン対戦の部屋で共通）。
 */
export const PRESETS = ['ANIMAL', 'OCEAN', 'SPORT', 'FOOD', 'NATURE', 'BODY'];
export const POS_OPTIONS = ['名詞', '動詞', '形容詞', '副詞'];

/** ターン交代ルール（交互／スコア） */
export function TurnRuleSelector({ isOvertake, setIsOvertake }: { isOvertake: boolean; setIsOvertake: (v: boolean) => void }) {
  return (
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
  );
}

/** テーマの入力欄 */
export function ThemeCard({ theme, setTheme, onEnter, autoFocus = true }: {
  theme: string;
  setTheme: (v: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
      <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">テーマ</p>
      <input
        autoFocus={autoFocus}
        className="w-full bg-white/10 border border-white/10 text-white font-bold text-lg text-center p-3 rounded-2xl outline-none focus:border-indigo-400 focus:bg-white/15 transition-all placeholder:text-white/20"
        placeholder="例：OCEAN、ANIMAL..."
        value={theme}
        onChange={(e) => setTheme(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && theme.trim() && onEnter?.()}
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
  );
}

/** 品詞・文字数・時間の制限 */
export function LimitsCard({ charLimit, setCharLimit, posLimit, setPosLimit, timeLimit, setTimeLimit, onlyTime = false, missOk, setMissOk, spellFix, setSpellFix }: {
  charLimit: number | null;
  setCharLimit: (v: number | null) => void;
  posLimit: string | null;
  setPosLimit: (v: string | null) => void;
  timeLimit: number | null;
  setTimeLimit: (v: number | null) => void;
  /** 時間制限だけを出す（練習ゲーム用） */
  onlyTime?: boolean;
  /** ミスOK（使えない単語は打ち直せる。時間切れでアウト）。渡したときだけ切り替えを出す */
  missOk?: boolean;
  setMissOk?: (v: boolean) => void;
  /** つづり1文字OK（1文字違いは直して認める。得点は半分）。渡したときだけ切り替えを出す */
  spellFix?: boolean;
  setSpellFix?: (v: boolean) => void;
}) {
  // ミスOK は時間切れで決着するので、時間制限が必要。時間制限を外すとミスOK も外す
  const toggleTime = () => {
    if (timeLimit === null) setTimeLimit(15);
    else { setTimeLimit(null); if (missOk) setMissOk?.(false); }
  };
  const toggleMissOk = () => {
    if (!setMissOk) return;
    if (!missOk && timeLimit === null) setTimeLimit(15);
    setMissOk(!missOk);
  };
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
      {!onlyTime && (
        <>
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

        </>
      )}

      {/* 時間 */}
      <div className={onlyTime ? '' : 'border-t border-white/10 mt-4 pt-4'}>
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
              onClick={toggleTime}
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

      {/* ミスOK */}
      {setMissOk && (
        <div className="border-t border-white/10 mt-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">ミスOK</p>
              <p className="text-[11px] text-white/30 mt-1">使えない単語は何度でも打ち直せる。時間切れでアウト</p>
            </div>
            <button
              onClick={toggleMissOk}
              aria-pressed={!!missOk}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${missOk ? 'bg-indigo-500' : 'bg-white/15'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${missOk ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>
      )}

      {/* つづり1文字OK */}
      {setSpellFix && (
        <div className="border-t border-white/10 mt-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">つづり1文字OK</p>
              <p className="text-[11px] text-white/30 mt-1">つづりが1文字違うだけなら直して認める。得点は半分</p>
            </div>
            <button
              onClick={() => setSpellFix(!spellFix)}
              aria-pressed={!!spellFix}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${spellFix ? 'bg-indigo-500' : 'bg-white/15'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${spellFix ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
