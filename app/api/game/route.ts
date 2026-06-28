import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { calculateScore } from '@/utils/scoreCalculator';
import { lookupTranslation, lookupEntry } from '@/lib/wordLoader';

export async function POST(req: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { theme, userWord, history, mode, charLimit, practiceWords } = await req.json();

  // ── 練習モード ──
  if (practiceWords && Array.isArray(practiceWords) && practiceWords.length > 0) {
    const usedLower = (history as string[]).map((h: string) => h.toLowerCase());
    const lower = userWord.toLowerCase();

    const inList = practiceWords.some((w: string) => w.toLowerCase() === lower);
    if (!inList || usedLower.includes(lower)) {
      return NextResponse.json({
        is_valid: false,
        reason: inList ? 'その単語はすでに使われています' : '練習リストに含まれていません',
        is_synonym: false, is_antonym: false, score: 0,
        jacet_level: 'Unknown', ai_jacet_level: 'Unknown',
        ai_response: '', user_word_jp: '', ai_response_jp: '',
      });
    }

    const remaining = practiceWords.filter((w: string) =>
      !usedLower.includes(w.toLowerCase()) && w.toLowerCase() !== lower
    );
    const prevWord = (history as string[])[history.length - 1] || '';

    try {
      let isSynonym = false;
      let isAntonym = false;
      let aiResponse = '';

      if (prevWord || remaining.length > 0) {
        const practicePrompt = `英単語ゲームの審判として判定してください。

ユーザーの単語: "${userWord}"
直前の単語: "${prevWord}"
残り使用可能な単語リスト: [${remaining.slice(0, 20).join(', ')}]

ルール:
- is_synonym: "${userWord}"が"${prevWord}"の類義語か（直前が空ならfalse）
- is_antonym: "${userWord}"が"${prevWord}"の対義語か（直前が空ならfalse、類義語と同時成立しない）
- ai_response: 残り使用可能な単語リストから1語を選んでください。リストが空なら空文字。

JSON形式のみで回答: {"is_synonym": boolean, "is_antonym": boolean, "ai_response": string}`;

        const aiRes = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: practicePrompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        });
        const aiData = JSON.parse(aiRes.choices[0].message.content || '{}');
        isSynonym = aiData.is_synonym ?? false;
        isAntonym = aiData.is_antonym ?? false;
        const aiWord = (aiData.ai_response || '').toLowerCase();
        const validAi = remaining.find((w: string) => w.toLowerCase() === aiWord);
        aiResponse = validAi ?? (remaining[0] ?? '');
      }

      const userEntry = lookupEntry(userWord);
      const jacetLevel = userEntry?.level ?? 'Unknown';
      const finalScore = calculateScore(jacetLevel, isSynonym, isAntonym);
      const aiEntry = aiResponse ? lookupEntry(aiResponse) : undefined;
      const aiJacetLevel = aiEntry?.level ?? 'Unknown';
      const userWordJp = lookupTranslation(userWord);
      const aiResponseJp = aiResponse ? lookupTranslation(aiResponse) : '';

      return NextResponse.json({
        is_valid: true, reason: '',
        is_synonym: isSynonym, is_antonym: isAntonym,
        ai_response: aiResponse, ai_response_jp: aiResponseJp,
        user_word_jp: userWordJp,
        jacet_level: jacetLevel, ai_jacet_level: aiJacetLevel,
        score: finalScore,
      });
    } catch (error) {
      console.error('OpenAI API Error (practice):', error);
      return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 });
    }
  }

  // ── 通常モード ──
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
    4. 直前の単語 "${history[history.length - 1] || ''}" の類義語（Synonym）ならボーナス対象とする。
    5. 直前の単語 "${history[history.length - 1] || ''}" の対義語（Antonym）ならボーナス対象とする。類義語と対義語が同時に成立することはない。

    【AIの挙動】
    - モードが "pvp" の場合: 判定のみを行い、ai_response は空文字にしてください。
    - モードが "solo" の場合: 合格なら、履歴にない新しい単語を一つ選び ai_response に入れてください。

    必ず以下のJSON形式でのみ回答してください：
    {
      "is_valid": boolean,
      "reason": "不合格の場合の理由（日本語）",
      "is_synonym": boolean,
      "is_antonym": boolean,
      "ai_response": "AIの回答（solo時のみ）",
      "ai_response_jp": "AI回答の日本語訳（Excelにない場合のfallback用）",
      "fun_fact": "ユーザーの単語に関する豆知識（英語）",
      "fun_fact_jp": "豆知識の日本語訳"
    }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const aiData = JSON.parse(response.choices[0].message.content || '{}');

    // JACET8000 からレベルを取得してスコア計算
    const userEntry = lookupEntry(userWord);
    const jacetLevel = userEntry?.level ?? 'Unknown';
    const finalScore = calculateScore(jacetLevel, aiData.is_synonym, aiData.is_antonym);

    // AI の返答のレベルも取得
    const aiEntry = aiData.ai_response ? lookupEntry(aiData.ai_response) : undefined;
    const aiJacetLevel = aiEntry?.level ?? 'Unknown';

    // 日本語訳（Excelから優先、なければAIのfallback）
    const userWordJp = lookupTranslation(userWord);
    const aiResponseJp = aiData.ai_response
      ? (lookupTranslation(aiData.ai_response) || aiData.ai_response_jp)
      : aiData.ai_response_jp;

    return NextResponse.json({
      ...aiData,
      jacet_level: jacetLevel,
      ai_jacet_level: aiJacetLevel,
      ai_response_jp: aiResponseJp,
      user_word_jp: userWordJp,
      score: finalScore,
    });

  } catch (error) {
    console.error("OpenAI API Error:", error);
    return NextResponse.json({ error: "AIとの通信に失敗しました" }, { status: 500 });
  }
}
