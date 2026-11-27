'use client';
/**
 * 効果検証実験の研究者用ページ（/experiment/admin）
 * 参加者ごとの進み具合を見て、記録を CSV / JSON でダウンロードする。
 */
import { useState, useEffect, useCallback } from 'react';
import PageShell from '@/components/study/PageShell';
import { EXPERIMENT_ORDER, ROUNDS } from '@/lib/experiment';

interface SessionRow {
  pid: number;
  set: string;
  sessionId: string;
  startedAt: number;
  rounds: number;
  ended: boolean;
  lastAt: number;
}

const SET_NAMES: Record<string, string> = {
  nature: '自然・環境', science: '科学・技術', people: '職業・人物', health: '体・健康・医療',
};
const time = (ms: number) => new Date(ms).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ExperimentAdminPage() {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/experiment?format=summary', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) { setError(d?.error || '読み込めませんでした'); return; }
      setError('');
      setRows(d.sessions ?? []);
      setCount(d.records ?? 0);
    } catch {
      setError('通信エラーが発生しました');
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), 15_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [load]);

  const dupPids = new Set((rows ?? []).map(r => r.pid).filter((p, i, a) => a.indexOf(p) !== i));

  return (
    <PageShell variant="amber" contentKey="admin">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-black text-white">実験の記録（研究者用）</h1>
        <p className="text-white/50 text-xs leading-relaxed">
          参加者には見せないでください。語セットは参加者 ID 順に
          {EXPERIMENT_ORDER.map((s, i) => `${i ? '→' : ''}${SET_NAMES[s]}`).join('')} の順で割り当てられます。
          15 秒ごとに自動で更新します。
        </p>

        <div className="grid grid-cols-3 gap-2">
          <a href="/api/experiment?format=rounds" className="py-3 rounded-2xl text-center text-sm font-black text-white bg-gradient-to-r from-amber-500 to-orange-600">周ごと CSV</a>
          <a href="/api/experiment?format=words" className="py-3 rounded-2xl text-center text-sm font-black text-white bg-gradient-to-r from-amber-500 to-orange-600">単語ごと CSV</a>
          <a href="/api/experiment?format=json" className="py-3 rounded-2xl text-center text-sm font-black text-white/80 bg-white/10 border border-white/20">全記録 JSON</a>
        </div>

        {error && <p role="alert" className="text-rose-300 text-sm font-bold">{error}</p>}

        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm text-white/80">
            <thead className="text-white/40 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">語セット</th>
                <th className="px-3 py-2 text-left">開始</th>
                <th className="px-3 py-2 text-left">進み具合</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-white/30">読み込み中…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-white/30">まだ記録がありません</td></tr>
              ) : rows.map(r => (
                <tr key={r.sessionId} className="border-t border-white/5">
                  <td className="px-3 py-2 font-black">
                    {r.pid}
                    {dupPids.has(r.pid) && <span className="ml-1 text-[10px] text-rose-300">重複</span>}
                  </td>
                  <td className="px-3 py-2">{SET_NAMES[r.set] ?? r.set}</td>
                  <td className="px-3 py-2 tabular-nums">{time(r.startedAt)}</td>
                  <td className="px-3 py-2">
                    {r.ended ? <span className="text-emerald-300 font-bold">終了</span> : <span>{r.rounds} / {ROUNDS} 周</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-white/30 text-xs">記録 {count} 件</p>
      </div>
    </PageShell>
  );
}
