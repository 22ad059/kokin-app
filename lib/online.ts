/**
 * オンライン対戦（別々の端末で遊ぶ）で、画面と部屋サーバー（Cloudflare Durable Object）が
 * やり取りするメッセージの型。どちらからも読み込むので Next.js や Workers 固有の物は使わない。
 */
import type { WordEntry } from '@/types/study';

/** プレイヤー番号（1 が部屋主）。1〜MAX_PLAYERS */
export type PlayerNo = number;
export const MAX_PLAYERS = 6;

/** battle: 古今東西の対戦 / practice: 練習ゲーム（単語リストを出し合う） */
export type GameType = 'battle' | 'practice';
/** coop: みんなで協力してリストを出し切る / compete: 同じリストから点数を競う */
export type PracticeMode = 'coop' | 'compete';

/** 部屋主が部屋の中で決めるルール */
export interface RoomSettings {
  gameType: GameType;
  // ── 対戦 ──
  theme: string;
  themeDefinition: string;
  charLimit: number | null;
  posLimit: string | null;
  /** スコアモード: ほかの人のスコアを超えるまで交代しない */
  isOvertake: boolean;
  // ── 練習 ──
  practiceMode: PracticeMode;
  levels: string[];
  genres: string[];
  // ── 共通 ──
  /** 1手ごとの制限時間（秒）。null は無制限 */
  timeLimit: number | null;
}

export interface OnlineMove {
  word: string;
  player: PlayerNo;
  /** 類義語・対義語ボーナスの表示（なければ空） */
  bonus: string;
  translation: string;
  level?: string;
  levelEstimated?: boolean;
  score: number;
  /** 練習: ヒント（和訳）が出ていた単語 */
  hinted?: boolean;
  /** 練習: つづりを1文字まちがえて直されたとき、入力されたつづり（得点は半分） */
  typedAs?: string;
}

export interface PlayerInfo {
  no: PlayerNo;
  /** 今つながっている */
  connected: boolean;
  /** この対戦に参加している（開始時にいた人） */
  inGame: boolean;
  /** 対戦: 脱落した */
  eliminated: boolean;
  score: number;
  words: number;
  /** 練習: 使えなかった・時間切れの回数 */
  misses: number;
  /** 練習: つづりを1文字まちがえて直された回数 */
  spellFixes: number;
}

/** waiting: 部屋でルールを決めている / playing: 対戦中 / finished: 決着 */
export type RoomStatus = 'waiting' | 'playing' | 'finished';

/** 部屋の状態（全員の画面に同じものが届く） */
export interface RoomState {
  code: string;
  settings: RoomSettings;
  status: RoomStatus;
  /** 部屋にいる（席がある）プレイヤー。番号順 */
  players: PlayerInfo[];
  currentPlayer: PlayerNo;
  history: OnlineMove[];
  /** AI が判定中 */
  judging: boolean;
  /** 開始ボタンが押され、準備中 */
  starting: boolean;
  /** 対戦: 勝った人 / 練習（競争）: 1位（同点なら null） */
  winner: PlayerNo | null;
  /** 決着の理由（「時間切れ！」「クリア！」など） */
  reason: string;
  /** 対戦: 脱落した順 */
  eliminations: { player: PlayerNo; word: string; reason: string }[];
  /** 直前の出来事（「プレイヤー2が脱落」など）。全員にお知らせとして出す */
  notice: string;
  /** 今の手番の残り時間（ミリ秒）。時間制限なし・判定中・対戦中でないときは null */
  turnRemainingMs: number | null;
  // ── 練習 ──
  wordList: WordEntry[];
  /** 協力: 和訳ヒントが出ている単語（見出し語） */
  hinted: string[];
  /** 練習: リストを出し切った */
  cleared: boolean;
}

export type ClientMessage =
  | { type: 'hello'; token?: string; create?: boolean }
  /** 部屋主がルールを変える（部屋で待っている間だけ） */
  | { type: 'settings'; settings: RoomSettings }
  /** 部屋主が始める（2人以上そろっているときだけ） */
  | { type: 'start' }
  | { type: 'play'; word: string }
  /** 協力: 和訳ヒントを1つ出す */
  | { type: 'hint' }
  /** 練習: みんなでやめる（残りの単語を見る） */
  | { type: 'retire' }
  /** 同じルールでもう一回 */
  | { type: 'rematch' }
  /** 決着後、部屋に戻ってルールを決め直す */
  | { type: 'toLobby' }
  | { type: 'leave' };

export type ServerMessage =
  | { type: 'welcome'; player: PlayerNo; token: string }
  | { type: 'state'; state: RoomState }
  /** fatal: この接続では続けられない（部屋がない・満員など） */
  | { type: 'error'; message: string; fatal?: boolean; code?: 'room_taken' | 'not_found' | 'full' | 'in_game' };

export const ROOM_CODE_RE = /^\d{4}$/;

export const LEVELS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7', 'Level 8'];

export const DEFAULT_SETTINGS: RoomSettings = {
  gameType: 'battle',
  theme: '',
  themeDefinition: '',
  charLimit: null,
  posLimit: null,
  isOvertake: false,
  practiceMode: 'coop',
  levels: ['Level 1', 'Level 2'],
  genres: [],
  timeLimit: null,
};

export function randomRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** 画面に出すプレイヤーの呼び名 */
export function playerLabel(p: PlayerNo, me: PlayerNo | null): string {
  return p === me ? 'あなた' : `プレイヤー${p}`;
}
