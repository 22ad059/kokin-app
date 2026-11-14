// 合言葉ゲート：環境変数 APP_PASSCODE を知っている人だけがアプリを使えるようにする。
// クッキーには合言葉そのものではなくハッシュを保存する。

export const PASSCODE_COOKIE = 'kokin_pass';

export async function tokenFor(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`kokin-app:${passcode}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
