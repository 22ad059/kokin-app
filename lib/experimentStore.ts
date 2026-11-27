/**
 * 実験記録の保存先（サーバー側だけで使う）。
 * 本番（Cloudflare Workers）では Durable Object の EXPERIMENT_LOG に保存する。
 * next dev では Durable Object が使えないので、開発中だけメモリに置く（サーバーを止めると消える）。
 */
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { ExperimentRecord } from '@/lib/experiment';

/* eslint-disable @typescript-eslint/no-explicit-any */

const isProd = process.env.NODE_ENV === 'production';
const g = globalThis as any;
const devMemory: Map<string, ExperimentRecord> = (g.__experimentDevMemory ??= new Map());

async function logStub(): Promise<any | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const ns = (env as any).EXPERIMENT_LOG;
    return ns ? ns.get(ns.idFromName('main')) : null;
  } catch {
    return null;
  }
}

export async function appendRecords(records: ExperimentRecord[]): Promise<void> {
  const stub = await logStub();
  if (stub) {
    try {
      const res = await stub.fetch('https://experiment-log/append', { method: 'POST', body: JSON.stringify(records) });
      if (res.ok) return;
      throw new Error(`保存に失敗しました（${res.status}）`);
    } catch (e) {
      if (isProd) throw e;
    }
  } else if (isProd) {
    throw new Error('EXPERIMENT_LOG が設定されていません');
  }
  for (const r of records) devMemory.set(r.id, r);
}

export async function allRecords(): Promise<ExperimentRecord[]> {
  const stub = await logStub();
  if (stub) {
    try {
      const res = await stub.fetch('https://experiment-log/all');
      if (res.ok) return (await res.json()) as ExperimentRecord[];
      throw new Error(`読み込みに失敗しました（${res.status}）`);
    } catch (e) {
      if (isProd) throw e;
    }
  } else if (isProd) {
    throw new Error('EXPERIMENT_LOG が設定されていません');
  }
  return [...devMemory.values()];
}
