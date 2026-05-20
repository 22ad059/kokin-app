'use client';
import { useState } from 'react';
import { ChatMessage } from '@/types/game';
import Lobby from '@/components/Lobby';
import GameBoard from '@/components/GameBoard';
import ResultScreen from '@/components/ResultScreen';

export default function Game() {
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
  };

  const playTurn = async () => {
    if (!input || loading || isGameOver) return;
    if (charLimit !== null && input.length !== charLimit) return;
    setLoading(true);

    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        body: JSON.stringify({
          theme,
          userWord: input,
          history: history.map(h => h.word),
          mode: isPvP ? 'pvp' : 'solo',
          charLimit,
        }),
      });
      const data = await res.json();

      if (data.is_valid) {
        if (isPvP) {
          const playerKey = currentPlayer === 1 ? 'p1' : 'p2';
          setScores(prev => ({ ...prev, [playerKey]: prev[playerKey] + data.score }));
          setHistory(prev => [...prev, {
            word: input,
            translation: data.is_synonym ? '🔥 類義語ボーナス x2!' : data.is_antonym ? '❄️ 対義語ボーナス x2!' : `プレイヤー ${currentPlayer}`,
            isUser: currentPlayer === 1,
            cefr: data.cefr_level,
            score: data.score,
          }]);
          setCurrentPlayer(prev => prev === 1 ? 2 : 1);
        } else {
          setTotalScore(prev => prev + data.score);
          setHistory(prev => [...prev,
            { word: input, translation: data.is_synonym ? '🔥 類義語ボーナス x2!' : data.is_antonym ? '❄️ 対義語ボーナス x2!' : 'あなた', isUser: true, cefr: data.cefr_level, score: data.score },
            { word: data.ai_response, translation: data.ai_response_jp, isUser: false },
          ]);
        }
        setInput('');
      } else {
        setGameOverReason(data.reason);
        if (isPvP) setLosingPlayer(currentPlayer);
        setIsGameOver(true);
      }
    } catch {
      alert('エラーが発生しました。');
    }
    setLoading(false);
  };

  const screen = !isThemeSet ? 'lobby' : isGameOver ? 'result' : 'game';

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-100 flex flex-col items-center px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-800 tracking-wide">英語・デ・古今東西ゲーム</h1>
        <p className="text-slate-400 text-sm mt-1">テーマに沿った英単語を答えていこう</p>
      </header>

      {screen === 'lobby' && (
        <Lobby
          isPvP={isPvP}
          setIsPvP={setIsPvP}
          theme={theme}
          setTheme={setTheme}
          charLimit={charLimit}
          setCharLimit={setCharLimit}
          onStart={() => setIsThemeSet(true)}
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
          history={history}
          input={input}
          setInput={setInput}
          loading={loading}
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
          onRematch={() => window.location.reload()}
          onReset={resetGame}
        />
      )}
    </div>
  );
}
