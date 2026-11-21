'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/types/game';
import type { ClientMessage, PlayerNo, RoomSettings, RoomState, ServerMessage } from '@/lib/online';
import { randomRoomCode } from '@/lib/online';
import GameBoard from '@/components/GameBoard';
import ResultScreen from '@/components/ResultScreen';

export type OnlineSession =
  | { mode: 'create'; settings: RoomSettings }
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
  try { sessionStorage.setItem(tokenKey(code), token); } catch { /* 保存できなくても対戦はできる */ }
};

export default function OnlineRoom({ session, onExit }: { session: OnlineSession; onExit: () => void }) {
  const [code, setCode] = useState(session.mode === 'join' ? session.code : randomRoomCode());
  const [myPlayer, setMyPlayer] = useState<PlayerNo | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'open' | 'reconnecting' | 'closed'>('connecting');
  const [fatalError, setFatalError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [input, setInput] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [copied, setCopied] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const createTries = useRef(0);
  const reconnects = useRef(0);
  const leaving = useRef(false);
  const settingsRef = useRef(session.mode === 'create' ? session.settings : undefined);
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
        ws.send(JSON.stringify({ type: 'hello', token, create: !token ? settingsRef.current : undefined } satisfies ClientMessage));
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
          seenHistory.current = h.length;
          setRoom(msg.state);
          if (!msg.state.judging) setErrorMsg('');
        } else if (msg.type === 'error') {
          if (msg.fatal) {
            // 部屋コードがかぶったら、別のコードで作り直す
            if (msg.code === 'room_taken' && settingsRef.current && createTries.current < MAX_CREATE_TRIES) {
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

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* コピーできない環境では何もしない */ }
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

  const opponent: PlayerNo = myPlayer === 1 ? 2 : 1;
  const opponentAway = room.players[opponent].joined && !room.players[opponent].connected;
  const s = room.settings;

  // 相手を待っている
  if (room.status === 'waiting') {
    return (
      <Panel>
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">部屋コード</p>
        <button onClick={copyCode} className="mt-2 text-6xl font-black tracking-[0.3em] text-white tabular-nums pl-[0.3em] hover:text-rose-200 transition-colors" title="押すとコピー">
          {code}
        </button>
        <p className="text-xs text-white/40 mt-1 h-4">{copied ? 'コピーしました' : '押すとコピーできる'}</p>
        <p className="text-sm text-white/70 mt-4 leading-relaxed">
          相手に、この部屋コードを伝えてください。<br />
          相手が「部屋に入る」でコードを入れると始まります。
        </p>
        <div className="flex items-center justify-center gap-2 mt-5">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
          <span className="text-sm font-bold text-white/60">相手を待っています…</span>
        </div>
        <SettingsSummary settings={s} />
        <button onClick={leave} className="mt-6 w-full py-3 rounded-2xl font-black text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
          部屋を閉じる
        </button>
      </Panel>
    );
  }

  const history: ChatMessage[] = room.history.map(m => ({
    word: m.word,
    translation: m.bonus || m.translation || (m.player === myPlayer ? 'あなた' : '相手'),
    isUser: m.player === myPlayer,
    level: m.level,
    levelEstimated: m.levelEstimated,
    score: m.score,
  }));

  if (room.status === 'finished') {
    const bothHere = room.players[1].connected && room.players[2].connected;
    return (
      <div className="flex flex-col gap-3">
        <ResultScreen
          isPvP
          myPlayer={myPlayer}
          losingPlayer={room.loser}
          scores={room.scores}
          totalScore={0}
          history={history}
          theme={s.theme}
          // 退出の理由はサーバーでは「プレイヤーNが…」なので、残った側には「相手が…」と見せる
          reason={room.loser !== myPlayer && /^プレイヤー[12]が退出しました$/.test(room.reason) ? '相手が退出しました' : room.reason}
          onRematch={() => bothHere && send({ type: 'rematch' })}
          onReset={leave}
          rematchLabel={bothHere ? 'もう一回' : '相手がいません'}
          resetLabel="退出する"
        />
        {!bothHere && (
          <p className="text-xs text-white/40 text-center">相手が部屋にいないため、もう一回はできません</p>
        )}
      </div>
    );
  }

  const notice = connection === 'reconnecting'
    ? '接続が切れました。つなぎ直しています…'
    : opponentAway
      ? '相手の接続が切れています。戻ってくるのを待っています…'
      : '';

  return (
    <div className="flex flex-col gap-3">
      {confirmLeave && (
        <div className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 animate-fade-up">
          <span className="text-xs text-white/70">退出すると負けになります。退出しますか？</span>
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
        scores={room.scores}
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

function SettingsSummary({ settings: s }: { settings: RoomSettings }) {
  const items = [
    `テーマ ${s.theme}`,
    s.isOvertake ? 'スコアモード' : '交互',
    s.posLimit ? `品詞 ${s.posLimit}` : '',
    s.charLimit !== null ? `${s.charLimit}文字` : '',
    s.timeLimit !== null ? `1手 ${s.timeLimit}秒` : '',
  ].filter(Boolean);
  return (
    <div className="flex flex-wrap justify-center gap-1.5 mt-5">
      {items.map(t => (
        <span key={t} className="text-[11px] font-bold text-white/60 bg-white/10 border border-white/10 px-2.5 py-0.5 rounded-full">{t}</span>
      ))}
    </div>
  );
}
