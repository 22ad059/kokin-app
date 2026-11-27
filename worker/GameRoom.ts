/**
 * オンライン対戦の部屋サーバー（Cloudflare Durable Object）。部屋コードごとに1つ立ち上がる。
 *
 * - 最大6人と WebSocket でつながり、手番・点数・履歴・制限時間をここで一元管理する
 *   （どの画面も勝手に結果を書き換えられない）
 * - 対戦: 古今東西。テーマ外の単語や時間切れで脱落し、最後に残った1人が勝ち
 * - 練習: 選んだレベル・ジャンルの単語リストを出し合う。協力（みんなで出し切る）と競争（点数）
 * - 単語の判定は、アプリ自身の /api/game を呼び出して行う（1台で遊ぶときと同じ判定）
 * - 状態はストレージに保存するので、部屋サーバーが休止・再起動しても続けられる
 */
import type {
  ClientMessage, OnlineMove, PlayerInfo, PlayerNo, RoomSettings, RoomState, ServerMessage,
} from '../lib/online';
import { DEFAULT_SETTINGS, LEVELS, MAX_PLAYERS } from '../lib/online';
import type { WordEntry } from '../types/study';
import { PASSCODE_COOKIE, tokenFor } from '../lib/passcode';
import { sameWord } from '../lib/wordMatch';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Workers の実行環境が用意するモジュール
import { DurableObject } from 'cloudflare:workers';

/* eslint-disable @typescript-eslint/no-explicit-any */
type WS = any;

interface Seat {
  token: string;
  inGame: boolean;
  eliminated: boolean;
  score: number;
  words: number;
  misses: number;
  /** 練習: つづりを1文字まちがえて直された回数 */
  spellFixes?: number;
}

interface Stored {
  code: string;
  origin: string;
  settings: RoomSettings;
  /** 席（プレイヤー番号 → 情報）。抜けた人の席は消える */
  seats: Record<string, Seat>;
  status: RoomState['status'];
  currentPlayer: PlayerNo;
  history: OnlineMove[];
  judging: boolean;
  starting: boolean;
  /** 部屋主が抜けて、もう使えない部屋 */
  closed: boolean;
  winner: PlayerNo | null;
  reason: string;
  eliminations: RoomState['eliminations'];
  notice: string;
  /** 次の対戦を誰から始めるか */
  nextStarter: PlayerNo;
  /** 手番の締め切り（UNIX ミリ秒）。null は時間制限なし／判定中など */
  turnDeadline: number | null;
  wordList: WordEntry[];
  hinted: string[];
  cleared: boolean;
  lastActive: number;
}

/** 誰もつながっていない部屋はこの時間で片付ける */
const IDLE_CLEANUP_MS = 60 * 60 * 1000;
/** 時間切れ判定の猶予（通信の遅れを見込む） */
const TIMEOUT_GRACE_MS = 1000;

const label = (p: PlayerNo) => `プレイヤー${p}`;

export class GameRoom extends DurableObject {
  declare ctx: any;
  declare env: any;
  room: Stored | null = null;

  constructor(ctx: any, env: any) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get('room');
      // 古い形式（2人用）の部屋は使わない
      this.room = stored && stored.seats ? stored : null;
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
      case 'settings': return this.onSettings(ws, msg.settings);
      case 'start': return this.onStart(ws);
      case 'play': return this.onPlay(ws, msg.word);
      case 'hint': return this.onHint(ws);
      case 'retire': return this.onRetire(ws);
      case 'rematch': return this.onRematch(ws);
      case 'toLobby': return this.onToLobby(ws);
      case 'leave': return this.onLeave(ws);
    }
  }

  async webSocketClose(ws: WS) { await this.afterDisconnect(ws); }
  async webSocketError(ws: WS) { await this.afterDisconnect(ws); }

  private async afterDisconnect(ws: WS) {
    try { ws.close(); } catch { /* すでに閉じている */ }
    if (!this.room) return;
    this.room.lastActive = Date.now();
    await this.save();
    this.broadcast(ws);
  }

  // ── 入室・退室 ─────────────────────────────────

  private async onHello(ws: WS, msg: Extract<ClientMessage, { type: 'hello' }>) {
    const att = ws.deserializeAttachment() ?? {};
    const room = this.room;

    // 部屋を作る（ルールは部屋に入ってから決める）
    if (msg.create) {
      const inUse = room && !room.closed
        && (this.connectedPlayers().size > 0 || Date.now() - room.lastActive < IDLE_CLEANUP_MS);
      if (inUse) return this.fatal(ws, 'その部屋コードは使われています', 'room_taken');
      const token = crypto.randomUUID();
      this.room = {
        code: att.code,
        origin: att.origin,
        settings: { ...DEFAULT_SETTINGS },
        seats: { 1: newSeat(token) },
        status: 'waiting',
        currentPlayer: 1,
        history: [],
        judging: false,
        starting: false,
        closed: false,
        winner: null,
        reason: '',
        eliminations: [],
        notice: '',
        nextStarter: 1,
        turnDeadline: null,
        wordList: [],
        hinted: [],
        cleared: false,
        lastActive: Date.now(),
      };
      return this.attach(ws, 1, token);
    }

    if (!room) return this.fatal(ws, '部屋が見つかりません。部屋コードを確かめてください', 'not_found');

    // 再接続（同じ端末がつなぎ直した）
    const known = this.seatNumbers().find(p => msg.token && room.seats[p].token === msg.token);
    if (known) return this.attach(ws, known, room.seats[known].token);

    if (room.closed) return this.fatal(ws, 'この部屋は閉じられました。新しい部屋コードをもらってください', 'not_found');
    if (room.status === 'playing') return this.fatal(ws, '対戦中なので入れません。終わるまで待ってください', 'in_game');

    // 空いている一番小さい番号の席に座る
    const free = Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1).find(p => !room.seats[p]);
    if (!free) return this.fatal(ws, `この部屋は満員です（最大${MAX_PLAYERS}人）`, 'full');
    const token = crypto.randomUUID();
    room.seats[free] = newSeat(token);
    return this.attach(ws, free, token);
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

  private async onLeave(ws: WS) {
    const room = this.room;
    const player: PlayerNo | null = ws.deserializeAttachment()?.player ?? null;
    ws.serializeAttachment({ ...(ws.deserializeAttachment() ?? {}), player: null });
    if (room && player && room.seats[player]) {
      if (room.status === 'playing') this.dropOut(player, `${label(player)}が退出しました`);
      if (player === 1) {
        // 部屋主が抜けたら、その部屋はもう使わない
        room.closed = true;
        if (room.status !== 'finished') this.finish('部屋主が退出しました');
      }
      // 抜けた人の席を空けて、別の人が入れるようにする（対戦中は結果表示のため残す）
      if (room.status !== 'playing') delete room.seats[player];
      room.lastActive = Date.now();
      await this.save();
    }
    try { ws.close(1000, 'leave'); } catch { /* 無視 */ }
    this.broadcast(ws);
  }

  // ── 部屋でルールを決める ───────────────────────────

  /** 部屋主だけがルールを変えられる */
  private async onSettings(ws: WS, settings: RoomSettings) {
    const room = this.room;
    if (!room || room.status !== 'waiting' || room.starting) return;
    if (ws.deserializeAttachment()?.player !== 1) return;
    room.settings = sanitizeSettings(settings);
    room.lastActive = Date.now();
    await this.save();
    this.broadcast();
  }

  private async onStart(ws: WS) {
    const room = this.room;
    if (!room || room.status !== 'waiting' || room.starting) return;
    if (ws.deserializeAttachment()?.player !== 1) return;
    const here = [...this.connectedPlayers()].filter(p => room.seats[p]);
    if (here.length < 2) return this.sendTo(ws, { type: 'error', message: '2人以上そろうと始められます' });
    const s = room.settings;
    if (s.gameType === 'battle' && !s.theme.trim()) return this.sendTo(ws, { type: 'error', message: 'テーマを決めてください' });
    if (s.gameType === 'practice' && (!s.levels.length || !s.genres.length)) {
      return this.sendTo(ws, { type: 'error', message: 'レベルとジャンルを選んでください' });
    }
    // 練習の競争・対戦のミスOK は「時間内に答えられなかったら脱落」なので、時間制限なしでは始めない
    if (retryOnMiss(s) && s.timeLimit === null) room.settings = { ...s, timeLimit: 15 };

    room.starting = true;
    await this.save();
    this.broadcast();

    let error = '';
    if (s.gameType === 'battle') {
      // お題の定義を作る（失敗しても定義なしで始める。1台で遊ぶときと同じ）
      try {
        const data = await this.callApp('/api/theme', { theme: s.theme });
        room.settings = { ...room.settings, themeDefinition: typeof data?.definition === 'string' ? data.definition : '' };
      } catch { /* 定義なしで始める */ }
    } else {
      try {
        const params = new URLSearchParams({ level: s.levels.join(','), genre: s.genres.join(','), sort: 'rank' });
        const data = await this.callApp(`/api/words?${params}`);
        room.wordList = Array.isArray(data?.words) ? data.words : [];
        if (!room.wordList.length) error = '選んだレベル・ジャンルに単語がありません';
      } catch {
        error = '単語リストを読み込めませんでした。もう一度押してください';
      }
    }

    room.starting = false;
    if (!this.room || room.status !== 'waiting') { await this.save(); return this.broadcast(); }
    if (error) {
      await this.save();
      this.sendTo(ws, { type: 'error', message: error });
      return this.broadcast();
    }
    this.beginGame();
    await this.save();
    this.broadcast();
  }

  /** 今つながっている人で対戦を始める */
  private beginGame() {
    const room = this.room!;
    const here = this.connectedPlayers();
    for (const p of this.seatNumbers()) {
      const seat = room.seats[p];
      seat.inGame = here.has(p);
      seat.eliminated = false;
      seat.score = 0;
      seat.words = 0;
      seat.misses = 0;
      seat.spellFixes = 0;
    }
    room.status = 'playing';
    room.history = [];
    room.winner = null;
    room.reason = '';
    room.eliminations = [];
    room.notice = '';
    room.hinted = [];
    room.cleared = false;
    room.judging = false;
    const starter = room.seats[room.nextStarter]?.inGame ? room.nextStarter : this.active()[0];
    room.currentPlayer = starter;
    this.startTurn();
  }

  // ── 対戦中 ─────────────────────────────────────

  private async onPlay(ws: WS, rawWord: string) {
    const room = this.room;
    const player: PlayerNo | null = ws.deserializeAttachment()?.player ?? null;
    if (!room || !player) return;
    if (room.status !== 'playing') return this.sendTo(ws, { type: 'error', message: '対戦中ではありません' });
    if (room.currentPlayer !== player) return this.sendTo(ws, { type: 'error', message: 'あなたの番ではありません' });
    if (room.judging) return;

    const word = String(rawWord ?? '').trim();
    if (!word || word.length > 40) return this.sendTo(ws, { type: 'error', message: '英単語を入力してください' });
    const s = room.settings;
    if (s.gameType === 'battle' && s.charLimit !== null && word.length !== s.charLimit) {
      return this.sendTo(ws, { type: 'error', message: `${s.charLimit}文字の英単語を入力してください` });
    }

    // 判定中は時間を止める（1台で遊ぶときと同じ）。競争でミスしたときは、残り時間から続ける
    const leftMs = room.turnDeadline ? Math.max(0, room.turnDeadline - Date.now()) : null;
    room.judging = true;
    room.turnDeadline = null;
    await this.save();
    this.broadcast();

    let data: any = null;
    try {
      data = s.gameType === 'battle'
        ? await this.callApp('/api/game', {
          theme: s.theme,
          themeDefinition: s.themeDefinition,
          userWord: word,
          history: room.history.map(h => h.word),
          mode: 'pvp',
          charLimit: s.charLimit,
          posLimit: s.posLimit,
          spellFix: s.spellFix,
        })
        : await this.callApp('/api/game', {
          userWord: word,
          history: room.history.map(h => h.word),
          mode: 'solo',
          practiceWords: room.wordList.map(w => w.word),
          practiceGenres: s.genres,
          practiceLevels: s.levels,
        });
    } catch { /* 下で通信失敗として扱う */ }

    // 判定待ちの間に対戦が終わっていたら（全員退出など）、結果は捨てる
    if (!this.room || this.room.status !== 'playing') return;
    room.judging = false;

    if (!data || typeof data.is_valid !== 'boolean') {
      this.startTurn();
      await this.save();
      this.sendTo(ws, { type: 'error', message: data?.error || 'AIとの通信に失敗しました。もう一度送信してください' });
      return this.broadcast();
    }

    const seat = room.seats[player];
    if (data.is_valid) {
      const score = Number(data.score) || 0;
      seat.score += score;
      seat.words += 1;
      if (data.corrected_word) seat.spellFixes = (seat.spellFixes ?? 0) + 1;
      // つづりを1文字まちがえたときは、直した単語で記録する
      const played = data.corrected_word ? String(data.corrected_word) : word;
      room.history.push({
        word: played,
        typedAs: data.corrected_word ? String(data.typed_word ?? word) : undefined,
        player,
        bonus: data.is_synonym ? '類義語ボーナス x2!' : data.is_antonym ? '対義語ボーナス x2!' : '',
        translation: String(data.user_word_jp ?? ''),
        level: data.jacet_level,
        levelEstimated: !!data.level_estimated,
        score,
        hinted: room.hinted.some(h => sameWord(h, played)),
      });
      room.notice = '';
      if (s.gameType === 'practice' && this.remainingWords().length === 0) {
        room.cleared = true;
        this.finish('クリア！選んだ単語をすべて出し切りました');
      } else if (s.gameType === 'battle' && s.isOvertake) {
        // スコアモード: ほかの残っている人の最高点を超えたら交代
        const others = this.active().filter(p => p !== player).map(p => room.seats[p].score);
        if (seat.score > Math.max(0, ...others)) this.advance();
        else this.startTurn();
      } else {
        this.advance();
      }
    } else if (retryOnMiss(s)) {
      // 練習の競争・対戦のミスOK: ミスは何度してもよい。自分の番のまま、残り時間で打ち直す
      seat.misses += 1;
      room.notice = `${label(player)}の「${word}」は使えません：${String(data.reason || '')}`;
      // 残り時間に下限は付けない（時間切れ寸前に使えない単語を送り続けて、時間を引き延ばせないように）
      room.turnDeadline = leftMs !== null ? Date.now() + leftMs : null;
    } else if (s.gameType === 'battle') {
      this.dropOut(player, String(data.reason || 'テーマに合っていません'), word);
    } else {
      // 協力: 使えない単語はミスとして数え、次の人へ
      seat.misses += 1;
      room.notice = `${label(player)}の「${word}」は使えません：${String(data.reason || '')}`;
      this.advance();
    }
    room.lastActive = Date.now();
    await this.save();
    this.broadcast();
  }

  /** 協力: リストからまだ出ていない単語の和訳ヒントを1つ出す */
  private async onHint(ws: WS) {
    const room = this.room;
    const player = ws.deserializeAttachment()?.player;
    if (!room || !player || room.status !== 'playing') return;
    if (room.settings.gameType !== 'practice' || room.settings.practiceMode !== 'coop') return;
    const closed = this.remainingWords().filter(w => !room.hinted.some(h => sameWord(h, w.word)));
    const pick = closed[Math.floor(Math.random() * closed.length)];
    if (!pick) return;
    room.hinted.push(pick.word);
    await this.save();
    this.broadcast();
  }

  /** 練習: やめる（協力はみんなで、競争はその時点の点数で決着） */
  private async onRetire(ws: WS) {
    const room = this.room;
    const player = ws.deserializeAttachment()?.player;
    if (!room || !player || room.status !== 'playing' || room.settings.gameType !== 'practice') return;
    if (!room.seats[player]?.inGame) return;
    this.finish(`${label(player)}がリタイアしました`);
    await this.save();
    this.broadcast();
  }

  // ── 決着後 ─────────────────────────────────────

  private async onRematch(ws: WS) {
    const room = this.room;
    if (!room || room.status !== 'finished' || room.closed) return;
    if (!ws.deserializeAttachment()?.player) return;
    if ([...this.connectedPlayers()].filter(p => room.seats[p]).length < 2) {
      return this.sendTo(ws, { type: 'error', message: '2人以上いないと始められません' });
    }
    this.beginGame();
    await this.save();
    this.broadcast();
  }

  /** 決着後に部屋へ戻って、ルールを決め直す */
  private async onToLobby(ws: WS) {
    const room = this.room;
    if (!room || room.status !== 'finished' || room.closed) return;
    if (!ws.deserializeAttachment()?.player) return;
    room.status = 'waiting';
    room.history = [];
    room.reason = '';
    room.notice = '';
    room.turnDeadline = null;
    room.wordList = [];
    room.hinted = [];
    // いなくなった人の席を空ける
    const here = this.connectedPlayers();
    for (const p of this.seatNumbers()) if (p !== 1 && !here.has(p)) delete room.seats[p];
    room.lastActive = Date.now();
    await this.save();
    this.broadcast();
  }

  // ── 手番・脱落・決着 ─────────────────────────────

  /** 対戦中で、まだ脱落していない人（番号順） */
  private active(): PlayerNo[] {
    const room = this.room!;
    return this.seatNumbers().filter(p => room.seats[p].inGame && !room.seats[p].eliminated);
  }

  /** 次の人（残っている人の中で、今の人の次の番号。最後なら最初に戻る） */
  private advance() {
    const room = this.room!;
    const act = this.active();
    if (!act.length) return;
    room.currentPlayer = act.find(p => p > room.currentPlayer) ?? act[0];
    this.startTurn();
  }

  /** 対戦: 脱落させる。練習: 抜けた扱いにする。残りが1人（練習は0人）なら決着 */
  private dropOut(player: PlayerNo, reason: string, word = '') {
    const room = this.room!;
    const seat = room.seats[player];
    if (!seat || !seat.inGame || seat.eliminated) return;
    const wasTurn = room.currentPlayer === player;
    seat.eliminated = true;
    // 対戦と練習の競争は、脱落した人を記録し、最後の1人が勝ち
    const knockout = room.settings.gameType === 'battle' || isCompete(room.settings);
    if (knockout) room.eliminations.push({ player, word, reason });
    room.notice = knockout ? `${label(player)}が脱落：${reason}` : reason;

    const act = this.active();
    if (knockout && act.length <= 1) {
      room.winner = act[0] ?? null;
      this.finish(reason);
      return;
    }
    if (!knockout && act.length === 0) {
      this.finish(reason);
      return;
    }
    if (wasTurn) {
      room.currentPlayer = act.find(p => p > player) ?? act[0];
      this.startTurn();
    }
  }

  private finish(reason: string) {
    const room = this.room!;
    room.status = 'finished';
    room.reason = reason;
    room.judging = false;
    room.turnDeadline = null;
    if (isCompete(room.settings) && this.active().length > 1) {
      // 競争で、リストを出し切った・リタイアしたとき: 残っている人の中で点数が一番高い人（同点なら引き分け）
      const ranked = this.active()
        .sort((a, b) => room.seats[b].score - room.seats[a].score);
      const top = ranked[0];
      room.winner = top !== undefined && (ranked.length < 2 || room.seats[top].score > room.seats[ranked[1]].score) ? top : null;
    }
    // 次は、最初に脱落した人（対戦）か、今回の最後の手番の人から
    room.nextStarter = room.eliminations[0]?.player ?? room.currentPlayer;
  }

  private startTurn() {
    const room = this.room!;
    room.turnDeadline = room.settings.timeLimit
      ? Date.now() + room.settings.timeLimit * 1000 + TIMEOUT_GRACE_MS
      : null;
  }

  private remainingWords(): WordEntry[] {
    const room = this.room!;
    return room.wordList.filter(w => !room.history.some(h => sameWord(h.word, w.word)));
  }

  // ── 時間制限と片付け ─────────────────────────────

  async alarm() {
    const room = this.room;
    if (!room) return;
    const now = Date.now();
    if (room.status === 'playing' && !room.judging && room.turnDeadline && now >= room.turnDeadline) {
      const p = room.currentPlayer;
      if (room.settings.gameType === 'battle' || isCompete(room.settings)) {
        this.dropOut(p, '時間切れ！');
      } else {
        // 協力: 時間切れはミスとして数え、次の人へ
        room.seats[p].misses += 1;
        room.notice = `${label(p)}は時間切れ`;
        this.advance();
      }
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

  private async scheduleAlarm() {
    const room = this.room;
    if (!room) return;
    const next = room.status === 'playing' && room.turnDeadline
      ? room.turnDeadline
      : room.lastActive + IDLE_CLEANUP_MS;
    await this.ctx.storage.setAlarm(Math.max(next, Date.now() + 1000));
  }

  // ── アプリ自身の API を呼ぶ（合言葉のクッキーを付ける） ──

  private async callApp(path: string, payload?: unknown) {
    const room = this.room!;
    const headers: Record<string, string> = {};
    if (payload !== undefined) headers['Content-Type'] = 'application/json';
    if (this.env.APP_PASSCODE) {
      headers.Cookie = `${PASSCODE_COOKIE}=${await tokenFor(this.env.APP_PASSCODE)}`;
    }
    // 同じ Worker への呼び出しは、あればサービスバインディング経由で行う
    const target = this.env.WORKER_SELF_REFERENCE ?? { fetch: (r: Request) => fetch(r) };
    const init: RequestInit = payload === undefined
      ? { method: 'GET', headers }
      : { method: 'POST', headers, body: JSON.stringify(payload) };
    const res = await target.fetch(new Request(`${room.origin}${path}`, init));
    return res.json();
  }

  // ── 送信と保存 ─────────────────────────────────

  private seatNumbers(): PlayerNo[] {
    return Object.keys(this.room?.seats ?? {}).map(Number).sort((a, b) => a - b);
  }

  private connectedPlayers(except?: WS): Set<PlayerNo> {
    const set = new Set<PlayerNo>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const p = ws.deserializeAttachment()?.player;
      if (typeof p === 'number') set.add(p);
    }
    return set;
  }

  private publicState(except?: WS): RoomState {
    const room = this.room!;
    const connected = this.connectedPlayers(except);
    const players: PlayerInfo[] = this.seatNumbers().map(no => {
      const s = room.seats[no];
      return {
        no, connected: connected.has(no), inGame: s.inGame, eliminated: s.eliminated,
        score: s.score, words: s.words, misses: s.misses, spellFixes: s.spellFixes ?? 0,
      };
    });
    return {
      code: room.code,
      settings: room.settings,
      status: room.status,
      players,
      currentPlayer: room.currentPlayer,
      history: room.history,
      judging: room.judging,
      starting: room.starting,
      winner: room.winner,
      reason: room.reason,
      eliminations: room.eliminations,
      notice: room.notice,
      turnRemainingMs: room.status === 'playing' && room.turnDeadline
        ? Math.max(0, room.turnDeadline - Date.now() - TIMEOUT_GRACE_MS)
        : null,
      wordList: room.status === 'waiting' ? [] : room.wordList,
      hinted: room.hinted,
      cleared: room.cleared,
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

  private fatal(ws: WS, message: string, code: 'room_taken' | 'not_found' | 'full' | 'in_game') {
    this.sendTo(ws, { type: 'error', message, fatal: true, code });
    try { ws.close(1000, code); } catch { /* 無視 */ }
  }

  private async save() {
    if (!this.room) return;
    await this.ctx.storage.put('room', this.room);
    await this.scheduleAlarm();
  }
}

/** 練習ゲームの競争か */
function isCompete(s: RoomSettings): boolean {
  return s.gameType === 'practice' && s.practiceMode === 'compete';
}

/** 使えない単語を出しても脱落せず、打ち直せるルールか（練習の競争・対戦のミスOK） */
function retryOnMiss(s: RoomSettings): boolean {
  return isCompete(s) || (s.gameType === 'battle' && s.missOk);
}

function newSeat(token: string): Seat {
  return { token, inGame: false, eliminated: false, score: 0, words: 0, misses: 0, spellFixes: 0 };
}

/** 画面から届いた設定を、想定している範囲に収める */
function sanitizeSettings(s: RoomSettings): RoomSettings {
  const int = (v: unknown, min: number, max: number) =>
    (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null);
  return {
    gameType: s.gameType === 'practice' ? 'practice' : 'battle',
    theme: String(s.theme ?? '').slice(0, 40).toUpperCase(),
    themeDefinition: '',
    charLimit: int(s.charLimit, 2, 12),
    posLimit: ['名詞', '動詞', '形容詞', '副詞'].includes(String(s.posLimit)) ? s.posLimit : null,
    isOvertake: !!s.isOvertake,
    practiceMode: s.practiceMode === 'compete' ? 'compete' : 'coop',
    levels: Array.isArray(s.levels) ? s.levels.filter(l => LEVELS.includes(l)) : [],
    genres: Array.isArray(s.genres) ? s.genres.map(String).filter(g => g.length <= 30).slice(0, 30) : [],
    timeLimit: int(s.timeLimit, 5, 60),
    missOk: !!s.missOk,
    spellFix: !!s.spellFix,
  };
}
