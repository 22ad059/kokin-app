/**
 * オンライン対戦の部屋サーバー（Cloudflare Durable Object）。部屋コードごとに1つ立ち上がる。
 *
 * - 2人の画面と WebSocket でつながり、手番・スコア・履歴・制限時間をここで一元管理する
 *   （どちらの画面も勝手に結果を書き換えられない）
 * - 単語の判定は、アプリの /api/game（端末1台での2人対戦と同じ判定）を呼び出して行う
 * - 状態はストレージに保存するので、部屋サーバーが休止・再起動しても対戦は続けられる
 */
import type {
  ClientMessage, OnlineMove, PlayerNo, RoomSettings, RoomState, ServerMessage,
} from '../lib/online';
import { PASSCODE_COOKIE, tokenFor } from '../lib/passcode';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Workers の実行環境が用意するモジュール
import { DurableObject } from 'cloudflare:workers';

/* eslint-disable @typescript-eslint/no-explicit-any */
type WS = any;

interface Stored {
  code: string;
  origin: string;
  settings: RoomSettings;
  tokens: Partial<Record<PlayerNo, string>>;
  status: RoomState['status'];
  currentPlayer: PlayerNo;
  scores: { p1: number; p2: number };
  history: OnlineMove[];
  judging: boolean;
  loser: PlayerNo | null;
  reason: string;
  /** 手番の締め切り（UNIX ミリ秒）。null は時間制限なし／判定中など */
  turnDeadline: number | null;
  lastActive: number;
}

/** 誰もつながっていない部屋はこの時間で片付ける */
const IDLE_CLEANUP_MS = 60 * 60 * 1000;
/** 時間切れ判定の猶予（通信の遅れを見込む） */
const TIMEOUT_GRACE_MS = 1000;

export class GameRoom extends DurableObject {
  declare ctx: any;
  declare env: any;
  room: Stored | null = null;

  constructor(ctx: any, env: any) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) ?? null;
    });
  }

  // ── 接続 ─────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = url.pathname.split('/').pop() ?? '';
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore WebSocketPair は Workers の実行環境にある
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WS, WS];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ code, origin: url.origin, player: null });
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  async webSocketMessage(ws: WS, raw: string | ArrayBuffer) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return this.sendTo(ws, { type: 'error', message: '不正なメッセージです' });
    }
    switch (msg.type) {
      case 'hello': return this.onHello(ws, msg);
      case 'play': return this.onPlay(ws, msg.word);
      case 'rematch': return this.onRematch(ws);
      case 'leave': return this.onLeave(ws);
    }
  }

  async webSocketClose(ws: WS) {
    await this.afterDisconnect(ws);
  }

  async webSocketError(ws: WS) {
    await this.afterDisconnect(ws);
  }

  private async afterDisconnect(ws: WS) {
    try { ws.close(); } catch { /* すでに閉じている */ }
    if (!this.room) return;
    this.room.lastActive = Date.now();
    await this.save();
    this.broadcast(ws);
  }

  // ── メッセージごとの処理 ─────────────────────────

  private async onHello(ws: WS, msg: Extract<ClientMessage, { type: 'hello' }>) {
    const att = ws.deserializeAttachment() ?? {};
    const room = this.room;

    // 部屋を作る
    if (msg.create) {
      if (room && (room.status !== 'finished' || this.connectedPlayers().size > 0)) {
        return this.fatal(ws, 'その部屋コードは使われています', 'room_taken');
      }
      const token = crypto.randomUUID();
      this.room = {
        code: att.code,
        origin: att.origin,
        settings: sanitizeSettings(msg.create),
        tokens: { 1: token },
        status: 'waiting',
        currentPlayer: 1,
        scores: { p1: 0, p2: 0 },
        history: [],
        judging: false,
        loser: null,
        reason: '',
        turnDeadline: null,
        lastActive: Date.now(),
      };
      return this.attach(ws, 1, token);
    }

    if (!room) return this.fatal(ws, '部屋が見つかりません。部屋コードを確かめてください', 'not_found');

    // 再接続（同じ端末がつなぎ直した）
    const known = ([1, 2] as PlayerNo[]).find(p => msg.token && room.tokens[p] === msg.token);
    if (known) return this.attach(ws, known, room.tokens[known]!);

    // 部屋を作った人が待っている間に抜けた部屋には入れない
    if (room.status === 'finished' && !room.tokens[2]) {
      return this.fatal(ws, 'この部屋は閉じられました。新しい部屋コードをもらってください', 'not_found');
    }

    // 2人目として参加
    if (!room.tokens[2]) {
      const token = crypto.randomUUID();
      room.tokens[2] = token;
      room.status = 'playing';
      room.currentPlayer = 1;
      this.startTurn();
      return this.attach(ws, 2, token);
    }
    return this.fatal(ws, 'この部屋はすでに2人そろっています', 'full');
  }

  private async attach(ws: WS, player: PlayerNo, token: string) {
    const att = ws.deserializeAttachment() ?? {};
    // 同じプレイヤーの古い接続は閉じる（つなぎ直したときなど）
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws && other.deserializeAttachment()?.player === player) {
        try { other.close(4000, 'replaced'); } catch { /* 無視 */ }
      }
    }
    ws.serializeAttachment({ ...att, player });
    this.room!.lastActive = Date.now();
    await this.save();
    this.sendTo(ws, { type: 'welcome', player, token });
    this.broadcast();
  }

  private async onPlay(ws: WS, rawWord: string) {
    const room = this.room;
    const player: PlayerNo | null = ws.deserializeAttachment()?.player ?? null;
    if (!room || !player) return;
    if (room.status !== 'playing') return this.sendTo(ws, { type: 'error', message: '対戦中ではありません' });
    if (room.currentPlayer !== player) return this.sendTo(ws, { type: 'error', message: '相手の番です' });
    if (room.judging) return;

    const word = String(rawWord ?? '').trim();
    if (!word || word.length > 40) return this.sendTo(ws, { type: 'error', message: '英単語を入力してください' });
    const { charLimit } = room.settings;
    if (charLimit !== null && word.length !== charLimit) {
      return this.sendTo(ws, { type: 'error', message: `${charLimit}文字の英単語を入力してください` });
    }

    // 判定中は時間を止める（端末1台の対戦と同じ）
    room.judging = true;
    room.turnDeadline = null;
    await this.save();
    this.broadcast();

    let data: any;
    try {
      data = await this.judge(word);
    } catch {
      data = null;
    }
    // 判定待ちの間に相手が退出するなどして対戦が終わっていたら、結果は捨てる
    if (!this.room || this.room.status !== 'playing') return;

    if (!data || typeof data.is_valid !== 'boolean') {
      room.judging = false;
      this.startTurn();
      await this.save();
      this.sendTo(ws, { type: 'error', message: data?.error || 'AIとの通信に失敗しました。もう一度送信してください' });
      return this.broadcast();
    }

    room.judging = false;
    if (data.is_valid) {
      const key = player === 1 ? 'p1' : 'p2';
      const score = Number(data.score) || 0;
      room.scores[key] += score;
      room.history.push({
        word,
        player,
        bonus: data.is_synonym ? '類義語ボーナス x2!' : data.is_antonym ? '対義語ボーナス x2!' : '',
        translation: String(data.user_word_jp ?? ''),
        level: data.jacet_level,
        levelEstimated: !!data.level_estimated,
        score,
      });
      const opponent = player === 1 ? room.scores.p2 : room.scores.p1;
      // スコアモードでは相手のスコアを超えたときだけ交代する
      if (!room.settings.isOvertake || room.scores[key] > opponent) {
        room.currentPlayer = player === 1 ? 2 : 1;
      }
      this.startTurn();
    } else {
      this.finish(player, String(data.reason || 'テーマに合っていません'));
    }
    room.lastActive = Date.now();
    await this.save();
    this.broadcast();
  }

  private async onRematch(ws: WS) {
    const room = this.room;
    if (!room || room.status !== 'finished' || !room.tokens[2]) return;
    if (!ws.deserializeAttachment()?.player) return;
    const lastLoser = room.loser;
    room.status = 'playing';
    room.history = [];
    room.scores = { p1: 0, p2: 0 };
    room.loser = null;
    room.reason = '';
    room.judging = false;
    // 前回負けた方から始める（最初の対戦はプレイヤー1から）
    room.currentPlayer = lastLoser ?? 1;
    this.startTurn();
    await this.save();
    this.broadcast();
  }

  private async onLeave(ws: WS) {
    const room = this.room;
    const player: PlayerNo | null = ws.deserializeAttachment()?.player ?? null;
    ws.serializeAttachment({ ...(ws.deserializeAttachment() ?? {}), player: null });
    if (room && player) {
      if (room.status === 'playing') this.finish(player, `${player === 1 ? 'プレイヤー1' : 'プレイヤー2'}が退出しました`);
      // 待っている間に部屋を作った人が抜けたら、その部屋はもう使わない
      if (room.status === 'waiting' && player === 1) room.status = 'finished';
      room.lastActive = Date.now();
      await this.save();
    }
    try { ws.close(1000, 'leave'); } catch { /* 無視 */ }
    this.broadcast(ws);
  }

  // ── 時間制限と片付け ─────────────────────────────

  async alarm() {
    const room = this.room;
    if (!room) return;
    const now = Date.now();
    if (room.status === 'playing' && !room.judging && room.turnDeadline && now >= room.turnDeadline) {
      this.finish(room.currentPlayer, '時間切れ！');
      room.lastActive = now;
      await this.save();
      this.broadcast();
      return;
    }
    if (this.connectedPlayers().size === 0 && now - room.lastActive >= IDLE_CLEANUP_MS) {
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    await this.scheduleAlarm();
  }

  private startTurn() {
    const room = this.room!;
    room.turnDeadline = room.settings.timeLimit
      ? Date.now() + room.settings.timeLimit * 1000 + TIMEOUT_GRACE_MS
      : null;
  }

  private finish(loser: PlayerNo, reason: string) {
    const room = this.room!;
    room.status = 'finished';
    room.loser = loser;
    room.reason = reason;
    room.judging = false;
    room.turnDeadline = null;
  }

  private async scheduleAlarm() {
    const room = this.room;
    if (!room) return;
    const next = room.status === 'playing' && room.turnDeadline
      ? room.turnDeadline
      : room.lastActive + IDLE_CLEANUP_MS;
    await this.ctx.storage.setAlarm(Math.max(next, Date.now() + 1000));
  }

  // ── 判定（アプリ自身の /api/game を呼ぶ） ─────────────

  private async judge(word: string) {
    const room = this.room!;
    const body = JSON.stringify({
      theme: room.settings.theme,
      themeDefinition: room.settings.themeDefinition,
      userWord: word,
      history: room.history.map(h => h.word),
      mode: 'pvp',
      charLimit: room.settings.charLimit,
      posLimit: room.settings.posLimit,
    });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.env.APP_PASSCODE) {
      headers.Cookie = `${PASSCODE_COOKIE}=${await tokenFor(this.env.APP_PASSCODE)}`;
    }
    const url = `${room.origin}/api/game`;
    // 同じ Worker への呼び出しは、あればサービスバインディング経由で行う
    const target = this.env.WORKER_SELF_REFERENCE ?? { fetch: (r: Request) => fetch(r) };
    const res = await target.fetch(new Request(url, { method: 'POST', headers, body }));
    return res.json();
  }

  // ── 送信と保存 ─────────────────────────────────

  private connectedPlayers(except?: WS): Set<PlayerNo> {
    const set = new Set<PlayerNo>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const p = ws.deserializeAttachment()?.player;
      if (p === 1 || p === 2) set.add(p);
    }
    return set;
  }

  private publicState(except?: WS): RoomState {
    const room = this.room!;
    const connected = this.connectedPlayers(except);
    return {
      code: room.code,
      settings: room.settings,
      status: room.status,
      players: {
        1: { joined: !!room.tokens[1], connected: connected.has(1) },
        2: { joined: !!room.tokens[2], connected: connected.has(2) },
      },
      currentPlayer: room.currentPlayer,
      scores: room.scores,
      history: room.history,
      judging: room.judging,
      loser: room.loser,
      reason: room.reason,
      turnRemainingMs: room.status === 'playing' && room.turnDeadline
        ? Math.max(0, room.turnDeadline - Date.now() - TIMEOUT_GRACE_MS)
        : null,
    };
  }

  /** except: 閉じかけの接続（送らない・つながっている人数にも数えない） */
  private broadcast(except?: WS) {
    if (!this.room) return;
    const msg: ServerMessage = { type: 'state', state: this.publicState(except) };
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except || !ws.deserializeAttachment()?.player) continue;
      this.sendTo(ws, msg);
    }
  }

  private sendTo(ws: WS, msg: ServerMessage) {
    try { ws.send(JSON.stringify(msg)); } catch { /* 切れている */ }
  }

  private fatal(ws: WS, message: string, code: 'room_taken' | 'not_found' | 'full') {
    this.sendTo(ws, { type: 'error', message, fatal: true, code });
    try { ws.close(1000, code); } catch { /* 無視 */ }
  }

  private async save() {
    if (!this.room) return;
    await this.ctx.storage.put('room', this.room);
    await this.scheduleAlarm();
  }
}

/** 画面から届いた設定を、想定している範囲に収める */
function sanitizeSettings(s: RoomSettings): RoomSettings {
  const charLimit = Number.isInteger(s.charLimit) && s.charLimit! >= 2 && s.charLimit! <= 12 ? s.charLimit : null;
  const timeLimit = Number.isInteger(s.timeLimit) && s.timeLimit! >= 5 && s.timeLimit! <= 60 ? s.timeLimit : null;
  const posLimit = ['名詞', '動詞', '形容詞', '副詞'].includes(String(s.posLimit)) ? s.posLimit : null;
  return {
    theme: String(s.theme ?? '').slice(0, 40).toUpperCase() || 'ANIMAL',
    themeDefinition: String(s.themeDefinition ?? '').slice(0, 300),
    charLimit,
    posLimit,
    timeLimit,
    isOvertake: !!s.isOvertake,
  };
}
