/**
 * 効果検証実験の記録を保存する Durable Object。アプリ全体で 1 つだけ使う（名前 'main'）。
 *
 * - POST /append : 記録の配列を受け取り、記録 ID ごとに保存する（同じ ID の再送は上書き＝重複しない）
 * - GET  /all    : 保存した記録をすべて返す
 *
 * Next.js 側の app/api/experiment/route.ts から呼ばれる。
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Workers の実行環境が用意するモジュール
import { DurableObject } from 'cloudflare:workers';

/* eslint-disable @typescript-eslint/no-explicit-any */

const PREFIX = 'log:';
/** storage.put にまとめて渡せるキーの上限は 128 */
const CHUNK = 100;

export class ExperimentLog extends DurableObject {
  declare ctx: any;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/append') {
      let records: unknown;
      try { records = await request.json(); } catch { return new Response('JSON ではありません', { status: 400 }); }
      if (!Array.isArray(records)) return new Response('配列を送ってください', { status: 400 });
      const entries: [string, unknown][] = [];
      for (const r of records) {
        if (r && typeof r === 'object' && typeof (r as any).id === 'string') entries.push([PREFIX + (r as any).id, r]);
      }
      for (let i = 0; i < entries.length; i += CHUNK) {
        await this.ctx.storage.put(Object.fromEntries(entries.slice(i, i + CHUNK)));
      }
      return Response.json({ saved: entries.length });
    }

    if (request.method === 'GET' && url.pathname === '/all') {
      const map: Map<string, unknown> = await this.ctx.storage.list({ prefix: PREFIX });
      return Response.json([...map.values()]);
    }

    return new Response('Not found', { status: 404 });
  }
}
