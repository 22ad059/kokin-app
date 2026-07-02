'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { WordEntry, PracticeMessage } from '@/types/study';
import PageShell from '@/components/study/PageShell';
import LevelSelector from '@/components/study/LevelSelector';
import GenreSelector from '@/components/study/GenreSelector';
import PracticeGame from '@/components/study/PracticeGame';

type Phase = 'setup' | 'game';

export default function PracticePage() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [selectedLevels, setSelectedLevels] = useState<string[]>(['Level 1', 'Level 2']);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [wordList, setWordList] = useState<WordEntry[]>([]);
  const [history, setHistory] = useState<PracticeMessage[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');
  const [gameLoading, setGameLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [gameError, setGameError] = useState('');

  useEffect(() => {
    fetch('/api/words?limit=1')
      .then(r => r.json())
      .then(d => {
        const all: string[] = d.genres ?? [];
        const sorted = [...all.filter(g => g !== 'その他'), ...all.filter(g => g === 'その他')];
        setAllGenres(sorted);
        setSelectedGenres(prev => prev.length ? prev : sorted.slice(0, 1));
      })
      .catch(() => {});
  }, []);

  const canStart = selectedLevels.length > 0 && selectedGenres.length > 0 && !loading;

  const startPractice = useCallback(async () => {
    if (!canStart) return;
    setSetupError('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('level', selectedLevels.join(','));
      params.set('genre', selectedGenres.join(','));
      params.set('sort', 'rank');
      const res = await fetch(`/api/words?${params}`);
      const data = await res.json();
      const words: WordEntry[] = data.words ?? [];
      if (words.length === 0) { setSetupError('該当する単語がありません。レベルやジャンルを変えてください。'); return; }
      setWordList(words);
      setHistory([]);
      setScore(0);
      setGameOver(false);
      setGameOverReason('');
      setGameError('');
      setPhase('game');
    } catch {
      setSetupError('通信エラーが発生しました。もう一度お試しください。');
    } finally { setLoading(false); }
  }, [canStart, selectedLevels, selectedGenres]);

  const playWord = useCallback(async (word: string) => {
    if (gameLoading || gameOver) return;
    setGameError('');
    setGameLoading(true);
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWord: word,
          history: history.map(h => h.word),
          mode: 'solo',
          practiceWords: wordList.map(w => w.word),
        }),
      });
      const data = await res.json();
      if (!data.is_valid) { setGameError(data.reason || 'その単語は使えません。'); setGameLoading(false); return; }

      const newEntries: PracticeMessage[] = [
        {
          word,
          translation: data.is_synonym ? '🔥 類義語ボーナス x2!' : data.is_antonym ? '❄️ 対義語ボーナス x2!' : (data.user_word_jp || ''),
          isUser: true, level: data.jacet_level, score: data.score,
        },
      ];
      if (data.ai_response) {
        newEntries.push({ word: data.ai_response, translation: data.ai_response_jp || '', isUser: false, level: data.ai_jacet_level, score: 0 });
      }

      const nextHistory = [...history, ...newEntries];
      const usedAfter = new Set(nextHistory.map(h => h.word.toLowerCase()));
      setHistory(nextHistory);
      setScore(prev => prev + (data.score || 0));
      if (wordList.filter(w => !usedAfter.has(w.word.toLowerCase())).length === 0) {
        setGameOver(true);
        setGameOverReason('すべての単語を使い切りました！');
      }
    } catch { setGameError('通信エラーが発生しました。もう一度お試しください。'); }
    setGameLoading(false);
  }, [gameLoading, gameOver, history, wordList]);

  // ── セットアップ ──
  if (phase === 'setup') {
    return (
      <PageShell variant="amber" contentKey={phase}>
        <header className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors mb-6">
            ← トップへ戻る
          </Link>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-3xl">🎯</span>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-amber-300 to-white bg-clip-text text-transparent animate-gradient-x">練習ゲーム</h1>
          </div>
          <p className="text-white/40 text-sm text-center">レベルとジャンルを選んで単語で対戦しよう</p>
        </header>

        <div className="flex flex-col gap-3">
          <LevelSelector selectedLevels={selectedLevels} onChange={setSelectedLevels} variant="amber" />
          <GenreSelector genres={allGenres} selectedGenres={selectedGenres} onChange={setSelectedGenres} variant="amber" />

          {setupError && (
            <div role="alert" className="bg-rose-500/15 border border-rose-400/30 text-rose-300 text-sm font-bold rounded-2xl px-4 py-3 text-center backdrop-blur-sm">
              ⚠️ {setupError}
            </div>
          )}

          <button onClick={startPractice} disabled={!canStart}
            className="w-full py-4 rounded-2xl font-black text-white text-base bg-gradient-to-r from-amber-500 to-orange-600 shadow-xl hover:from-amber-400 hover:to-orange-500 transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed animate-glow [--glow:rgba(245,158,11,0.35)]">
            {loading ? '準備中...' : '🎯 練習ゲームを始める'}
          </button>
        </div>
      </PageShell>
    );
  }

  // ── ゲーム ──
  return (
    <PageShell variant="amber" contentKey={phase}>
      <PracticeGame
        wordList={wordList}
        history={history}
        score={score}
        gameOver={gameOver}
        gameOverReason={gameOverReason}
        gameLoading={gameLoading}
        errorMsg={gameError}
        onPlayWord={playWord}
        onRestart={() => { setHistory([]); setScore(0); setGameOver(false); setGameOverReason(''); setGameError(''); }}
        onBack={() => { setGameError(''); setPhase('setup'); }}
        backLabel="← 設定に戻る"
        variant="amber"
      />
    </PageShell>
  );
}
