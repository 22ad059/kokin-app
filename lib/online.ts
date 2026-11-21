/**
 * オンライン対戦（別々の端末で2人対戦）で、画面と部屋サーバー（Cloudflare Durable Object）が
 * やり取りするメッセージの型。どちらからも読み込むので Next.js や Workers 固有の物は使わない。
 */

export type PlayerNo = 1 | 2;

/** 部屋を作った人が決める対戦ルール */
export interface RoomSettings {
  theme: string;
  themeDefinition: string;
  charLimit: number | null;
  posLimit: string | null;
  /** 1手ごとの制限時間（秒）。null は無制限 */
  timeLimit: number | null;
  /** スコアモード: 相手のスコアを超えるまで交代しない */
  isOvertake: boolean;
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
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

/** 部屋の状態（2人の画面に同じものが届く） */
export interface RoomState {
  code: string;
  settings: RoomSettings;
  status: RoomStatus;
  /** 各プレイヤーが参加済みか・今つながっているか */
  players: Record<PlayerNo, { joined: boolean; connected: boolean }>;
  currentPlayer: PlayerNo;
  scores: { p1: number; p2: number };
  history: OnlineMove[];
  /** AI が判定中 */
  judging: boolean;
  loser: PlayerNo | null;
  reason: string;
  /** 今の手番の残り時間（ミリ秒）。時間制限なし・判定中・対戦中でないときは null */
  turnRemainingMs: number | null;
}

export type ClientMessage =
  | { type: 'hello'; token?: string; create?: RoomSettings }
  | { type: 'play'; word: string }
  | { type: 'rematch' }
  | { type: 'leave' };

export type ServerMessage =
  | { type: 'welcome'; player: PlayerNo; token: string }
  | { type: 'state'; state: RoomState }
  /** fatal: この接続では続けられない（部屋がない・満員など） */
  | { type: 'error'; message: string; fatal?: boolean; code?: 'room_taken' | 'not_found' | 'full' };

export const ROOM_CODE_RE = /^\d{4}$/;

export function randomRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
