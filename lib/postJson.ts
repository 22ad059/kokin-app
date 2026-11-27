/**
 * JSON を POST して、返ってきた JSON を読む。通信が切れた・応答が JSON でない・
 * サーバーが 502〜504 を返した、といった一時的な失敗は、少し待って自動で送り直す。
 * （端末がしばらく操作されずに通信が途切れた直後の 1 回目などで起きやすい）
 *
 * 戻り値の data は、最後まで読めなかったときは null。
 */
export async function postJson(
  url: string,
  body: unknown,
  { retries = 2, timeoutMs = 30_000 }: { retries?: number; timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; data: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let last = { ok: false, status: 0, data: null };
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 800 * attempt));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      let data = null;
      try { data = await res.json(); } catch { /* JSON でない応答（エラーページなど） */ }
      last = { ok: res.ok, status: res.status, data };
      const transient = data === null || res.status === 502 || res.status === 503 || res.status === 504;
      if (!transient) return last;
    } catch {
      last = { ok: false, status: 0, data: null };
    } finally {
      clearTimeout(timer);
    }
  }
  return last;
}
