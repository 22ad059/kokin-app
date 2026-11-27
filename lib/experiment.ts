/**
 * 効果検証実験（/experiment）の決まりごと。画面とサーバーの両方から使う。
 */

/** 参加者 ID 順に回す語セット（ID 1 → nature, 2 → science, 3 → people, 4 → health, 5 → nature …） */
export const EXPERIMENT_ORDER = ['nature', 'science', 'people', 'health'] as const;

export function setForParticipant(pid: number): string {
  return EXPERIMENT_ORDER[(pid - 1) % EXPERIMENT_ORDER.length];
}

export function isValidParticipantId(pid: number): boolean {
  return Number.isInteger(pid) && pid >= 1 && pid <= 9999;
}

/** 周の数 */
export const ROUNDS = 3;
/** 学習の最初に 18 語すべての一覧を見る時間（秒）。過ぎると自動で 1 周目に進む */
export const INTRO_SEC = 90;
/** 「出せなかった単語」を見る時間（秒）。過ぎると自動で次の周に進む */
export const REVIEW_SEC = 90;
/** 各周の練習の締め切り（学習開始からの秒）。1 周目 6:30、2 周目 13:00、3 周目 18:30 */
export const ROUND_DEADLINE_SEC = [390, 780, 1110];

export interface ExperimentMove {
  word: string;
  by: 'user' | 'ai';
  /** UNIX ミリ秒 */
  at: number;
  level?: string;
  /** ヒント（和訳）を見てから出した */
  hinted?: boolean;
  /** つづりを1文字まちがえて直されたときの入力 */
  typedAs?: string;
}

export interface ExperimentRejected {
  typed: string;
  reason: string;
  at: number;
}

interface RecordBase {
  /** 記録ごとの ID（再送しても重複しないように使う） */
  id: string;
  /** 1 回の学習セッションの ID。同じ参加者 ID でやり直したときの区別に使う */
  sessionId: string;
  pid: number;
  set: string;
  /** 記録した時刻（UNIX ミリ秒） */
  at: number;
}

export type ExperimentRecord =
  | (RecordBase & { kind: 'start' })
  | (RecordBase & {
      kind: 'round';
      round: number;
      startedAt: number;
      endedAt: number;
      /** retire: 本人がリタイア / time: 締め切り / clear: 全語を出し切った */
      endReason: 'retire' | 'time' | 'clear';
      moves: ExperimentMove[];
      rejected: ExperimentRejected[];
      /** 和訳ヒントを見た語 */
      hinted: string[];
      /** 「出せなかった単語」の一覧に出た語 */
      reviewWords: string[];
      score: number;
    })
  | (RecordBase & { kind: 'end' });
