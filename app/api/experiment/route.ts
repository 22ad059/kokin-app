/**
 * 効果検証実験の記録 API
 * - POST { records: ExperimentRecord[] } : 実験ページから記録を送る
 * - GET ?format=summary : 参加者ごとの進み具合（研究者用ページの一覧）
 * - GET ?format=rounds  : 周ごとの記録（CSV）
 * - GET ?format=words   : 周×ターゲット語ごとの記録（CSV）
 * - GET ?format=json    : すべての記録（JSON）
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { appendRecords, allRecords } from '@/lib/experimentStore';
import { isValidParticipantId, type ExperimentRecord } from '@/lib/experiment';
import { EXPERIMENT_SETS } from '@/data/experimentSets';
import { lookupEntry } from '@/lib/wordLoader';
import { sameWord } from '@/lib/wordMatch';

const KINDS = new Set(['start', 'round', 'end']);
const MAX_RECORDS_PER_POST = 50;

function isRecord(r: unknown): r is ExperimentRecord {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return typeof o.id === 'string' && o.id.length <= 100
    && typeof o.sessionId === 'string' && o.sessionId.length <= 100
    && typeof o.pid === 'number' && isValidParticipantId(o.pid)
    && typeof o.set === 'string' && Object.hasOwn(EXPERIMENT_SETS, o.set)
    && typeof o.at === 'number'
    && typeof o.kind === 'string' && KINDS.has(o.kind);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON ではありません' }, { status: 400 }); }
  const records = (body as { records?: unknown })?.records;
  if (!Array.isArray(records) || records.length === 0 || records.length > MAX_RECORDS_PER_POST || !records.every(isRecord)) {
    return NextResponse.json({ error: '記録の形式が正しくありません' }, { status: 400 });
  }
  if (JSON.stringify(records).length > 200_000) {
    return NextResponse.json({ error: '記録が大きすぎます' }, { status: 413 });
  }
  try {
    await appendRecords(records);
    return NextResponse.json({ saved: records.length });
  } catch (e) {
    console.error('experiment append failed:', e);
    return NextResponse.json({ error: '記録を保存できませんでした' }, { status: 500 });
  }
}

// ── 書き出し ──

const iso = (ms: number) => new Date(ms).toISOString();
function csv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Excel で文字化けしないよう BOM を付ける
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
function csvResponse(name: string, body: string) {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}

type RoundRecord = Extract<ExperimentRecord, { kind: 'round' }>;

function sortRounds(records: ExperimentRecord[]): RoundRecord[] {
  return records
    .filter((r): r is RoundRecord => r.kind === 'round')
    .sort((a, b) => a.pid - b.pid || a.startedAt - b.startedAt || a.round - b.round);
}

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get('format') ?? 'summary';
  let records: ExperimentRecord[];
  try { records = await allRecords(); } catch (e) {
    console.error('experiment read failed:', e);
    return NextResponse.json({ error: '記録を読み込めませんでした' }, { status: 500 });
  }
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'json') {
    return new NextResponse(JSON.stringify(records, null, 1), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="experiment_all_${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'rounds') {
    const rows: (string | number)[][] = [[
      'participant_id', 'word_set', 'session_id', 'round', 'started_at', 'ended_at', 'end_reason', 'play_seconds',
      'user_words', 'user_target_words', 'ai_words', 'hinted_words', 'spell_fixed', 'rejected_inputs', 'review_words', 'score',
    ]];
    for (const r of sortRounds(records)) {
      const targets = EXPERIMENT_SETS[r.set]?.words ?? [];
      const user = r.moves.filter(m => m.by === 'user');
      rows.push([
        r.pid, r.set, r.sessionId, r.round, iso(r.startedAt), iso(r.endedAt), r.endReason,
        Math.round((r.endedAt - r.startedAt) / 1000),
        user.length, user.filter(m => targets.some(t => sameWord(t, m.word))).length,
        r.moves.filter(m => m.by === 'ai').length,
        r.hinted.length, user.filter(m => m.typedAs).length, r.rejected.length, r.reviewWords.length, r.score,
      ]);
    }
    return csvResponse(`experiment_rounds_${stamp}.csv`, csv(rows));
  }

  if (format === 'words') {
    const rows: (string | number)[][] = [[
      'participant_id', 'word_set', 'session_id', 'round', 'word', 'level',
      'played_by_user', 'played_by_ai', 'hint_seen', 'spell_fixed', 'shown_in_review',
    ]];
    for (const r of sortRounds(records)) {
      for (const t of EXPERIMENT_SETS[r.set]?.words ?? []) {
        const userMove = r.moves.find(m => m.by === 'user' && sameWord(m.word, t));
        const yes = (b: boolean) => (b ? 1 : 0);
        rows.push([
          r.pid, r.set, r.sessionId, r.round, t, lookupEntry(t)?.level ?? '',
          yes(!!userMove), yes(r.moves.some(m => m.by === 'ai' && sameWord(m.word, t))),
          yes(r.hinted.some(h => sameWord(h, t))), yes(!!userMove?.typedAs),
          yes(r.reviewWords.some(w => sameWord(w, t))),
        ]);
      }
    }
    return csvResponse(`experiment_words_${stamp}.csv`, csv(rows));
  }

  // summary: セッションごとの進み具合
  const sessions = new Map<string, { pid: number; set: string; sessionId: string; startedAt: number; rounds: number; ended: boolean; lastAt: number }>();
  for (const r of records) {
    const s = sessions.get(r.sessionId) ?? { pid: r.pid, set: r.set, sessionId: r.sessionId, startedAt: r.at, rounds: 0, ended: false, lastAt: r.at };
    if (r.kind === 'start') s.startedAt = r.at;
    if (r.kind === 'round') s.rounds = Math.max(s.rounds, r.round);
    if (r.kind === 'end') s.ended = true;
    s.lastAt = Math.max(s.lastAt, r.at);
    sessions.set(r.sessionId, s);
  }
  const list = [...sessions.values()].sort((a, b) => a.pid - b.pid || a.startedAt - b.startedAt);
  return NextResponse.json({ sessions: list, records: records.length }, { headers: { 'Cache-Control': 'no-store' } });
}
