'use client';
import { useState } from 'react';

/** オンラインの入口: 部屋を作るか、部屋コードで入る */
export default function OnlineEntry({ onCreate, onJoin, onBack }: {
  onCreate: () => void;
  onJoin: (code: string) => void;
  onBack: () => void;
}) {
  const [joinCode, setJoinCode] = useState('');
  const canJoin = /^\d{4}$/.test(joinCode);

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
      <header className="mb-5">
        <button onClick={onBack} className="self-start inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors mb-6">
          ← トップへ戻る
        </button>
        <div className="flex items-center justify-center gap-2 mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/friend-icon.png" alt="" className="h-9 w-auto" />
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-rose-300 to-white bg-clip-text text-transparent animate-gradient-x">オンライン</h1>
        </div>
        <p className="text-white/40 text-sm text-center">別々の端末から、2〜6人で遊ぼう</p>
      </header>

      {/* 部屋を作る */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">部屋を作る</p>
        <p className="text-[11px] text-white/30 mb-3">
          部屋コードが出るので、みんなに伝える。対戦ゲームか練習ゲームか、ルールは部屋の中で決める。
        </p>
        <button
          onClick={onCreate}
          className="w-full py-4 rounded-2xl font-black text-white text-lg bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 shadow-xl transition-all active:scale-95 animate-glow [--glow:rgba(244,63,94,0.4)]"
        >
          部屋を作る
        </button>
      </div>

      {/* 部屋に入る */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">部屋に入る</p>
        <p className="text-[11px] text-white/30 mb-3">部屋を作った人から聞いた4桁の部屋コードを入れる。</p>
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
      </div>
    </div>
  );
}
