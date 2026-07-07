import OpenAI from 'openai';
import { NextResponse } from 'next/server';

/**
 * ゲーム開始時にお題（テーマ）の定義を1回だけ生成する。
 * 以降の /api/game の判定に毎回渡すことで、ゲーム中の判定基準のブレをなくす。
 */
export async function POST(req: Request) {
  const { theme } = await req.json();

  if (typeof theme !== 'string' || !theme.trim()) {
    return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `英単語版「古今東西ゲーム」のお題を定義してください。

お題: "${theme.trim()}"

このお題で合格となる英単語の範囲を、審判が一貫して判定できるように1〜2文の日本語で定義してください。
「〜の名前」というカテゴリ形式で書き、カテゴリに属する実例だけが合格で、
関連語・連想語は不合格になることが分かるようにすること。

例: お題 "OCEAN" → 「海に生息する生き物や、海にある自然物・現象の名前（shark, wave, coral など）。海を連想させるだけの単語（vacation, ship の乗客 など）は不合格。」

JSON形式のみで回答: {"definition": string}`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const data = JSON.parse(res.choices[0].message.content || '{}');
    return NextResponse.json({
      definition: typeof data.definition === 'string' ? data.definition : '',
    });
  } catch (error) {
    // 定義が作れなくてもゲーム開始は妨げない（定義なしで判定する）
    console.error('OpenAI API Error (theme):', error);
    return NextResponse.json({ definition: '' });
  }
}
