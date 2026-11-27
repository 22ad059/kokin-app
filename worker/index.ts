/**
 * Cloudflare Workers の入り口。
 * - /ws/room/<部屋コード> : オンライン対戦の WebSocket 接続を、部屋サーバー（GameRoom）へ渡す
 * - それ以外             : OpenNext が生成した Next.js アプリにそのまま渡す
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` はビルド時に生成される
import { default as nextHandler } from '../.open-next/worker.js';
import { GameRoom } from './GameRoom';
import { ExperimentLog } from './ExperimentLog';
import { PASSCODE_COOKIE, tokenFor } from '../lib/passcode';
import { ROOM_CODE_RE } from '../lib/online';

export { GameRoom, ExperimentLog };

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/ws/room/')) {
      const code = url.pathname.slice('/ws/room/'.length);
      if (!ROOM_CODE_RE.test(code)) return new Response('部屋コードが正しくありません', { status: 400 });
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('WebSocket で接続してください', { status: 426 });
      }
      // 合言葉を入れた人だけが部屋に入れる（Next.js 側の proxy.ts と同じ確認）
      if (env.APP_PASSCODE) {
        if (readCookie(request, PASSCODE_COOKIE) !== (await tokenFor(env.APP_PASSCODE))) {
          return new Response('合言葉の入力が必要です', { status: 401 });
        }
      }
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
      return stub.fetch(request);
    }
    return nextHandler.fetch(request, env, ctx);
  },
};
