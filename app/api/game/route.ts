import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { calculateScore } from '@/utils/scoreCalculator';
import { lookupTranslation, lookupEntry, loadWords } from '@/lib/wordLoader';
import { sameWord, baseWord, altWords, oneEditApart } from '@/lib/wordMatch';

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

/**
 * 辞書にない入力が、1文字違いの単語のつづり間違いと思われるとき、その単語を返す。
 * 選んだリストのまだ出ていない単語 → 選んだジャンルの単語 → そのほかの単語 の順で探す。
 * 短い単語（4文字未満）は別の単語と取り違えやすいので直さない。
 */
function findSpellingFix(
  typed: string,
  practiceWords: string[],
  genres: string[],
  history: string[],
  sameEntry: (a: string, b: string) => boolean,
): string | null {
  const t = typed.toLowerCase();
  if (t.length < 4) return null;
  const keys = (w: string) => [baseWord(w), ...altWords(w)];
  const near = (w: string) => keys(w).some(k => k.length >= 4 && oneEditApart(t, k));
  const unused = (w: string) => !history.some(h => sameEntry(h, w));
  // 直した後の形（括弧の別の言い方に近ければそちら）
  const shape = (w: string) => keys(w).find(k => k.length >= 4 && oneEditApart(t, k)) ?? baseWord(w);

  const inList = practiceWords.filter(w => near(w) && unused(w));
  if (inList.length) return shape(inList[0]);
  const all = loadWords().filter(w => near(w.word));
  const inGenre = all.filter(w => genres.includes(w.genre));
  const best = inGenre.find(w => unused(w.word)) ?? inGenre[0] ?? all.find(w => unused(w.word)) ?? all[0];
  return best ? shape(best.word) : null;
}

/**
 * 対戦の「つづり1文字OK」: 辞書にない入力に 1 文字違いの辞書の単語があれば、いちばんよく使われる語を返す。
 * まだ出ていない語・文字数制限に合う語だけ。短い単語（4文字未満）は取り違えやすいので直さない。
 */
function findBattleSpellingFix(typed: string, history: string[], charLimit: unknown): { word: string; used: boolean } | null {
  const t = typed.toLowerCase();
  if (t.length < 4) return null;
  const used = (w: string) => history.some(h => sameWord(h, w));
  const cands = loadWords()
    .flatMap(e => [baseWord(e.word), ...altWords(e.word)].map(k => ({ k, rank: e.rank })))
    .filter(({ k }) => k.length >= 4 && /^[a-z]+$/.test(k) && oneEditApart(t, k))
    .filter(({ k }) => typeof charLimit !== 'number' || k.length === charLimit)
    .sort((a, b) => a.rank - b.rank);
  const fresh = cands.find(c => !used(c.k));
  if (fresh) return { word: fresh.k, used: false };
  // まだ出ていない候補がなく、出た単語のつづり違いと思われるとき
  return cands[0] ? { word: cands[0].k, used: true } : null;
}

const LEVEL_RE = /^Level [1-8]$/;
const toLevel = (est: unknown): string | null => {
  const n = Number(est);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? `Level ${n}` : null;
};
const pick = <T,>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)];

/**
 * 練習ゲーム（ジャンル判定版）
 * - 合否: 選んだジャンルに合う英単語なら合格（リスト外・選んだレベル外の単語でもよい）
 * - AI の返し: プレイヤーの単語が選んだレベル内なら、選んだリストの残りから 1 語。
 *   選んだレベル外なら、プレイヤーの単語と同じレベル・選んだジャンルの単語から 1 語。
 */
async function handleGenrePractice(
  openai: OpenAI,
  userWord: string,
  history: string[],
  practiceWords: string[],
  genres: string[],
  levels: string[],
  /** 実験用の固定語セット: AI は常に選んだリストの残りから返す */
  fixed = false,
  /** つづりの1文字違いを直して認めるか（オンラインの競争で「直さない」を選べる） */
  allowSpellFix = true,
) {
  const invalid = (reason: string) => NextResponse.json({
    is_valid: false, reason,
    is_synonym: false, is_antonym: false, score: 0,
    jacet_level: 'Unknown', ai_jacet_level: 'Unknown',
    ai_response: '', user_word_jp: '', ai_response_jp: '',
  });

  const typed = userWord.trim();
  if (!/^[a-zA-Z][a-zA-Z' -]*$/.test(typed)) return invalid('英単語を入力してください');
  // 辞書の見出し語を通して照合する（doctor の後の doc なども同じ語として扱う）
  const canon = (w: string) => lookupEntry(w)?.word ?? w;
  const sameEntry = (a: string, b: string) => sameWord(canon(a), canon(b));

  // つづりの1文字違いは、近い単語に直して認める（得点は半分）
  let word = typed;
  let corrected = false;
  if (allowSpellFix && !lookupEntry(typed)) {
    const fix = findSpellingFix(typed, practiceWords, genres, history, sameEntry);
    if (fix) { word = fix; corrected = true; }
  }
  if (history.some(h => sameEntry(h, word))) {
    return invalid(corrected ? `「${word}」のつづりだと思われますが、その単語はすでに使われています` : 'その単語はすでに使われています');
  }

  const entry = lookupEntry(word);
  const dictGenreMatches = !!entry && genres.includes(entry.genre);
  const prevWord = history[history.length - 1] || '';

  const prompt = `英単語ゲームの審判として判定してください。

選ばれたジャンル: ${genres.map(g => `「${g}」`).join('、')}
ユーザーの単語: "${word}"
直前の単語: "${prevWord}"${entry ? `\n参考: 辞書（JACET8000）での分類は「${entry.genre}」、意味は「${entry.translation}」` : ''}

判定項目:
- is_english: "${word}" が実在する英単語か（つづりの誤りや英語以外は false）
- fits_genre: "${word}" の意味が選ばれたジャンルのどれかに当てはまるか。${dictGenreMatches ? '辞書の分類が選ばれたジャンルに含まれるので true にすること。' : 'ジャンルの話題に自然に含まれる単語なら true。無関係なら false。'}
- reason: 不合格のときの理由（日本語・短く）
- level_estimate: 難易度を JACET8000 基準で 1〜8 の整数で推定（1=中学基礎、4=大学受験、8=最難関）
- translation: "${word}" の日本語訳（短く）
- is_synonym: 直前の単語の類義語か（直前が空なら false）
- is_antonym: 直前の単語の対義語か（直前が空なら false、類義語と同時に true にしない）

JSON形式のみで回答: {"is_english": boolean, "fits_genre": boolean, "reason": string, "level_estimate": number, "translation": string, "is_synonym": boolean, "is_antonym": boolean}`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });
  const ai = JSON.parse(res.choices[0].message.content || '{}');

  if (!entry && ai.is_english === false) return invalid(ai.reason || '英単語として認められません');
  if (!dictGenreMatches && ai.fits_genre !== true) {
    return invalid(ai.reason || `選んだジャンル（${genres.join('・')}）に合っていません`);
  }

  // ユーザーの単語のレベル（辞書優先、なければ AI の推定）
  let jacetLevel = entry?.level ?? 'Unknown';
  let levelEstimated = false;
  if (!entry) {
    const est = toLevel(ai.level_estimate);
    if (est) { jacetLevel = est; levelEstimated = true; }
  }
  const isSynonym = !!prevWord && ai.is_synonym === true;
  const isAntonym = !!prevWord && !isSynonym && ai.is_antonym === true;

  // AI の返し
  // 括弧つきの見出し語（例: doctor (doc)）も、本体や別の言い方で出されたら使用済みとみなす
  const usedAfter = [...history, word];
  const isUsed = (w: string) => usedAfter.some(h => sameEntry(h, w));
  let aiResponse = '';
  if (fixed || levels.includes(jacetLevel)) {
    aiResponse = pick(practiceWords.filter(w => !isUsed(w))) ?? '';
  } else if (LEVEL_RE.test(jacetLevel)) {
    const pool = loadWords()
      .filter(w => w.level === jacetLevel && genres.includes(w.genre) && !isUsed(w.word))
      .map(w => w.word);
    aiResponse = pick(pool) ?? '';
  }
  // 同じレベルの単語が残っていないなど、返せないときは選んだリストの残りから返す
  if (!aiResponse) aiResponse = pick(practiceWords.filter(w => !isUsed(w))) ?? '';

  const aiEntry = aiResponse ? lookupEntry(aiResponse) : undefined;
  return NextResponse.json({
    is_valid: true, reason: '',
    is_synonym: isSynonym, is_antonym: isAntonym,
    jacet_level: jacetLevel, level_estimated: levelEstimated,
    score: corrected ? Math.floor(calculateScore(jacetLevel, isSynonym, isAntonym) / 2) : calculateScore(jacetLevel, isSynonym, isAntonym),
    // つづりを直したとき: 直した単語と、入力されたつづり
    corrected_word: corrected ? word : undefined,
    typed_word: corrected ? typed : undefined,
    user_word_jp: entry?.translation || lookupTranslation(word) || String(ai.translation ?? ''),
    ai_response: aiResponse,
    ai_jacet_level: aiEntry?.level ?? 'Unknown',
    ai_response_jp: aiResponse ? lookupTranslation(aiResponse) : '',
  });
}

export async function POST(req: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { theme, themeDefinition, userWord, history, mode, charLimit: rawCharLimit, posLimit, spellTrap, practiceWords, practiceGenres, practiceLevels, practiceFixed, spellFix } = await req.json();
  // 文字数制限は数値のときだけ使う（送られてこなかったときに「undefined 文字」と判定させないように）
  const charLimit: number | null = typeof rawCharLimit === 'number' ? rawCharLimit : null;

  if (typeof userWord !== 'string' || !userWord.trim() || !Array.isArray(history)) {
    return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 });
  }

  // ── 練習ゲーム（ジャンル判定版） ──
  if (Array.isArray(practiceWords) && Array.isArray(practiceGenres) && practiceGenres.length > 0) {
    try {
      return await handleGenrePractice(
        openai, userWord, history as string[],
        (practiceWords as unknown[]).map(String), (practiceGenres as unknown[]).map(String),
        Array.isArray(practiceLevels) ? (practiceLevels as unknown[]).map(String) : [],
        practiceFixed === true,
        // 送られてこなければ直す（ひとり練習・実験ページはこれまでどおり）
        spellFix !== false,
      );
    } catch (error) {
      console.error('OpenAI API Error (genre practice):', error);
      return NextResponse.json({ error: 'AIとの通信に失敗しました' }, { status: 500 });
    }
  }

  // ── 練習モード（単語学習から選んだリストだけで遊ぶ） ──
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
  const dictPosOf = (w: string) => (posLimit ? (lookupEntry(w)?.pos ?? '') : '');

  const promptFor = (w: string) => {
    const dictPos = dictPosOf(w);
    return `
    あなたは英単語ゲームの審判兼、対戦相手です。

    【現在の状況】
    - ゲームモード: ${mode === 'pvp' ? '対戦モード(PvP)' : '1人用モード(Solo)'}
    - テーマ: ${theme}${themeDefinition ? `\n    - お題の定義: ${themeDefinition}` : ''}${posLimit ? `\n    - 品詞制限: 「${posLimit}」の単語のみ使用可` : ''}${charLimit !== null ? `\n    - 文字数制限: ちょうど ${charLimit} 文字` : ''}
    - 履歴（使用済み単語）: [${history.join(', ')}]
    - ユーザーの入力: ${w}

    【判定ルール】
    1. "${w}" が英語の単語かどうか確認する。英語以外（日本語、数字、記号など）は即座に不合格。${charLimit !== null ? `\n    1b. "${w}" がちょうど ${charLimit} 文字かどうか確認する。文字数が異なる場合は不合格。` : ''}${posLimit ? `\n    1c. 【重要】"${w}" に「${posLimit}」としての用法が英語の辞書上1つでもあるか確認する。用法があれば合格とし pos に「${posLimit}」と記入する（例: water は主に名詞だが「水をやる」という動詞用法があるので動詞制限でも合格）。まったく用法がない場合のみ不合格。${dictPos && dictPos !== posLimit ? `参考: JACET8000辞書の主な品詞は「${dictPos}」だが、「${posLimit}」の用法が別にあれば合格としてよい。` : dictPos ? `参考: JACET8000辞書でも品詞は「${dictPos}」。` : ''}` : ''}
    2. 【最重要・古今東西ゲームのルール】"${w}" が「${theme}」というカテゴリに属する具体例（実例・メンバー）かどうかを判定する。${themeDefinition ? `\n       お題の定義「${themeDefinition}」に照らして判定すること。` : ''}
       テーマに関連・連想されるだけでカテゴリの実例ではない単語は不合格。
       例: テーマが ANIMAL の場合 → dog は合格（動物の実例）／ zoo は不合格（関連するが動物ではない）／ cute は不合格（連想語）。
    3. "${w}" が履歴に含まれていないか（重複禁止）。
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
  };

  // 1 語を AI に判定させる（品詞制限は辞書でも二重チェックする）
  const judge = async (w: string) => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: promptFor(w) }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const d = JSON.parse(response.choices[0].message.content || '{}');
    // 品詞制限の二重チェック: AI判定と辞書のどちらも制限品詞に一致しない場合は不合格にする
    // （aiPos は「水をやる」のような別品詞の用法も含めて判定させているため includes で照合する）
    const dictPos = dictPosOf(w);
    if (posLimit && d.is_valid) {
      const aiPos = String(d.pos ?? '');
      if (!aiPos.includes(posLimit) && dictPos !== posLimit && (aiPos || dictPos)) {
        d.is_valid = false;
        d.reason = `「${w}」は${posLimit}ではありません（品詞: ${dictPos || aiPos}）`;
      }
    }
    return d;
  };

  try {
    let word = String(userWord).trim();
    let aiData = await judge(word);

    // つづり1文字OK: 不合格で辞書にない入力なら、1文字違いの辞書の単語で判定し直す（得点は半分）
    let corrected = false;
    if (spellFix && !aiData.is_valid && !lookupEntry(word)) {
      const fix = findBattleSpellingFix(word, history as string[], charLimit);
      if (fix?.used) {
        aiData.reason = `「${fix.word}」のつづりだと思われますが、その単語はすでに使われています`;
      } else if (fix) {
        const again = await judge(fix.word);
        if (again.is_valid) { aiData = again; word = fix.word; corrected = true; }
      }
    }

    // JACET8000 からレベルを取得してスコア計算（リスト外の単語はAIの推定レベルで代用）

    const userEntry = lookupEntry(word);
    let jacetLevel = userEntry?.level ?? 'Unknown';
    let levelEstimated = false;
    if (jacetLevel === 'Unknown') {
      const est = toLevel(aiData.user_level_estimate);
      if (est) { jacetLevel = est; levelEstimated = true; }
    }
    const fullScore = calculateScore(jacetLevel, aiData.is_synonym, aiData.is_antonym);
    const finalScore = corrected ? Math.floor(fullScore / 2) : fullScore;

    // AI の返答のレベルも取得（同様にリスト外は推定）
    const aiEntry = aiData.ai_response ? lookupEntry(aiData.ai_response) : undefined;
    let aiJacetLevel = aiEntry?.level ?? 'Unknown';
    let aiLevelEstimated = false;
    if (aiData.ai_response && aiJacetLevel === 'Unknown') {
      const est = toLevel(aiData.ai_level_estimate);
      if (est) { aiJacetLevel = est; aiLevelEstimated = true; }
    }

    // 日本語訳（Excelから優先、なければAIのfallback）
    const userWordJp = lookupTranslation(word);
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
      // つづりを直したとき: 直した単語と、入力されたつづり
      corrected_word: corrected ? word : undefined,
      typed_word: corrected ? String(userWord).trim() : undefined,
    });

  } catch (error) {
    console.error("OpenAI API Error:", error);
    return NextResponse.json({ error: "AIとの通信に失敗しました" }, { status: 500 });
  }
}
