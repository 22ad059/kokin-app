import { NextResponse } from 'next/server';
import { PASSCODE_COOKIE, tokenFor } from '@/lib/passcode';

export async function POST(req: Request) {
  const expected = process.env.APP_PASSCODE;
  const body = await req.json().catch(() => null);
  const input = typeof body?.passcode === 'string' ? body.passcode.trim() : '';

  if (!expected || input !== expected) {
    // 総当たりを遅くする
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PASSCODE_COOKIE, await tokenFor(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
