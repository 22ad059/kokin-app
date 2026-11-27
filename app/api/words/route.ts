import { NextResponse } from 'next/server';
import { loadWords, lookupEntry, type WordEntry } from '@/lib/wordLoader';
import { EXPERIMENT_SETS } from '@/data/experimentSets';

export type { WordEntry };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const level = searchParams.get('level');
  const genre = searchParams.get('genre');
  const parsedLimit = parseInt(searchParams.get('limit') ?? '20', 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;

  const sort = searchParams.get('sort');
  const setId = searchParams.get('set');

  try {
    // 実験用の語セット: 定義された順のまま返す
    if (setId) {
      const set = Object.hasOwn(EXPERIMENT_SETS, setId) ? EXPERIMENT_SETS[setId] : undefined;
      if (!set) return NextResponse.json({ error: `語セット「${setId}」はありません` }, { status: 404 });
      const missing = set.words.filter(w => !lookupEntry(w));
      if (missing.length) {
        return NextResponse.json({ error: `単語データにない語があります: ${missing.join(', ')}` }, { status: 500 });
      }
      const words = set.words.map(w => lookupEntry(w)!);
      return NextResponse.json({ words, set: { id: setId, label: set.label, genre: set.genre } });
    }

    let words = loadWords();
    if (level) {
      const levels = level.split(',').map(l => l.trim()).filter(Boolean);
      if (levels.length) words = words.filter(w => levels.includes(w.level));
    }
    if (genre) {
      const genres = genre.split(',').map(g => g.trim()).filter(Boolean);
      if (genres.length) words = words.filter(w => genres.includes(w.genre));
    }

    let result: WordEntry[];
    if (sort === 'rank') {
      result = [...words].sort((a, b) => a.rank - b.rank);
    } else {
      // Fisher-Yates シャッフルからランダムに limit 件取る
      const shuffled = [...words];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      result = shuffled.slice(0, limit);
    }

    const genres = [...new Set(loadWords().map(w => w.genre))].filter(Boolean);
    const levels = [...new Set(loadWords().map(w => w.level))].filter(Boolean);

    return NextResponse.json({ words: result, genres, levels, total: words.length });
  } catch (error) {
    console.error('Failed to load words data:', error);
    return NextResponse.json(
      { error: '単語データの読み込みに失敗しました。Excelファイルがプロジェクト内にあるか確認してください。' },
      { status: 500 }
    );
  }
}
