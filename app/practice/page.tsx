'use client';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { WordEntry, PracticeMessage } from '@/types/study';
import PageShell from '@/components/study/PageShell';
import LevelSelector from '@/components/study/LevelSelector';
import GenreSelector from '@/components/study/GenreSelector';
import PracticeGame from '@/components/study/PracticeGame';
import WordCardGrid from '@/components/study/WordCardGrid';
import { sameWord } from '@/lib/wordMatch';

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
  // 和訳ヒントを見た単語（小文字）
  const [hintedWords, setHintedWords] = useState<Set<string>>(new Set());

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

  // 選択中のレベル・ジャンルの単語（設定画面で確認用）。選択が変わったら取り直す
  const [preview, setPreview] = useState<{ key: string; words: WordEntry[] } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const hasSelection = selectedLevels.length > 0 && selectedGenres.length > 0;
  const previewKey = `${selectedLevels.join(',')}|${selectedGenres.join(',')}`;
  useEffect(() => {
    if (!hasSelection) return;
    let cancelled = false;
    const params = new URLSearchParams({ level: selectedLevels.join(','), genre: selectedGenres.join(','), sort: 'rank' });
    const timer = setTimeout(() => {
      fetch(`/api/words?${params}`)
        .then(r => r.json())
        .then(d => { if (!cancelled) setPreview({ key: previewKey, words: d.words ?? [] }); })
        .catch(() => { if (!cancelled) setPreview({ key: previewKey, words: [] }); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [hasSelection, previewKey, selectedLevels, selectedGenres]);
  const previewWords: WordEntry[] | null = !hasSelection ? [] : preview?.key === previewKey ? preview.words : null;

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
      if (!res.ok) { setSetupError(data?.error || '通信エラーが発生しました。もう一度お試しください。'); return; }
      const words: WordEntry[] = data.words ?? [];
      if (words.length === 0) { setSetupError('該当する単語がありません。レベルやジャンルを変えてください。'); return; }
      setWordList(words);
      setHistory([]);
      setHintedWords(new Set());
      setScore(0);
      setGameOver(false);
      setGameOverReason('');
      setGameError('');
      setPhase('game');
    } catch {
      setSetupError('通信エラーが発生しました。もう一度お試しください。');
    } finally { setLoading(false); }
  }, [canStart, selectedLevels, selectedGenres]);

  // 戻り値: 合格なら true（入力モードで入力欄をクリアするかの判定に使う）
  const playWord = useCallback(async (word: string): Promise<boolean> => {
    if (gameLoading || gameOver) return false;
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
          practiceGenres: selectedGenres,
          practiceLevels: selectedLevels,
        }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.is_valid !== 'boolean') {
        setGameError(data?.error || '通信エラーが発生しました。もう一度お試しください。');
        setGameLoading(false);
        return false;
      }
      if (!data.is_valid) { setGameError(data.reason || 'その単語は使えません。'); setGameLoading(false); return false; }

      // つづりを1文字まちがえたときは、直した単語で記録する
      const played: string = data.corrected_word || word;
      const newEntries: PracticeMessage[] = [
        {
          word: played,
          typedAs: data.corrected_word ? data.typed_word : undefined,
          translation: data.is_synonym ? '類義語ボーナス x2!' : data.is_antonym ? '対義語ボーナス x2!' : (data.user_word_jp || ''),
          isUser: true, level: data.jacet_level, score: data.score,
          hinted: [...hintedWords].some(h => sameWord(h, played)),
        },
      ];
      if (data.ai_response) {
        newEntries.push({ word: data.ai_response, translation: data.ai_response_jp || '', isUser: false, level: data.ai_jacet_level, score: 0 });
      }

      const nextHistory = [...history, ...newEntries];

      setHistory(nextHistory);
      setScore(prev => prev + (data.score || 0));
      if (wordList.every(w => nextHistory.some(h => sameWord(h.word, w.word)))) {
        setGameOver(true);
        setGameOverReason('クリア！選んだ単語をすべて出し切りました');
      }
      setGameLoading(false);
      return true;
    } catch {
      setGameError('通信エラーが発生しました。もう一度お試しください。');
      setGameLoading(false);
      return false;
    }
  }, [gameLoading, gameOver, history, wordList, selectedGenres, selectedLevels, hintedWords]);

  // ── セットアップ ──
  if (phase === 'setup') {
    return (
      <PageShell variant="amber" contentKey={phase}>
        <header className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors mb-6">
            ← トップへ戻る
          </Link>
          <div className="flex items-center justify-center gap-2 mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/practice-icon.png" alt="" className="h-9 w-auto" />
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-amber-300 to-white bg-clip-text text-transparent animate-gradient-x">練習ゲーム</h1>
          </div>
          <p className="text-white/40 text-sm text-center">レベルとジャンルを選んで単語で対戦しよう</p>
        </header>

        <div className="flex flex-col gap-3">
          <LevelSelector selectedLevels={selectedLevels} onChange={setSelectedLevels} variant="amber" />
          <GenreSelector genres={allGenres} selectedGenres={selectedGenres} onChange={setSelectedGenres} variant="amber" />

          {/* 選んだ単語を見るボタン */}
          <button
            onClick={() => setShowPreview(true)}
            disabled={!previewWords || previewWords.length === 0}
            className="w-full py-3 rounded-2xl font-bold text-sm text-amber-200 bg-white/5 border border-amber-400/30 hover:bg-amber-500/10 hover:border-amber-400/50 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {previewWords === null ? '単語を読み込み中…' : `選んだ単語を見る（${previewWords.length} 語）`}
          </button>

          <p className="text-[11px] text-white/30 px-1">
            選んだジャンルに合う英単語を入力して AI と出し合う。困ったら和訳のヒントを見られる（ヒントを見た単語は別に数える）。選んだレベル以外の単語でも、ジャンルに合っていれば正解。選んだレベル・ジャンルの単語をすべて出し切ったらクリア。
          </p>

          {setupError && (
            <div role="alert" className="bg-rose-500/15 border border-rose-400/30 text-rose-300 text-sm font-bold rounded-2xl px-4 py-3 text-center backdrop-blur-sm">
              {setupError}
            </div>
          )}

          <button onClick={startPractice} disabled={!canStart}
            className="w-full py-4 rounded-2xl font-black text-white text-base bg-gradient-to-r from-amber-500 to-orange-600 shadow-xl hover:from-amber-400 hover:to-orange-500 transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed animate-glow [--glow:rgba(245,158,11,0.35)]">
            {loading ? '準備中...' : '練習ゲームを始める'}
          </button>
        </div>

        {/* ページ全体のアニメーション（transform）の影響を受けないよう body 直下に出す */}
        {showPreview && previewWords && createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="選んだ単語"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowPreview(false)}
          >
            <div
              className="w-full max-w-md max-h-[80vh] flex flex-col bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-2xl animate-fade-up"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-black text-white">選んだ単語 <span className="text-amber-300">{previewWords.length} 語</span></p>
                <button onClick={() => setShowPreview(false)} className="text-sm font-bold text-white/50 hover:text-white px-2 py-1">
                  閉じる
                </button>
              </div>
              <div className="overflow-y-auto pr-1">
                <WordCardGrid words={previewWords} />
              </div>
            </div>
          </div>,
          document.body,
        )}
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
        onRestart={() => { setHistory([]); setHintedWords(new Set()); setScore(0); setGameOver(false); setGameOverReason(''); setGameError(''); }}
        onRetire={() => { setGameError(''); setGameOver(true); setGameOverReason('リタイア'); }}
        onBack={() => { setGameError(''); setPhase('setup'); }}
        backLabel="← 設定に戻る"
        variant="amber"
        inputMode
        hintedWords={hintedWords}
        onRevealHint={w => setHintedWords(prev => new Set(prev).add(w.toLowerCase()))}
        genres={selectedGenres}
        levels={[...selectedLevels].sort()}
      />
    </PageShell>
  );
}
