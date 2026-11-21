'use client';
import type { PlayerNo, RoomState } from '@/lib/online';
import { playerLabel } from '@/lib/online';
import { LEVEL_BADGE } from '@/lib/constants';

interface Props {
  room: RoomState;
  myPlayer: PlayerNo;
  onRematch: () => void;
  onToLobby: () => void;
  onLeave: () => void;
}

/** オンライン対戦の結果（2人〜6人）。勝った人と、脱落した順の一覧 */
export default function BattleResult({ room, myPlayer, onRematch, onToLobby, onLeave }: Props) {
  const players = room.players.filter(p => p.inGame);
  const winner = room.winner;
  // 順位: 勝った人 → 後から脱落した人ほど上
  const order: PlayerNo[] = [
    ...(winner !== null ? [winner] : []),
    ...players.filter(p => p.no !== winner && !room.eliminations.some(e => e.player === p.no)).map(p => p.no),
    ...[...room.eliminations].reverse().map(e => e.player),
  ];
  const scoreOf = (no: PlayerNo) => room.players.find(p => p.no === no)?.score ?? 0;
  const wordsOf = (no: PlayerNo) => room.players.find(p => p.no === no)?.words ?? 0;
  const here = room.players.filter(p => p.connected).length;

  const title = winner === null
    ? '対戦終了'
    : winner === myPlayer ? 'あなたの勝ち！' : `${playerLabel(winner, myPlayer)}の勝ち！`;

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
        <div className="px-6 pt-8 pb-5 text-center bg-gradient-to-b from-amber-500/20 to-transparent">
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">テーマ：{room.settings.theme}</p>
          <p className="text-2xl font-black text-white">{title}</p>
          {room.reason && (
            <p className="text-sm text-white/50 mt-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2">{room.reason}</p>
          )}
          <p className="text-xs text-white/40 mt-3">続いたラリー {room.history.length} 語</p>
        </div>

        {/* 順位 */}
        <ol className="px-5 pb-5 flex flex-col gap-1.5">
          {order.map((no, i) => {
            const elim = room.eliminations.find(e => e.player === no);
            return (
              <li key={no} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border ${
                i === 0 && winner !== null ? 'bg-amber-500/15 border-amber-400/40' : 'bg-white/5 border-white/10'
              }`}>
                <span className="w-6 text-center font-black text-white/60 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-sm">{playerLabel(no, myPlayer)}</p>
                  {elim && (
                    <p className="text-[11px] text-white/40 truncate">
                      脱落{elim.word ? `「${elim.word}」` : ''}：{elim.reason}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-white tabular-nums">{scoreOf(no)}<span className="text-[10px] text-white/40 ml-0.5">pt</span></p>
                  <p className="text-[10px] text-white/40">{wordsOf(no)} 語</p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* 出た単語 */}
        {room.history.length > 0 && (
          <div className="px-5 pb-5">
            <p className="text-xs text-white/30 mb-2">出た単語</p>
            <div className="flex flex-wrap gap-1.5">
              {room.history.map((h, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs font-bold text-white/80 bg-white/5 border border-white/10 px-2 py-1 rounded-full">
                  {h.word}
                  {h.level && h.level !== 'Unknown' && (
                    <span className={`text-[9px] px-1 rounded-full ${LEVEL_BADGE[h.level] ?? 'bg-white/10 text-white/50'}`}>{h.level.replace('Level ', 'Lv.')}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <ResultButtons myPlayer={myPlayer} here={here} onRematch={onRematch} onToLobby={onToLobby} onLeave={onLeave} />
    </div>
  );
}

/** 結果画面の下のボタン（対戦・練習で共通） */
export function ResultButtons({ myPlayer, here, onRematch, onToLobby, onLeave }: {
  myPlayer: PlayerNo; here: number; onRematch: () => void; onToLobby: () => void; onLeave: () => void;
}) {
  const canRematch = here >= 2;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => canRematch && onRematch()}
          disabled={!canRematch}
          className="py-4 rounded-2xl font-black text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg transition-all active:scale-95 disabled:opacity-30"
        >
          {canRematch ? '同じルールでもう一回' : 'ほかの人がいません'}
        </button>
        <button
          onClick={onLeave}
          className="py-4 rounded-2xl font-black text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
        >
          退出する
        </button>
      </div>
      {myPlayer === 1 ? (
        <button
          onClick={onToLobby}
          className="w-full py-3 rounded-2xl font-black text-sm text-rose-200 bg-rose-500/10 border border-rose-400/30 hover:bg-rose-500/20 transition-all active:scale-95"
        >
          部屋に戻ってルールを変える
        </button>
      ) : (
        <p className="text-xs text-white/40 text-center">ルールを変えたいときは、部屋主が「部屋に戻ってルールを変える」を押します</p>
      )}
    </>
  );
}
