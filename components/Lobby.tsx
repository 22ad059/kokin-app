import { useState } from 'react';
import { TurnRuleSelector, ThemeCard, LimitsCard } from '@/components/RuleSettings';
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
  /** 2人対戦を別々の端末でする（オンライン） */
  isOnline: boolean;
  setIsOnline: (v: boolean) => void;
  /** オンライン: 部屋コードで参加する */
  onJoin: (code: string) => void;
}


const MODES = [
  { label: 'ソロ', sub: 'AI と対戦', img: '/ai-icon.png', pvp: false, gradient: 'from-indigo-500 to-violet-600 shadow-indigo-500/30' },
  { label: '対戦', sub: '2人で勝負', img: '/friend-icon.png', pvp: true,  gradient: 'from-rose-500 to-pink-600 shadow-rose-500/30' },
] as const;

export default function Lobby({ isPvP, setIsPvP, isOvertake, setIsOvertake, isSpellTrap, setIsSpellTrap, theme, setTheme, charLimit, setCharLimit, posLimit, setPosLimit, timeLimit, setTimeLimit, starting, onStart, onBack, isOnline, setIsOnline, onJoin }: LobbyProps) {
  const [joinCode, setJoinCode] = useState('');
  const online = isPvP && isOnline;
  const canJoin = /^\d{4}$/.test(joinCode);
  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
      <header className="mb-5">
        <button onClick={onBack} className="self-start inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors mb-6">
          ← トップへ戻る
        </button>
        <div className="flex items-center justify-center gap-2 mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/battle-icon.png" alt="" className="h-9 w-auto" />
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-300 to-white bg-clip-text text-transparent animate-gradient-x">対戦ゲーム</h1>
        </div>
        <p className="text-white/40 text-sm text-center">テーマを決めて英単語を出し合おう</p>
      </header>

      {/* モード選択 */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">ゲームモード</p>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map(({ label, sub, img, pvp, gradient }) => (
            <button
              key={label}
              onClick={() => setIsPvP(pvp)}
              className={`py-4 rounded-2xl font-bold text-sm transition-all border ${
                isPvP === pvp
                  ? `bg-gradient-to-br ${gradient} text-white shadow-lg border-transparent`
                  : 'bg-white/5 text-white/40 hover:bg-white/10 border-white/10'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className={`h-9 w-auto mx-auto mb-1 transition-opacity ${isPvP === pvp ? '' : 'opacity-50'}`} />
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
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">スペルチェック</p>
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

        {/* 対戦の場所（対戦時のみ） */}
        {isPvP && (
          <div className="mt-4 animate-fade-up">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">対戦のしかた</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: false, label: 'この端末で', sub: '1台を交代で使う' },
                { v: true, label: 'オンライン', sub: '別々の端末で対戦' },
              ]).map(({ v, label, sub }) => (
                <button
                  key={label}
                  onClick={() => setIsOnline(v)}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                    isOnline === v
                      ? 'bg-rose-500/25 border-rose-400/50 text-rose-200'
                      : 'bg-white/5 text-white/40 hover:bg-white/10 border-white/10'
                  }`}
                >
                  <div>{label}</div>
                  <div className="text-[10px] opacity-60 mt-0.5 font-medium">{sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ターン交代ルール（端末1台の対戦時のみ。オンラインは部屋の中で決める） */}
        {isPvP && !online && (
          <TurnRuleSelector isOvertake={isOvertake} setIsOvertake={setIsOvertake} />
        )}
      </div>

      {/* オンライン: 部屋コードで参加 */}
      {online && (
        <div className="bg-white/5 backdrop-blur-xl border border-rose-400/20 rounded-3xl p-5 animate-fade-up">
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">部屋に入る</p>
          <p className="text-[11px] text-white/30 mb-3">相手から聞いた4桁の部屋コードを入れる。</p>
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              maxLength={4}
              className="flex-1 min-w-0 bg-white/10 border border-white/10 text-white font-black text-2xl tracking-[0.4em] text-center p-2.5 rounded-2xl outline-none focus:border-rose-400 transition-all placeholder:text-white/20 placeholder:tracking-normal placeholder:text-base"
              placeholder="部屋コード"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => e.key === 'Enter' && canJoin && onJoin(joinCode)}
            />
            <button
              onClick={() => onJoin(joinCode)}
              disabled={!canJoin}
              className="px-5 py-3 rounded-2xl font-black text-white bg-gradient-to-r from-rose-500 to-pink-600 transition-all active:scale-95 disabled:opacity-30 shrink-0"
            >
              入る
            </button>
          </div>
          <p className="text-[11px] text-white/30 mt-4 text-center">— または、下のボタンで部屋を作る（ルールは部屋の中で決める）—</p>
        </div>
      )}

      {/* テーマ入力 */}
      {/* オンラインでは、ルールは部屋に入ってから部屋主が決める */}
      {!online && <ThemeCard theme={theme} setTheme={setTheme} onEnter={onStart} />}

      {/* 制限設定（品詞・文字数・時間をまとめた1枚） */}
      {!online && <LimitsCard charLimit={charLimit} setCharLimit={setCharLimit} posLimit={posLimit} setPosLimit={setPosLimit} timeLimit={timeLimit} setTimeLimit={setTimeLimit} />}

      {/* スタートボタン */}
      <button
        onClick={onStart}
        disabled={(!online && !theme.trim()) || starting}
        className={`w-full py-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed shadow-xl animate-glow ${
          isPvP
            ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 [--glow:rgba(244,63,94,0.4)]'
            : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 [--glow:rgba(99,102,241,0.4)]'
        }`}
      >
        {starting ? 'お題を準備中...' : online ? '部屋を作る' : 'ゲームスタート！'}
      </button>
    </div>
  );
}
