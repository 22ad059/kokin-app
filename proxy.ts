import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PASSCODE_COOKIE, tokenFor } from './lib/passcode';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const passcode = process.env.APP_PASSCODE;

  if (!passcode) {
    // ローカル開発では合言葉なしで使える。本番で未設定なら誰にも使わせない。
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    return new NextResponse('APP_PASSCODE が設定されていません。', { status: 503 });
  }

  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next();

  const cookie = request.cookies.get(PASSCODE_COOKIE)?.value;
  if (cookie && cookie === (await tokenFor(passcode))) return NextResponse.next();

  if (isApi) {
    return NextResponse.json({ error: '合言葉の入力が必要です' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
