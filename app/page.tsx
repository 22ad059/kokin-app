'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChatMessage } from '@/types/game';
import Lobby from '@/components/Lobby';
import GameBoard from '@/components/GameBoard';
import ResultScreen from '@/components/ResultScreen';

export default function Game() {
  const [showTop, setShowTop] = useState(true);
  const [isPvP, setIsPvP] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [losingPlayer, setLosingPlayer] = useState<number | null>(null);
  const [gameOverReason, setGameOverReason] = useState('');
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [theme, setTheme] = useState('');
  const [isThemeSet, setIsThemeSet] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [charLimit, setCharLimit] = useState<number | null>(null);
  const [posLimit, setPosLimit] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const goToTop = () => {
    setShowTop(true);
    setIsThemeSet(false);
    setIsGameOver(false);
    setLosingPlayer(null);
    setGameOverReason('');
    setHistory([]);
    setTotalScore(0);
    setScores({ p1: 0, p2: 0 });
    setInput('');
    setTheme('');
    setCurrentPlayer(1);
    setCharLimit(null);
    setPosLimit(null);
    setErrorMsg('');
  };

  const resetGame = () => {
    setIsThemeSet(false);
    setIsGameOver(false);
    setLosingPlayer(null);
    setGameOverReason('');
    setHistory([]);
    setTotalScore(0);
    setScores({ p1: 0, p2: 0 });
    setInput('');
    setTheme('');
    setCurrentPlayer(1);
    setCharLimit(null);
    setPosLimit(null);
    setErrorMsg('');
  };

  const rematch = () => {
    setIsGameOver(false);
    setLosingPlayer(null);
    setGameOverReason('');
    setHistory([]);
    setTotalScore(0);
    setScores({ p1: 0, p2: 0 });
    setInput('');
    setCurrentPlayer(1);
    setErrorMsg('');
  };

  const playTurn = async () => {
    const word = input.trim();
    if (!word || loading || isGameOver) return;
    if (charLimit !== null && word.length !== charLimit) return;
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme,
          userWord: word,
          history: history.map(h => h.word),
          mode: isPvP ? 'pvp' : 'solo',
          charLimit,
          posLimit,
        }),
      });
      const data = await res.json();

      if (data.is_valid) {
        if (isPvP) {
          const playerKey = currentPlayer === 1 ? 'p1' : 'p2';
          setScores(prev => ({ ...prev, [playerKey]: prev[playerKey] + data.score }));
          setHistory(prev => [...prev, {
            word,
            translation: data.is_synonym ? '🔥 類義語ボーナス x2!' : data.is_antonym ? '❄️ 対義語ボーナス x2!' : `プレイヤー ${currentPlayer}`,
            isUser: currentPlayer === 1,
            level: data.jacet_level,
            score: data.score,
          }]);
          setCurrentPlayer(prev => prev === 1 ? 2 : 1);
        } else {
          setTotalScore(prev => prev + data.score);
          setHistory(prev => [...prev,
            { word, translation: data.is_synonym ? '🔥 類義語ボーナス x2!' : data.is_antonym ? '❄️ 対義語ボーナス x2!' : (data.user_word_jp || ''), isUser: true, level: data.jacet_level, score: data.score },
            ...(data.ai_response ? [{ word: data.ai_response, translation: data.ai_response_jp, isUser: false, level: data.ai_jacet_level }] : []),
          ]);
        }
        setInput('');
      } else {
        setGameOverReason(data.reason);
        if (isPvP) setLosingPlayer(currentPlayer);
        setIsGameOver(true);
      }
    } catch {
      setErrorMsg('通信エラーが発生しました。もう一度お試しください。');
    }
    setLoading(false);
  };

  const screen = showTop ? 'top' : !isThemeSet ? 'lobby' : isGameOver ? 'result' : 'game';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center px-4 py-10">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-grid-overlay" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-float-a" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl animate-float-b" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      {/* ヘッダー：トップ画面のみ表示 */}
      {screen === 'top' && (
        <header className="relative mb-8 text-center animate-fade-up">
          <button onClick={goToTop} className="group inline-flex items-center gap-2 mb-2">
            <span className="text-3xl group-hover:scale-110 transition-transform">🌏</span>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-300 to-white bg-clip-text text-transparent animate-gradient-x title-glow">
              英語<span className="text-indigo-400">・デ・</span>古今東西
            </h1>
          </button>
          <p className="text-white/40 text-sm">テーマに沿った英単語を出し合おう</p>
        </header>
      )}

      {/* key で画面切り替えごとに入場アニメーションを再生する */}
      <div key={screen} className="relative w-full max-w-lg animate-fade-up">
        {/* ─── トップ画面 ─── */}
        {screen === 'top' && (
          <div className="flex flex-col gap-4">
            {/* ゲームカード */}
            <button
              onClick={() => setShowTop(false)}
              className="group card-shine w-full text-left bg-gradient-to-br from-indigo-500/20 to-violet-600/20 backdrop-blur-xl border border-indigo-400/20 rounded-3xl p-7 hover:border-indigo-400/50 hover:from-indigo-500/30 hover:to-violet-600/30 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/25 transition-all duration-300 active:scale-[0.98] shadow-xl shadow-indigo-950/50"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-5xl">⚔️</div>
                <span className="text-xs font-bold text-indigo-400/60 uppercase tracking-widest border border-indigo-400/20 px-2.5 py-1 rounded-full">
                  GAME
                </span>
              </div>
              <h2 className="text-2xl font-black text-white mb-1">対戦ゲーム</h2>
              <p className="text-white/40 text-sm leading-relaxed">
                テーマを決めて英単語を出し合おう。<br />
                ソロ（AI対戦）または2人対戦で遊べる。
              </p>
              <div className="flex gap-2 mt-5">
                <span className="text-xs font-bold text-indigo-300/60 bg-indigo-500/10 border border-indigo-400/20 px-2.5 py-1 rounded-full">🤖 ソロ</span>
                <span className="text-xs font-bold text-rose-300/60 bg-rose-500/10 border border-rose-400/20 px-2.5 py-1 rounded-full">⚔️ 2人対戦</span>
                <span className="text-xs font-bold text-amber-300/60 bg-amber-500/10 border border-amber-400/20 px-2.5 py-1 rounded-full">✨ JACET8000</span>
              </div>
            </button>

            {/* 学習カード・練習カード（横並び） */}
            <div className="grid grid-cols-2 gap-4">
              <Link
                href="/study"
                className="group card-shine text-left bg-gradient-to-br from-emerald-500/20 to-teal-600/20 backdrop-blur-xl border border-emerald-400/20 rounded-3xl p-5 hover:border-emerald-400/50 hover:from-emerald-500/30 hover:to-teal-600/30 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/25 transition-all duration-300 active:scale-[0.98] shadow-xl shadow-emerald-950/50 block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">📚</div>
                  <span className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest border border-emerald-400/20 px-2 py-0.5 rounded-full">
                    STUDY
                  </span>
                </div>
                <h2 className="text-lg font-black text-white mb-1">単語学習</h2>
                <p className="text-white/40 text-xs leading-relaxed">
                  クイズ形式または<br />一覧で確認できる。
                </p>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  <span className="text-[10px] font-bold text-emerald-300/60 bg-emerald-500/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">📖 一覧</span>
                  <span className="text-[10px] font-bold text-teal-300/60 bg-teal-500/10 border border-teal-400/20 px-2 py-0.5 rounded-full">🃏 クイズ</span>
                </div>
              </Link>

              <Link
                href="/practice"
                className="group card-shine text-left bg-gradient-to-br from-amber-500/20 to-orange-600/20 backdrop-blur-xl border border-amber-400/20 rounded-3xl p-5 hover:border-amber-400/50 hover:from-amber-500/30 hover:to-orange-600/30 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-500/25 transition-all duration-300 active:scale-[0.98] shadow-xl shadow-amber-950/50 block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">🎯</div>
                  <span className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest border border-amber-400/20 px-2 py-0.5 rounded-full">
                    PRACTICE
                  </span>
                </div>
                <h2 className="text-lg font-black text-white mb-1">練習ゲーム</h2>
                <p className="text-white/40 text-xs leading-relaxed">
                  単語リストから<br />AIと対戦して学ぼう。
                </p>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  <span className="text-[10px] font-bold text-amber-300/60 bg-amber-500/10 border border-amber-400/20 px-2 py-0.5 rounded-full">🤖 AI対戦</span>
                  <span className="text-[10px] font-bold text-orange-300/60 bg-orange-500/10 border border-orange-400/20 px-2 py-0.5 rounded-full">制限なし</span>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* ─── ゲームフロー ─── */}
        {screen === 'lobby' && (
          <Lobby
            isPvP={isPvP}
            setIsPvP={setIsPvP}
            theme={theme}
            setTheme={setTheme}
            charLimit={charLimit}
            setCharLimit={setCharLimit}
            posLimit={posLimit}
            setPosLimit={setPosLimit}
            onStart={() => setIsThemeSet(true)}
            onBack={goToTop}
          />
        )}

        {screen === 'game' && (
          <GameBoard
            isPvP={isPvP}
            currentPlayer={currentPlayer}
            scores={scores}
            totalScore={totalScore}
            theme={theme}
            charLimit={charLimit}
            posLimit={posLimit}
            history={history}
            input={input}
            setInput={setInput}
            loading={loading}
            errorMsg={errorMsg}
            onPlayTurn={playTurn}
            onReset={resetGame}
            onEndGame={() => setIsGameOver(true)}
          />
        )}

        {screen === 'result' && (
          <ResultScreen
            isPvP={isPvP}
            losingPlayer={losingPlayer}
            scores={scores}
            totalScore={totalScore}
            history={history}
            theme={theme}
            reason={gameOverReason}
            onRematch={rematch}
            onReset={resetGame}
          />
        )}
      </div>
    </div>
  );
}
