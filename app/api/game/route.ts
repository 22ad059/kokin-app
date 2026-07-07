import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { calculateScore } from '@/utils/scoreCalculator';
import { lookupTranslation, lookupEntry } from '@/lib/wordLoader';

/**
 * スペルチェックモード用: 単語にそれらしいタイポを1つ仕込む。
 * 生成できない場合は null を返す。
 */
function makeTypo(word: string): string | null {
  const w = word.toLowerCase();
  if (w.length < 3 || !/^[a-z]+$/.test(w)) return null;

  const VOWELS = 'aeiou';
  const ops: (() => string)[] = [
    // 隣接する2文字の入れ替え（先頭以外）
    () => {
      const i = 1 + Math.floor(Math.random() * (w.length - 2));
      return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
    },
    // 1文字削除（先頭以外・短い単語では不自然になるため4文字以上のみ）
    () => {
      if (w.length < 4) return w;
      const i = 1 + Math.floor(Math.random() * (w.length - 1));
      return w.slice(0, i) + w.slice(i + 1);
    },
    // 1文字重複
    () => {
      const i = 1 + Math.floor(Math.random() * (w.length - 1));
      return w.slice(0, i) + w[i] + w.slice(i);
    },
    // 母音を別の母音に置換（先頭以外）
    () => {
      const idxs = [...w].map((c, i) => (i > 0 && VOWELS.includes(c) ? i : -1)).filter(i => i >= 0);
      if (idxs.length === 0) return w;
      const i = idxs[Math.floor(Math.random() * idxs.length)];
      const others = VOWELS.replace(w[i], '');
      return w.slice(0, i) + others[Math.floor(Math.random() * others.length)] + w.slice(i + 1);
    },
  ];

  for (let attempt = 0; attempt < 8; attempt++) {
    const typo = ops[Math.floor(Math.random() * ops.length)]();
    // 偶然実在する単語（JACET8000に載っている語）になったら作り直す
    if (typo !== w && typo.length >= 2 && !lookupEntry(typo)) return typo;
  }
  return null;
}

export async function POST(req: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { theme, themeDefinition, userWord, history, mode, charLimit, posLimit, spellTrap, practiceWords } = await req.json();

  if (typeof userWord !== 'string' || !userWord.trim() || !Array.isArray(history)) {
    return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 });
  }

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
  // 品詞制限用: JACET8000 辞書の品詞（参考情報としてプロンプトに渡し、判定の二重チェックにも使う）
  const dictPos = posLimit ? (lookupEntry(userWord)?.pos ?? '') : '';

  const prompt = `
    あなたは英単語ゲームの審判兼、対戦相手です。

    【現在の状況】
    - ゲームモード: ${mode === 'pvp' ? '対戦モード(PvP)' : '1人用モード(Solo)'}
    - テーマ: ${theme}${themeDefinition ? `\n    - お題の定義: ${themeDefinition}` : ''}${posLimit ? `\n    - 品詞制限: 「${posLimit}」の単語のみ使用可` : ''}${charLimit !== null ? `\n    - 文字数制限: ちょうど ${charLimit} 文字` : ''}
    - 履歴（使用済み単語）: [${history.join(', ')}]
    - ユーザーの入力: ${userWord}

    【判定ルール】
    1. "${userWord}" が英語の単語かどうか確認する。英語以外（日本語、数字、記号など）は即座に不合格。${charLimit !== null ? `\n    1b. "${userWord}" がちょうど ${charLimit} 文字かどうか確認する。文字数が異なる場合は不合格。` : ''}${posLimit ? `\n    1c. 【重要】"${userWord}" に「${posLimit}」としての用法が英語の辞書上1つでもあるか確認する。用法があれば合格とし pos に「${posLimit}」と記入する（例: water は主に名詞だが「水をやる」という動詞用法があるので動詞制限でも合格）。まったく用法がない場合のみ不合格。${dictPos && dictPos !== posLimit ? `参考: JACET8000辞書の主な品詞は「${dictPos}」だが、「${posLimit}」の用法が別にあれば合格としてよい。` : dictPos ? `参考: JACET8000辞書でも品詞は「${dictPos}」。` : ''}` : ''}
    2. 【最重要・古今東西ゲームのルール】"${userWord}" が「${theme}」というカテゴリに属する具体例（実例・メンバー）かどうかを判定する。${themeDefinition ? `\n       お題の定義「${themeDefinition}」に照らして判定すること。` : ''}
       テーマに関連・連想されるだけでカテゴリの実例ではない単語は不合格。
       例: テーマが ANIMAL の場合 → dog は合格（動物の実例）／ zoo は不合格（関連するが動物ではない）／ cute は不合格（連想語）。
    3. "${userWord}" が履歴に含まれていないか（重複禁止）。
    4. 直前の単語 "${history[history.length - 1] || ''}" の類義語（Synonym）ならボーナス対象とする。
    5. 直前の単語 "${history[history.length - 1] || ''}" の対義語（Antonym）ならボーナス対象とする。類義語と対義語が同時に成立することはない。

    【AIの挙動】
    - モードが "pvp" の場合: 判定のみを行い、ai_response は空文字にしてください。
    - モードが "solo" の場合: 合格なら、履歴にない新しい単語を一つ選び ai_response に入れてください。ai_response もテーマの実例${charLimit !== null ? `・文字数制限（${charLimit}文字）` : ''}${posLimit ? `・品詞制限（${posLimit}）` : ''}であること。

    必ず以下のJSON形式でのみ回答してください：
    {
      "is_valid": boolean,
      "reason": "不合格の場合の理由（日本語）",
      "pos": "${posLimit ? `ユーザーの単語の品詞。「${posLimit}」としての用法がある場合は「${posLimit}」と書き、ない場合は主な品詞を書く` : 'ユーザーの単語の主な品詞'}（名詞/動詞/形容詞/副詞/その他 のいずれか）",
      "user_level_estimate": ユーザーの単語の難易度をJACET8000基準で1〜8の整数で推定（1=中学基礎レベル、4=大学受験レベル、8=最難関・専門レベル）,
      "ai_level_estimate": ai_responseの単語の難易度を同じ基準で1〜8の整数で推定（solo時のみ、pvpなら0）,
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

    // 品詞制限の二重チェック: AI判定と辞書のどちらも制限品詞に一致しない場合は不合格にする
    // （aiPos は「水をやる」のような別品詞の用法も含めて判定させているため includes で照合する）
    if (posLimit && aiData.is_valid) {
      const aiPos = String(aiData.pos ?? '');
      if (!aiPos.includes(posLimit) && dictPos !== posLimit && (aiPos || dictPos)) {
        aiData.is_valid = false;
        aiData.reason = `「${userWord}」は${posLimit}ではありません（品詞: ${dictPos || aiPos}）`;
      }
    }

    // JACET8000 からレベルを取得してスコア計算（リスト外の単語はAIの推定レベルで代用）
    const toLevel = (est: unknown): string | null => {
      const n = Number(est);
      return Number.isInteger(n) && n >= 1 && n <= 8 ? `Level ${n}` : null;
    };

    const userEntry = lookupEntry(userWord);
    let jacetLevel = userEntry?.level ?? 'Unknown';
    let levelEstimated = false;
    if (jacetLevel === 'Unknown') {
      const est = toLevel(aiData.user_level_estimate);
      if (est) { jacetLevel = est; levelEstimated = true; }
    }
    const finalScore = calculateScore(jacetLevel, aiData.is_synonym, aiData.is_antonym);

    // AI の返答のレベルも取得（同様にリスト外は推定）
    const aiEntry = aiData.ai_response ? lookupEntry(aiData.ai_response) : undefined;
    let aiJacetLevel = aiEntry?.level ?? 'Unknown';
    let aiLevelEstimated = false;
    if (aiData.ai_response && aiJacetLevel === 'Unknown') {
      const est = toLevel(aiData.ai_level_estimate);
      if (est) { aiJacetLevel = est; aiLevelEstimated = true; }
    }

    // 日本語訳（Excelから優先、なければAIのfallback）
    const userWordJp = lookupTranslation(userWord);
    const aiResponseJp = aiData.ai_response
      ? (lookupTranslation(aiData.ai_response) || aiData.ai_response_jp)
      : aiData.ai_response_jp;

    // スペルチェックモード: ソロのAI返答に約35%の確率でタイポを仕込む
    // （レベル・日本語訳は正しい単語で引いてあるので表示はそのまま使える）
    let aiDisplayWord = aiData.ai_response || '';
    let aiMisspelled = false;
    if (spellTrap && mode === 'solo' && aiData.is_valid && aiDisplayWord && Math.random() < 0.35) {
      const typo = makeTypo(aiDisplayWord);
      if (typo) {
        aiDisplayWord = typo;
        aiMisspelled = true;
      }
    }

    return NextResponse.json({
      ...aiData,
      ai_response: aiDisplayWord,
      ai_correct_word: aiData.ai_response || '',
      ai_misspelled: aiMisspelled,
      jacet_level: jacetLevel,
      level_estimated: levelEstimated,
      ai_jacet_level: aiJacetLevel,
      ai_level_estimated: aiLevelEstimated,
      ai_response_jp: aiResponseJp,
      user_word_jp: userWordJp,
      score: finalScore,
    });

  } catch (error) {
    console.error("OpenAI API Error:", error);
    return NextResponse.json({ error: "AIとの通信に失敗しました" }, { status: 500 });
  }
}
