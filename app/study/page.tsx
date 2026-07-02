'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { LEVEL_COLORS } from '@/lib/constants';
import type { WordEntry, PracticeMessage } from '@/types/study';
import PageShell from '@/components/study/PageShell';
import LevelSelector from '@/components/study/LevelSelector';
import GenreSelector from '@/components/study/GenreSelector';
import PracticeGame from '@/components/study/PracticeGame';

type Phase = 'setup' | 'quiz' | 'result' | 'browse' | 'practice';

const QUIZ_SIZE_MIN = 1;
const QUIZ_SIZE_FALLBACK_MAX = 30;

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function StudyPage() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [selectedLevels, setSelectedLevels] = useState<string[]>(['Level 1', 'Level 2']);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [cards, setCards] = useState<WordEntry[]>([]);
  const [current, setCurrent] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [browseWords, setBrowseWords] = useState<WordEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [quizSize, setQuizSize] = useState(10);
  const [availableCount, setAvailableCount] = useState<number | null>(null);

  // Browse selection mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [setupError, setSetupError] = useState('');

  // Practice game
  const [practiceWordList, setPracticeWordList] = useState<WordEntry[]>([]);
  const [practiceHistory, setPracticeHistory] = useState<PracticeMessage[]>([]);
  const [practiceScore, setPracticeScore] = useState(0);
  const [practiceOver, setPracticeOver] = useState(false);
  const [practiceOverReason, setPracticeOverReason] = useState('');
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState('');

  useEffect(() => {
    fetch('/api/words?limit=1')
      .then(r => r.json())
      .then(d => {
        const all: string[] = d.genres ?? [];
        const sorted = [...all.filter(g => g !== 'その他'), ...all.filter(g => g === 'その他')];
        setGenres(sorted);
        setSelectedGenres(prev => prev.length ? prev : sorted.slice(0, 1));
      })
      .catch(() => {});
  }, []);

  // 選択中のレベル・ジャンルに該当する単語数を取得（学習語数の上限に使う）
  useEffect(() => {
    if (!selectedLevels.length || !selectedGenres.length) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('level', selectedLevels.join(','));
    params.set('genre', selectedGenres.join(','));
    params.set('limit', '1');
    fetch(`/api/words?${params}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => setAvailableCount(typeof d.total === 'number' ? d.total : null))
      .catch(() => {});
    return () => controller.abort();
  }, [selectedLevels, selectedGenres]);

  const hasSelection = selectedLevels.length > 0 && selectedGenres.length > 0;
  const quizSizeMax = Math.max(QUIZ_SIZE_MIN, (hasSelection ? availableCount : null) ?? QUIZ_SIZE_FALLBACK_MAX);
  // 上限が下がった場合は state を直接書き換えず、実効値としてクランプする
  const effectiveQuizSize = Math.min(quizSize, quizSizeMax);

  const fetchWords = useCallback(async (options: { limit?: number; sort?: 'rank' }) => {
    const params = new URLSearchParams();
    params.set('level', selectedLevels.join(','));
    params.set('genre', selectedGenres.join(','));
    if (options.limit) params.set('limit', String(options.limit * 3));
    if (options.sort) params.set('sort', options.sort);
    const res = await fetch(`/api/words?${params}`);
    const data = await res.json();
    return (data.words ?? []) as WordEntry[];
  }, [selectedLevels, selectedGenres]);

  const startQuiz = useCallback(async () => {
    if (!selectedLevels.length || !selectedGenres.length) return;
    setSetupError('');
    setLoading(true);
    try {
      const words = await fetchWords({ limit: effectiveQuizSize });
      const allWords = shuffle(words).slice(0, effectiveQuizSize);
      if (allWords.length === 0) {
        setSetupError('該当する単語がありません。レベルやジャンルを変えてください。');
        setPhase('setup');
        return;
      }
      setCards(allWords);
      setCurrent(0);
      setShowAnswer(false);
      setPhase('quiz');
    } catch {
      setSetupError('通信エラーが発生しました。もう一度お試しください。');
      setPhase('setup');
    } finally { setLoading(false); }
  }, [selectedLevels, selectedGenres, effectiveQuizSize, fetchWords]);

  const startBrowse = useCallback(async () => {
    if (!selectedLevels.length || !selectedGenres.length) return;
    setSetupError('');
    setLoading(true);
    try {
      const words = await fetchWords({ sort: 'rank' });
      if (words.length === 0) { setSetupError('該当する単語がありません。レベルやジャンルを変えてください。'); return; }
      setBrowseWords(words);
      setSearchQuery('');
      setSelectMode(false);
      setSelectedWords(new Set());
      setPhase('browse');
    } catch {
      setSetupError('通信エラーが発生しました。もう一度お試しください。');
    } finally { setLoading(false); }
  }, [selectedLevels, selectedGenres, fetchWords]);

  const startPractice = useCallback(() => {
    const selected = browseWords.filter(w => selectedWords.has(w.word));
    if (selected.length < 2) return;
    setPracticeWordList(selected);
    setPracticeHistory([]);
    setPracticeScore(0);
    setPracticeOver(false);
    setPracticeOverReason('');
    setPracticeError('');
    setPhase('practice');
  }, [browseWords, selectedWords]);

  const practicePlayWord = useCallback(async (word: string) => {
    if (practiceLoading || practiceOver) return;
    setPracticeError('');
    setPracticeLoading(true);
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWord: word,
          history: practiceHistory.map(h => h.word),
          mode: 'solo',
          practiceWords: practiceWordList.map(w => w.word),
        }),
      });
      const data = await res.json();
      if (!data.is_valid) { setPracticeError(data.reason || 'その単語は使えません。'); setPracticeLoading(false); return; }

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

      const nextHistory = [...practiceHistory, ...newEntries];
      const usedAfter = new Set(nextHistory.map(h => h.word.toLowerCase()));
      setPracticeHistory(nextHistory);
      setPracticeScore(prev => prev + (data.score || 0));
      if (practiceWordList.filter(w => !usedAfter.has(w.word.toLowerCase())).length === 0) {
        setPracticeOver(true);
        setPracticeOverReason('すべての単語を使い切りました！');
      }
    } catch { setPracticeError('通信エラーが発生しました。もう一度お試しください。'); }
    setPracticeLoading(false);
  }, [practiceHistory, practiceLoading, practiceOver, practiceWordList]);

  const prev = () => { if (current === 0) return; setShowAnswer(false); setCurrent(c => c - 1); };
  const next = () => {
    if (current + 1 >= cards.length) { setPhase('result'); }
    else { setCurrent(c => c + 1); setShowAnswer(false); }
  };

  const canStart = selectedLevels.length > 0 && selectedGenres.length > 0 && !loading;

  // ── セットアップ ──
  if (phase === 'setup') {
    return (
      <PageShell contentKey={phase}>
        <header className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors mb-6">
            ← トップへ戻る
          </Link>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-3xl">📚</span>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-300 to-white bg-clip-text text-transparent animate-gradient-x">単語カード学習</h1>
          </div>
          <p className="text-white/40 text-sm text-center">ジャンルとレベルを選んで学習しよう</p>
        </header>

        <div className="flex flex-col gap-3">
          <LevelSelector selectedLevels={selectedLevels} onChange={setSelectedLevels} />
          <GenreSelector genres={genres} selectedGenres={selectedGenres} onChange={setSelectedGenres} />

          {/* 問題数 */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">学習語数</p>
              <button
                onClick={() => setQuizSize(quizSizeMax)}
                className="text-xs font-bold text-emerald-400/70 hover:text-emerald-400 transition-colors"
              >
                最大にする
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuizSize(Math.max(QUIZ_SIZE_MIN, effectiveQuizSize - 1))}
                disabled={effectiveQuizSize <= QUIZ_SIZE_MIN}
                className="w-10 h-10 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed"
              >−</button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-black text-white tabular-nums">{effectiveQuizSize}</span>
                <span className="text-sm text-white/40 ml-1">語</span>
              </div>
              <button
                onClick={() => setQuizSize(Math.min(quizSizeMax, effectiveQuizSize + 1))}
                disabled={effectiveQuizSize >= quizSizeMax}
                className="w-10 h-10 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed"
              >＋</button>
            </div>
            <input
              type="range"
              min={QUIZ_SIZE_MIN}
              max={quizSizeMax}
              value={effectiveQuizSize}
              onChange={e => setQuizSize(Number(e.target.value))}
              className="w-full mt-3 accent-emerald-400 cursor-pointer"
            />
            <p className="text-xs text-white/20 text-center mt-2">
              {QUIZ_SIZE_MIN}〜{quizSizeMax} 語
              {availableCount !== null && `（該当 ${availableCount} 語）`}
            </p>
          </div>

          {setupError && (
            <div role="alert" className="bg-rose-500/15 border border-rose-400/30 text-rose-300 text-sm font-bold rounded-2xl px-4 py-3 text-center backdrop-blur-sm">
              ⚠️ {setupError}
            </div>
          )}

          <button onClick={startQuiz} disabled={!canStart}
            className="w-full py-4 rounded-2xl font-black text-white text-base bg-gradient-to-r from-emerald-500 to-teal-600 shadow-xl hover:from-emerald-400 hover:to-teal-500 transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed animate-glow [--glow:rgba(16,185,129,0.35)]">
            {loading ? '準備中...' : 'クイズ開始'}
          </button>
          <button onClick={startBrowse} disabled={!canStart}
            className="w-full py-4 rounded-2xl font-black text-white/60 text-base bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed backdrop-blur-sm">
            単語一覧を見る
          </button>
        </div>
      </PageShell>
    );
  }

  // ── 一覧表示 ──
  if (phase === 'browse') {
    const q = searchQuery.toLowerCase();
    const filtered = browseWords.filter(w => w.word.toLowerCase().includes(q) || w.translation.includes(searchQuery));
    const selectedCount = selectedWords.size;

    return (
      <PageShell contentKey={phase}>
        <div className={`flex flex-col gap-4 ${selectedCount >= 2 ? 'pb-24' : ''}`}>
          <div className="flex items-center justify-between">
            <button onClick={() => setPhase('setup')} className="inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors">
              ← 設定に戻る
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white/50">{browseWords.length} 語</span>
              <button
                onClick={() => setSelectMode(v => !v)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
                  selectMode ? 'bg-violet-500/20 border-violet-400/40 text-violet-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
                }`}
              >
                {selectMode ? `${selectedCount}語選択中` : '選択モード'}
              </button>
            </div>
          </div>

          <div className="relative">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="単語・日本語で絞り込み..."
              className="w-full bg-white/5 border border-white/10 backdrop-blur-sm text-white text-sm font-medium pl-10 pr-4 py-3 rounded-2xl outline-none focus:border-emerald-400/50 transition-colors placeholder:text-white/20"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20">🔍</span>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            {filtered.length === 0 ? (
              <p className="text-center text-white/30 text-sm py-10">該当する単語がありません</p>
            ) : (
              <div className="divide-y divide-white/5">
                {filtered.map((w, i) => {
                  const isSelected = selectedWords.has(w.word);
                  return (
                    <div key={`${w.word}-${i}`}
                      onClick={() => {
                        if (!selectMode) return;
                        setSelectedWords(prev => {
                          const next = new Set(prev);
                          if (next.has(w.word)) next.delete(w.word);
                          else next.add(w.word);
                          return next;
                        });
                      }}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${selectMode ? 'cursor-pointer' : ''} ${isSelected && selectMode ? 'bg-violet-500/10' : ''}`}
                    >
                      {selectMode && (
                        <div className={`w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-violet-500 border-violet-400' : 'border-white/20'}`}>
                          {isSelected && <span className="text-[10px] text-white font-black">✓</span>}
                        </div>
                      )}
                      <span className="text-xs text-white/20 w-8 shrink-0 text-right tabular-nums">{w.rank}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white">{w.word}</p>
                        <p className="text-sm text-white/50">{w.translation}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_COLORS[w.level] ?? 'bg-white/10 text-white/40 border-white/10'}`}>
                          {w.level.replace('Level ', 'Lv.')}
                        </span>
                        <span className="text-[10px] text-white/30">{w.pos}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button onClick={startQuiz} disabled={loading}
            className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 transition-all active:scale-95 disabled:opacity-20">
            このジャンルでクイズ
          </button>
        </div>

        {selectedCount >= 2 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/80 backdrop-blur-xl border-t border-white/10 z-10">
            <div className="max-w-sm mx-auto">
              <button onClick={startPractice}
                className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-violet-500 to-indigo-600 shadow-xl shadow-violet-500/30 hover:from-violet-400 hover:to-indigo-500 transition-all active:scale-95">
                🎯 {selectedCount}語で練習ゲームを始める
              </button>
            </div>
          </div>
        )}
      </PageShell>
    );
  }

  // ── 練習ゲーム ──
  if (phase === 'practice') {
    return (
      <PageShell contentKey={phase}>
        <PracticeGame
          wordList={practiceWordList}
          history={practiceHistory}
          score={practiceScore}
          gameOver={practiceOver}
          gameOverReason={practiceOverReason}
          gameLoading={practiceLoading}
          errorMsg={practiceError}
          onPlayWord={practicePlayWord}
          onRestart={() => { setPracticeHistory([]); setPracticeScore(0); setPracticeOver(false); setPracticeOverReason(''); setPracticeError(''); }}
          onBack={() => { setPracticeError(''); setPhase('browse'); }}
          backLabel="← 一覧に戻る"
        />
      </PageShell>
    );
  }

  // ── クイズ ──
  if (phase === 'quiz') {
    const q = cards[current];
    if (!q) return null;
    const progress = ((current + 1) / cards.length) * 100;

    return (
      <PageShell contentKey={phase}>
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex justify-between text-xs text-white/30 mb-2">
              <span>{current + 1} / {cards.length}</span>
              <span>{showAnswer ? '意味を確認中' : '単語を見る'}</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5">
              <div className="bg-gradient-to-r from-emerald-400 to-teal-400 h-1.5 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(52,211,153,0.6)]" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <button onClick={() => setShowAnswer(v => !v)}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center transition-all active:scale-[0.98] hover:bg-white/8 min-h-52">
            <span className={`text-[10px] font-bold uppercase tracking-widest border px-2.5 py-1 rounded-full inline-block mb-5 ${LEVEL_COLORS[q.level] ?? 'text-white/30 border-white/10'}`}>
              {q.level}
            </span>
            {showAnswer ? (
              <div key={`answer-${current}`} className="animate-fade-up">
                <p className="text-xs text-white/30 mb-2">意味</p>
                <p className="text-4xl font-black text-emerald-400">{q.translation || q.genre}</p>
                <p className="text-xs text-white/30 mt-4">{q.genre} · {q.pos}</p>
              </div>
            ) : (
              <div key={`question-${current}`} className="animate-fade-up">
                <p className="text-5xl font-black text-white mb-3">{q.word}</p>
                <p className="text-sm text-white/30">{q.pos}</p>
                <p className="text-sm font-bold text-emerald-400/60 mt-5">タップして意味を見る</p>
              </div>
            )}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={prev} disabled={current === 0}
              className="py-3 rounded-2xl font-black text-white/50 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95">
              前へ
            </button>
            <button onClick={next}
              className="py-3 rounded-2xl font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 transition-all active:scale-95">
              {current + 1 >= cards.length ? '結果へ' : '次へ'}
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── 結果 ──
  return (
    <PageShell contentKey={phase}>
      <div className="flex flex-col gap-4">
        <Link href="/" className="inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors self-start">
          ← トップへ戻る
        </Link>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
          <div className="px-6 pt-8 pb-6 text-center bg-gradient-to-b from-emerald-500/15 to-transparent">
            <p className="text-5xl mb-3">📖</p>
            <p className="text-2xl font-black text-white">{cards.length} 語を学習完了</p>
          </div>
          <div className="px-5 pb-5 space-y-2">
            {cards.map((card, i) => (
              <div key={`${card.word}-${i}`} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-sm font-black text-emerald-400/60 w-6 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-sm">{card.word}</p>
                  <p className="text-xs text-white/40 truncate">{card.translation}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${LEVEL_COLORS[card.level] ?? 'text-white/30 border-white/10'}`}>
                  {card.level.replace('Level ', 'Lv.')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={startQuiz} disabled={loading}
            className="py-4 rounded-2xl font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 transition-all active:scale-95 disabled:opacity-20">
            もう一回
          </button>
          <button onClick={() => setPhase('setup')}
            className="py-4 rounded-2xl font-black text-white/50 bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95">
            設定に戻る
          </button>
        </div>

      </div>
    </PageShell>
  );
}
