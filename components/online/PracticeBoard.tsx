'use client';
import { useEffect, useRef, useState } from 'react';
import type { PlayerNo, RoomState } from '@/lib/online';
import { playerLabel } from '@/lib/online';
import { LEVEL_BADGE } from '@/lib/constants';
import { sameWord } from '@/lib/wordMatch';

interface Props {
  room: RoomState;
  myPlayer: PlayerNo;
  input: string;
  setInput: (v: string) => void;
  errorMsg: string;
  /** 接続まわりのお知らせ */
  connectionNotice: string;
  onPlay: () => void;
  onHint: () => void;
  onRetire: () => void;
  onLeave: () => void;
}

/** 残り時間の表示（サーバーから届いた残り時間から数える。key を変えて作り直す） */
function Countdown({ ms }: { ms: number }) {
  const [left, setLeft] = useState(ms);
  useEffect(() => {
    const end = Date.now() + ms;
    const id = setInterval(() => setLeft(Math.max(0, end - Date.now())), 100);
    return () => clearInterval(id);
  }, [ms]);
  const ratio = ms ? left / ms : 0;
  const color = ratio > 0.5 ? 'bg-emerald-400' : ratio > 0.2 ? 'bg-amber-400' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color} transition-[width] duration-100 ease-linear`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="text-xs font-black tabular-nums text-white/60 w-7 text-right">{Math.ceil(left / 1000)}s</span>
    </div>
  );
}

/** オンラインの練習ゲーム（協力・競争）のプレイ画面 */
export default function PracticeBoard({
  room, myPlayer, input, setInput, errorMsg, connectionNotice, onPlay, onHint, onRetire, onLeave,
}: Props) {
  const s = room.settings;
  const coop = s.practiceMode === 'coop';
  const chatRef = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState<'retire' | 'leave' | null>(null);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [room.history.length]);

  const inGame = room.players.filter(p => p.inGame);
  const me = room.players.find(p => p.no === myPlayer);
  const isMyTurn = room.currentPlayer === myPlayer && !!me?.inGame && !me.eliminated;
  const remaining = room.wordList.filter(w => !room.history.some(h => sameWord(h.word, w.word)));
  const used = room.wordList.length - remaining.length;
  const pct = room.wordList.length ? Math.round((used / room.wordList.length) * 100) : 0;
  const openHints = room.hinted
    .map(h => remaining.find(w => sameWord(w.word, h)))
    .filter((w): w is NonNullable<typeof w> => !!w);
  const canHint = coop && remaining.some(w => !room.hinted.some(h => sameWord(h, w.word)));
  const teamScore = inGame.reduce((a, p) => a + p.score, 0);
  const notice = connectionNotice || room.notice;

  return (
    <div className="flex flex-col gap-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <button onClick={() => setConfirm('leave')} className="inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors">
          ← 退出
        </button>
        <span className="text-xs font-bold text-amber-200 bg-amber-500/15 border border-amber-400/30 px-3 py-1 rounded-full">
          練習ゲーム・{coop ? '協力' : '競争'}
        </span>
      </div>

      {/* 進み具合 */}
      <div>
        <div className="flex justify-between text-xs text-white/40 mb-1.5">
          <span>{s.genres.join('・')}（{s.levels.map(l => l.replace('Level ', 'Lv.')).join(' ')}）</span>
          <span>{used} / {room.wordList.length} 語</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1.5">
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* プレイヤー */}
      <div className="flex flex-wrap gap-1.5">
        {coop && (
          <span className="text-xs font-black text-white bg-white/10 border border-white/10 px-3 py-1 rounded-full">
            チーム {teamScore} pt
          </span>
        )}
        {inGame.map(p => (
          <span key={p.no} className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all ${
            p.no === room.currentPlayer
              ? 'bg-amber-500/25 border-amber-400/60 text-amber-100'
              : 'bg-white/5 border-white/10 text-white/50'
          } ${p.eliminated || !p.connected ? 'opacity-40' : ''}`}>
            {playerLabel(p.no, myPlayer)}{coop ? ` ${p.words}語` : ` ${p.score}pt`}
            {!p.connected && '（切断）'}
          </span>
        ))}
      </div>

      {/* 出した単語 */}
      <div ref={chatRef} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 h-72 overflow-y-auto flex flex-col gap-3">
        {room.history.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-white/25 text-sm font-medium">
            順番に英単語を出していこう
          </div>
        ) : room.history.map((h, i) => {
          const mine = h.player === myPlayer;
          return (
            <div key={i} className={`flex flex-col animate-bubble-in ${mine ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] font-bold text-white/35 mb-1 px-1">{playerLabel(h.player, myPlayer)}</span>
              <div className={`max-w-full px-3.5 py-2.5 rounded-2xl ${
                mine ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-tr-none shadow-lg' : 'bg-white/10 text-white border border-white/15 rounded-tl-none'
              }`}>
                <div className="flex items-baseline gap-x-2 gap-y-1 flex-wrap">
                  <span className="text-lg font-black tracking-wide break-all">{h.word}</span>
                  {h.translation && <span className={`text-sm font-bold ${mine ? 'text-white' : 'text-white/85'}`}>{h.translation}</span>}
                  <span className="inline-flex items-center gap-1 self-center whitespace-nowrap">
                    {h.level && h.level !== 'Unknown' && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${mine ? 'bg-black/30 text-white' : (LEVEL_BADGE[h.level] ?? 'bg-white/20 text-white')}`}>
                        {h.level.replace('Level ', 'Lv.')}
                      </span>
                    )}
                    {h.hinted && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black bg-white text-amber-700">ヒント</span>}
                    {h.score > 0 && <span className="text-[10px] font-black bg-black/25 text-white rounded-full px-1.5 py-0.5">+{h.score} pt</span>}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {notice && (
        <div role="status" className="bg-amber-500/10 border border-amber-400/30 text-amber-200 text-sm font-bold rounded-2xl px-4 py-2.5 text-center">
          {notice}
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="bg-rose-500/15 border border-rose-400/30 text-rose-300 text-sm font-bold rounded-2xl px-4 py-2.5 text-center">
          {errorMsg}
        </div>
      )}

      {/* 入力 */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
        <p className="text-xs font-bold text-white/50 mb-2">
          {room.judging
            ? '判定中…'
            : isMyTurn ? `あなたの番！（残り ${remaining.length} 語）` : `${playerLabel(room.currentPlayer, myPlayer)}の番…`}
        </p>
        {room.turnRemainingMs !== null && (
          <Countdown key={`${room.history.length}-${room.currentPlayer}-${room.notice}`} ms={room.turnRemainingMs} />
        )}
        <div className="flex items-center gap-2">
          <input
            className="flex-1 min-w-0 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 outline-none text-white font-bold placeholder:text-white/20 focus:border-amber-400/60 transition-colors disabled:opacity-50"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && isMyTurn && onPlay()}
            placeholder={isMyTurn ? 'ジャンルに合う英単語を入力...' : 'ほかの人が考えています…'}
            disabled={!isMyTurn}
            autoFocus
          />
          <button
            onClick={onPlay}
            disabled={!isMyTurn || room.judging || !input.trim()}
            className="px-5 py-2.5 rounded-xl font-black text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg transition-all active:scale-95 disabled:opacity-30 shrink-0"
          >
            {room.judging ? '…' : '送信'}
          </button>
        </div>

        {coop && (
          <div className="mt-3">
            <button
              onClick={onHint}
              disabled={!canHint}
              className="text-xs font-bold text-amber-300/90 border border-amber-400/30 hover:bg-amber-500/10 rounded-full px-3 py-1.5 transition-colors disabled:opacity-30"
            >
              ヒント（和訳）を1つ見る
            </button>
            {openHints.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {openHints.map(w => (
                  <span key={w.word} className="text-xs font-bold text-amber-200 bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 rounded-full">
                    {w.translation || '（訳なし）'}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* リタイア・退出 */}
      {confirm ? (
        <div className="self-center flex items-center gap-2 animate-fade-up">
          <span className="text-xs text-white/60">
            {confirm === 'retire' ? 'みんなのゲームを終わりにしますか？' : coop ? '退出しますか？' : '退出しますか？（あなたの記録はここまで）'}
          </span>
          <button
            onClick={() => { setConfirm(null); if (confirm === 'retire') onRetire(); else onLeave(); }}
            className="text-xs font-bold text-white bg-rose-500/80 hover:bg-rose-500 rounded-full px-3 py-1.5"
          >
            {confirm === 'retire' ? 'リタイアする' : '退出する'}
          </button>
          <button onClick={() => setConfirm(null)} className="text-xs font-bold text-white/50 border border-white/10 hover:bg-white/10 rounded-full px-3 py-1.5">
            続ける
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm('retire')}
          className="self-center text-xs font-bold text-white/30 hover:text-rose-300 border border-white/10 hover:border-rose-400/40 rounded-full px-4 py-1.5 transition-colors"
        >
          リタイア（みんな終了）
        </button>
      )}
      <p className="text-[11px] text-white/30 text-center">部屋コード {room.code}</p>
    </div>
  );
}
