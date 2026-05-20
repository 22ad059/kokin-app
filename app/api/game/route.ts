import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { calculateScore } from '@/utils/scoreCalculator';

export async function POST(req: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // フロントエンドから送られてくるデータを取得
  const { theme, userWord, history, mode, charLimit } = await req.json();

  // AIへの命令書（プロンプト）の作成
  const prompt = `
    あなたは英単語ゲームの審判兼、対戦相手です。
    
    【現在の状況】
    - ゲームモード: ${mode === 'pvp' ? '対戦モード(PvP)' : '1人用モード(Solo)'}
    - テーマ: ${theme}
    - 履歴（使用済み単語）: [${history.join(', ')}]
    - ユーザーの入力: ${userWord}

    【判定ルール】
    1. "${userWord}" が英語の単語かどうか確認する。英語以外（日本語、数字、記号など）は即座に不合格。${charLimit !== null ? `\n    1b. "${userWord}" がちょうど ${charLimit} 文字かどうか確認する。文字数が異なる場合は不合格。` : ''}
    2. "${userWord}" がテーマ "${theme}" に沿っているか。
    3. "${userWord}" が履歴に含まれていないか（重複禁止）。
    4. 合格なら、"${userWord}" のCEFRレベル（A1, A2, B1, B2, C1, C2）を判定。
    5. 直前の単語 "${history[history.length - 1] || ''}" の類義語（Synonym）ならボーナス対象とする。
    6. 直前の単語 "${history[history.length - 1] || ''}" の対義語（Antonym）ならボーナス対象とする。類義語と対義語が同時に成立することはない。

    【AIの挙動】
    - モードが "pvp" の場合: 判定のみを行い、ai_response は空文字にしてください。
    - モードが "solo" の場合: 合格なら、履歴にない新しい単語を一つ選び ai_response に入れてください。

    必ず以下のJSON形式でのみ回答してください：
    {
      "is_valid": boolean,
      "reason": "不合格の場合の理由（日本語）",
      "cefr_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "is_synonym": boolean,
      "is_antonym": boolean,
      "ai_response": "AIの回答（solo時のみ）",
      "ai_response_jp": "AI回答の日本語訳",
      "fun_fact": "ユーザーの単語に関する豆知識（英語）",
      "fun_fact_jp": "豆知識の日本語訳"
    }
  `;

  try {
    // OpenAI APIを呼び出し
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3, // 判定の安定性を高めるために低めに設定
    });

    // AIの回答を解析
    const aiData = JSON.parse(response.choices[0].message.content || '{}');

    // 自作の計算機（utils）を使って最終スコアを算出
    // AIの判定したレベルと、類義語ボーナスの有無を渡す
    const finalScore = calculateScore(aiData.cefr_level, aiData.is_synonym, aiData.is_antonym);

    // フロントエンドにすべてのデータを返す
    return NextResponse.json({
      ...aiData,
      score: finalScore
    });

  } catch (error) {
    console.error("OpenAI API Error:", error);
    return NextResponse.json({ error: "AIとの通信に失敗しました" }, { status: 500 });
  }
}