import { NextResponse } from 'next/server';
import { loadWords, type WordEntry } from '@/lib/wordLoader';

export type { WordEntry };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const level = searchParams.get('level');
  const genre = searchParams.get('genre');
  const limit = parseInt(searchParams.get('limit') ?? '20');

  const sort = searchParams.get('sort');

  try {
    let words = loadWords();
    if (level) {
      const levels = level.split(',').map(l => l.trim()).filter(Boolean);
      if (levels.length) words = words.filter(w => levels.includes(w.level));
    }
    if (genre) {
      const genres = genre.split(',').map(g => g.trim()).filter(Boolean);
      if (genres.length) words = words.filter(w => genres.includes(w.genre));
    }

    const result = sort === 'rank'
      ? [...words].sort((a, b) => a.rank - b.rank)
      : [...words].sort(() => Math.random() - 0.5).slice(0, limit);

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
