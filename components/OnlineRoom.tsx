'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/types/game';
import type { ClientMessage, PlayerNo, RoomState, ServerMessage } from '@/lib/online';
import { playerLabel, randomRoomCode } from '@/lib/online';
import GameBoard from '@/components/GameBoard';
import RoomLobby from '@/components/online/RoomLobby';
import BattleResult from '@/components/online/BattleResult';
import PracticeBoard from '@/components/online/PracticeBoard';
import PracticeResult from '@/components/online/PracticeResult';

/** create: 部屋を作る（ルールは部屋に入ってから決める）/ join: 部屋コードで入る */
export type OnlineSession =
  | { mode: 'create' }
  | { mode: 'join'; code: string };

/** 部屋を作るときに部屋コードがかぶったら、この回数まで別のコードで作り直す */
const MAX_CREATE_TRIES = 5;
/** 接続が切れたときに自動でつなぎ直す回数 */
const MAX_RECONNECTS = 8;

const tokenKey = (code: string) => `kokin-room-token-${code}`;
const readToken = (code: string) => {
  try { return sessionStorage.getItem(tokenKey(code)) ?? undefined; } catch { return undefined; }
};
const writeToken = (code: string, token: string) => {
  try { sessionStorage.setItem(tokenKey(code), token); } catch { /* 保存できなくても遊べる */ }
};

/** オンライン（別々の端末）で遊ぶ画面。部屋への接続と、状態ごとの画面の切り替え */
export default function OnlineRoom({ session, onExit }: { session: OnlineSession; onExit: () => void }) {
  const [code, setCode] = useState(session.mode === 'join' ? session.code : randomRoomCode());
  const [myPlayer, setMyPlayer] = useState<PlayerNo | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'open' | 'reconnecting' | 'closed'>('connecting');
  const [fatalError, setFatalError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [input, setInput] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const createTries = useRef(0);
  const reconnects = useRef(0);
  const leaving = useRef(false);
  const isCreatorRef = useRef(session.mode === 'create');
  const myPlayerRef = useRef<PlayerNo | null>(null);
  const seenHistory = useRef(0);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  // ── 接続（部屋コードが決まるたび・切れたとき） ──
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/ws/room/${code}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        reconnects.current = 0;
        setConnection('open');
        const token = readToken(code);
        // 部屋を作る側は、まだ自分のトークンがない（=作っていない）ときだけ作成を頼む
        ws.send(JSON.stringify({ type: 'hello', token, create: !token && isCreatorRef.current ? true : undefined } satisfies ClientMessage));
      };

      ws.onmessage = (ev) => {
        if (cancelled) return;
        let msg: ServerMessage;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === 'welcome') {
          writeToken(code, msg.token);
          myPlayerRef.current = msg.player;
          setMyPlayer(msg.player);
        } else if (msg.type === 'state') {
          // 自分の単語が合格して履歴に増えたら入力欄を空にする
          const h = msg.state.history;
          if (h.length > seenHistory.current && h[h.length - 1]?.player === myPlayerRef.current) setInput('');
          // 手番が自分から離れたら（練習で使えなかった単語など）入力欄を空にする
          if (msg.state.currentPlayer !== myPlayerRef.current) setInput('');
          seenHistory.current = h.length;
          setRoom(msg.state);
          if (!msg.state.judging) setErrorMsg('');
        } else if (msg.type === 'error') {
          if (msg.fatal) {
            // 部屋コードがかぶったら、別のコードで作り直す
            if (msg.code === 'room_taken' && isCreatorRef.current && createTries.current < MAX_CREATE_TRIES) {
              createTries.current += 1;
              leaving.current = true;
              setConnection('connecting');
              setCode(randomRoomCode());
              return;
            }
            leaving.current = true;
            setFatalError(msg.message);
          } else {
            setErrorMsg(msg.message);
          }
        }
      };

      ws.onclose = () => {
        if (cancelled || leaving.current) return;
        if (reconnects.current >= MAX_RECONNECTS) {
          setConnection('closed');
          return;
        }
        reconnects.current += 1;
        setConnection('reconnecting');
        retryTimer = setTimeout(connect, Math.min(1000 * reconnects.current, 5000));
      };
    };

    leaving.current = false;
    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      try { wsRef.current?.close(); } catch { /* 無視 */ }
    };
  }, [code]);

  const leave = () => {
    leaving.current = true;
    send({ type: 'leave' });
    try { wsRef.current?.close(); } catch { /* 無視 */ }
    onExit();
  };

  const playTurn = () => {
    const word = input.trim();
    if (!word || !room || room.judging || room.currentPlayer !== myPlayer) return;
    setErrorMsg('');
    send({ type: 'play', word });
  };

  // ── 画面 ──
  if (fatalError) {
    return (
      <Panel>
        <p className="text-lg font-black text-white">部屋に入れませんでした</p>
        <p className="text-sm text-white/60 mt-2">{fatalError}</p>
        <button onClick={onExit} className="mt-5 w-full py-3 rounded-2xl font-black text-white bg-white/10 border border-white/10 hover:bg-white/15 transition-all">
          ロビーへ戻る
        </button>
      </Panel>
    );
  }

  if (connection === 'closed') {
    return (
      <Panel>
        <p className="text-lg font-black text-white">接続できませんでした</p>
        <p className="text-sm text-white/60 mt-2">
          通信が不安定か、この公開先ではオンライン対戦が使えません（kokin.aoisakana.com で使えます）。
        </p>
        <button onClick={onExit} className="mt-5 w-full py-3 rounded-2xl font-black text-white bg-white/10 border border-white/10 hover:bg-white/15 transition-all">
          ロビーへ戻る
        </button>
      </Panel>
    );
  }

  if (!room || !myPlayer) {
    return (
      <Panel>
        <div className="w-8 h-8 mx-auto border-2 border-rose-400/40 border-t-rose-400 rounded-full animate-spin" />
        <p className="text-sm text-white/60 mt-4">{session.mode === 'create' ? '部屋を作っています…' : `部屋 ${code} に接続しています…`}</p>
        <button onClick={leave} className="mt-5 text-sm text-white/40 hover:text-white/70">やめる</button>
      </Panel>
    );
  }

  const rematch = () => send({ type: 'rematch' });
  const toLobby = () => send({ type: 'toLobby' });

  // 部屋でルールを決める
  if (room.status === 'waiting') {
    return (
      <RoomLobby
        room={room}
        myPlayer={myPlayer}
        errorMsg={errorMsg}
        onSettings={settings => send({ type: 'settings', settings })}
        onStart={() => { setErrorMsg(''); send({ type: 'start' }); }}
        onLeave={leave}
      />
    );
  }

  const practice = room.settings.gameType === 'practice';

  if (room.status === 'finished') {
    return practice
      ? <PracticeResult room={room} myPlayer={myPlayer} onRematch={rematch} onToLobby={toLobby} onLeave={leave} />
      : <BattleResult room={room} myPlayer={myPlayer} onRematch={rematch} onToLobby={toLobby} onLeave={leave} />;
  }

  const connectionNotice = connection === 'reconnecting' ? '接続が切れました。つなぎ直しています…' : '';

  // 練習ゲーム（協力・競争）
  if (practice) {
    return (
      <PracticeBoard
        room={room}
        myPlayer={myPlayer}
        input={input}
        setInput={setInput}
        errorMsg={errorMsg}
        connectionNotice={connectionNotice}
        onPlay={playTurn}
        onHint={() => send({ type: 'hint' })}
        onRetire={() => send({ type: 'retire' })}
        onLeave={leave}
      />
    );
  }

  // 対戦ゲーム（2〜6人・脱落制）
  const s = room.settings;
  const me = room.players.find(p => p.no === myPlayer);
  const iAmOut = !!me?.eliminated || !me?.inGame;
  const isMyTurn = room.currentPlayer === myPlayer && !iAmOut;
  const inGame = room.players.filter(p => p.inGame);
  const away = inGame.filter(p => !p.eliminated && !p.connected).map(p => playerLabel(p.no, myPlayer));
  const notice = connectionNotice
    || (iAmOut ? `あなたは脱落しました（観戦中）${room.notice ? `　${room.notice}` : ''}` : '')
    || room.notice
    || (away.length ? `${away.join('・')}の接続が切れています。戻ってくるのを待っています…` : '');
  const history: ChatMessage[] = room.history.map(m => ({
    word: m.word,
    translation: m.bonus || m.translation || playerLabel(m.player, myPlayer),
    isUser: m.player === myPlayer,
    level: m.level,
    levelEstimated: m.levelEstimated,
    score: m.score,
  }));
  const myScore = me?.score ?? 0;
  const topOther = Math.max(0, ...inGame.filter(p => !p.eliminated && p.no !== myPlayer).map(p => p.score));
  const twoPlayers = inGame.length === 2;

  return (
    <div className="flex flex-col gap-3">
      {confirmLeave && (
        <div className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 animate-fade-up">
          <span className="text-xs text-white/70">{iAmOut ? '部屋から出ますか？' : '退出すると脱落になります。退出しますか？'}</span>
          <button onClick={leave} className="text-xs font-bold text-white bg-rose-500/80 hover:bg-rose-500 rounded-full px-3 py-1.5">退出する</button>
          <button onClick={() => setConfirmLeave(false)} className="text-xs font-bold text-white/60 border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/10">続ける</button>
        </div>
      )}
      <GameBoard
        // 判定のたびに時間をサーバーと合わせ直す（残り時間が届いたら作り直す）
        key={`${room.history.length}-${room.currentPlayer}-${room.turnRemainingMs === null ? 'n' : 't'}`}
        isPvP
        isOvertake={s.isOvertake}
        currentPlayer={room.currentPlayer}
        scores={{ p1: 0, p2: 0 }}
        totalScore={0}
        theme={s.theme}
        themeDefinition={s.themeDefinition}
        charLimit={s.charLimit}
        posLimit={s.posLimit}
        timeLimit={room.turnRemainingMs !== null ? Math.max(1, Math.round(room.turnRemainingMs / 1000)) : null}
        // 時間切れはサーバーが判断するので、画面では何もしない
        onTimeout={() => {}}
        isSpellTrap={false}
        onChallenge={() => {}}
        history={history}
        input={input}
        setInput={setInput}
        loading={room.judging}
        errorMsg={errorMsg}
        onPlayTurn={playTurn}
        onReset={() => setConfirmLeave(true)}
        onEndGame={() => {}}
        myPlayer={myPlayer}
        canPlay={isMyTurn}
        modeText={`${twoPlayers ? '2人' : `${inGame.length}人`}対戦${s.isOvertake ? '・スコアモード' : ''}（残り ${inGame.filter(p => !p.eliminated).length}人）`}
        statusText={iAmOut ? '観戦中' : isMyTurn ? 'あなたの番！' : twoPlayers ? '相手の番…' : `${playerLabel(room.currentPlayer, myPlayer)}の番…`}
        passPoints={Math.max(1, topOther - myScore + 1)}
        scoreboard={inGame.map(p => ({
          no: p.no,
          label: twoPlayers ? (p.no === myPlayer ? 'あなた' : '相手') : (p.no === myPlayer ? 'あなた' : `P${p.no}`),
          score: p.score,
          current: p.no === room.currentPlayer,
          out: p.eliminated,
        }))}
        notice={notice}
        backLabel="← 退出"
      />
      <p className="text-[11px] text-white/30 text-center">部屋コード {code}</p>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm mx-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-7 text-center animate-fade-up">
      {children}
    </div>
  );
}
