import { useRef, useEffect, useState } from 'react';
import SpellDiff from '@/components/SpellDiff';
import { LEVEL_BADGE } from '@/lib/constants';
import WordCardGrid from './WordCardGrid';
import { sameWord } from '@/lib/wordMatch';
import type { WordEntry, PracticeMessage } from '@/types/study';

type Variant = 'violet' | 'amber';

const COLORS: Record<Variant, {
  scoreBadge: string;
  progressBar: string;
  userBubble: string;
  chipHover: string;
  spinner: string;
  restartBtn: string;
  inputFocus: string;
}> = {
  violet: {
    scoreBadge:  'from-violet-500/20 to-indigo-500/20 border-violet-400/20',
    progressBar: 'from-violet-400 to-indigo-400 shadow-[0_0_8px_rgba(139,92,246,0.6)]',
    userBubble:  'from-violet-500 to-indigo-600 shadow-violet-500/20',
    chipHover:   'hover:bg-violet-500/20 hover:border-violet-400/30',
    spinner:     'border-violet-400/40 border-t-violet-400',
    restartBtn:  'from-violet-500 to-indigo-600',
    inputFocus:  'focus:border-violet-400/60',
  },
  amber: {
    scoreBadge:  'from-amber-500/20 to-orange-500/20 border-amber-400/20',
    progressBar: 'from-amber-400 to-orange-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
    userBubble:  'from-amber-500 to-orange-600 shadow-amber-500/20',
    chipHover:   'hover:bg-amber-500/20 hover:border-amber-400/30',
    spinner:     'border-amber-400/40 border-t-amber-400',
    restartBtn:  'from-amber-500 to-orange-600',
    inputFocus:  'focus:border-amber-400/60',
  },
};

interface Props {
  wordList: WordEntry[];
  history: PracticeMessage[];
  score: number;
  gameOver: boolean;
  gameOverReason: string;
  gameLoading: boolean;
  errorMsg?: string;
  /** 単語をプレイする。入力モードでは戻り値 false のとき入力欄を保持する */
  onPlayWord: (word: string) => void | boolean | Promise<void | boolean>;
  onRestart: () => void;
  /** ゲーム中に表示する、選んだジャンルとレベル */
  genres?: string[];
  levels?: string[];
  /** 和訳ヒントを見た単語（小文字）。onRevealHint と一緒に渡すとヒント欄を表示する */
  hintedWords?: Set<string>;
  onRevealHint?: (word: string) => void;
  /** 指定するとゲーム中にリタイアボタンを表示する */
  onRetire?: () => void;
  onBack: () => void;
  backLabel?: string;
  variant?: Variant;
  /** true なら日本語訳をヒントに英単語をタイピングして答える（リスト外は不合格） */
  inputMode?: boolean;
}

export default function PracticeGame({
  wordList, history, score, gameOver, gameOverReason,
  gameLoading, errorMsg, onPlayWord, onRestart, onRetire, onBack, backLabel = '← 戻る', variant = 'violet',
  inputMode = false, genres, levels, hintedWords, onRevealHint,
}: Props) {
  const c = COLORS[variant];
  const chatRef = useRef<HTMLDivElement>(null);
  const [typedWord, setTypedWord] = useState('');
  // ブラウザの確認ダイアログ（window.confirm）は環境によって出ないため、画面内で確認する
  const [confirmRetire, setConfirmRetire] = useState(false);

  // 入力モード: 合格したときだけ入力欄をクリアする（不合格なら打ち直せるよう保持）
  const submitTyped = async () => {
    const w = typedWord.trim();
    if (!w || gameLoading || gameOver) return;
    const result = await onPlayWord(w);
    if (result !== false) setTypedWord('');
  };

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [history]);

  // 括弧つきの見出し語（例: doctor (doc)）も本体や別の言い方で出されたら使用済み
  const remaining = wordList.filter(w => !history.some(h => sameWord(h.word, w.word)));
  // リスト外の単語（レベル外・辞書外）も出せるので、進捗はリストの単語だけで数える
  const usedCount = wordList.length - remaining.length;
  // 自分が出した単語を、ヒントなし（自力）とヒントありに分けて数える
  const userWords = history.filter(h => h.isUser);
  const hintCount = userWords.filter(h => h.hinted).length;
  const selfCount = userWords.length - hintCount;
  // つづりを1文字まちがえて直された回数（得点は半分）
  const spellCount = userWords.filter(h => h.typedAs).length;
  const hintsEnabled = inputMode && !!onRevealHint;
  const progressPct = wordList.length ? Math.round((usedCount / wordList.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors">
          {backLabel}
        </button>
        <div className={`flex items-center gap-2 bg-gradient-to-r ${c.scoreBadge} border px-4 py-2 rounded-full`}>
          <span className="text-white font-black text-xl">{score}</span>
          <span className="text-white/40 text-xs">pt</span>
        </div>
      </div>

      {/* 進捗バー */}
      <div>
        <div className="flex justify-between text-xs text-white/30 mb-1.5">
          <span>練習モード · {wordList.length} 語</span>
          <span>
            {hintsEnabled && <>自力 {selfCount} · ヒント {hintCount} · つづり修正 {spellCount} · </>}
            {usedCount} / {wordList.length} 使用済み
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1">
          <div
            className={`bg-gradient-to-r ${c.progressBar} h-1 rounded-full transition-all duration-500`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 選んだジャンルとレベル */}
      {((genres && genres.length > 0) || (levels && levels.length > 0)) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {genres?.map(g => (
            <span key={g} className="text-[11px] font-bold text-white/70 bg-white/10 border border-white/10 px-2.5 py-0.5 rounded-full">
              {g}
            </span>
          ))}
          {levels?.map(l => (
            <span key={l} className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${LEVEL_BADGE[l] ?? 'bg-white/10 text-white/40'}`}>
              {l.replace('Level ', 'Lv.')}
            </span>
          ))}
        </div>
      )}

      {/* チャット履歴 */}
      <div ref={chatRef} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 h-80 overflow-y-auto flex flex-col gap-3">
        {history.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20">
            <p className="text-sm font-medium">{inputMode ? '下の入力欄に英単語を入力して始めよう' : '下のカードから単語を選んで始めよう'}</p>
          </div>
        ) : (
          history.map((item, i) => (
            <div key={i} className={`flex flex-col animate-bubble-in ${item.isUser ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] font-bold text-white/35 mb-1 px-1">{item.isUser ? 'あなた' : 'AI'}</span>
              <div className={`max-w-full px-3.5 py-2.5 rounded-2xl ${
                item.isUser
                  ? `bg-gradient-to-br ${c.userBubble} text-white rounded-tr-none shadow-lg`
                  : 'bg-white/10 text-white border border-white/15 rounded-tl-none backdrop-blur-sm'
              }`}>
                {/* 英単語・和訳・レベル・ヒント・点数を横一列に並べる（狭いときだけ折り返す） */}
                <div className="flex items-baseline gap-x-2 gap-y-1 flex-wrap">
                  <span className="text-lg font-black tracking-wide break-all">{item.word}</span>
                  {item.translation && (
                    <span className={`text-sm font-bold ${item.isUser ? 'text-white' : 'text-white/85'}`}>{item.translation}</span>
                  )}
                  <span className="inline-flex items-center gap-1 self-center whitespace-nowrap">
                    {item.level && item.level !== 'Unknown' && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                        item.isUser ? 'bg-black/30 text-white' : (LEVEL_BADGE[item.level] ?? 'bg-white/20 text-white')
                      }`}>
                        {item.level.replace('Level ', 'Lv.')}
                      </span>
                    )}
                    {item.typedAs && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black bg-white/90 text-rose-600" title={`入力: ${item.typedAs}`}>つづり修正 ½</span>
                    )}
                    {item.hinted && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black bg-white text-amber-700">ヒント</span>
                    )}
                    {item.score != null && item.score > 0 && (
                      <span className="text-[10px] font-black bg-black/25 text-white rounded-full px-1.5 py-0.5">+{item.score} pt</span>
                    )}
                  </span>
                </div>
                {item.typedAs && (
                  <div className="mt-1.5 text-white/90">
                    <SpellDiff typed={item.typedAs} correct={item.word} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* エラー表示 */}
      {errorMsg && !gameOver && (
        <div role="alert" className="bg-rose-500/15 border border-rose-400/30 text-rose-300 text-sm font-bold rounded-2xl px-4 py-3 text-center backdrop-blur-sm">
          {errorMsg}
        </div>
      )}

      {/* 単語チップ or ゲームオーバー */}
      {gameOver ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center animate-fade-up">
          <p className="text-white font-black text-xl">{gameOverReason}</p>
          <p className="text-white/40 text-sm mt-1">スコア: {score} pt</p>
          {hintsEnabled && (
            <p className="text-white/60 text-sm mt-1">
              自力 <span className="font-black text-white">{selfCount}</span> 語 · ヒント <span className="font-black text-amber-300">{hintCount}</span> 語 · つづり修正 <span className="font-black text-rose-300">{spellCount}</span> 回
            </p>
          )}
          {remaining.length > 0 && (
            <div className="mt-5 text-left">
              <p className="text-xs font-bold text-white/40 mb-2">
                出せなかった単語 {remaining.length} 語
              </p>
              <div className="max-h-80 overflow-y-auto pr-1">
                <WordCardGrid words={remaining} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              onClick={onRestart}
              className={`py-3 rounded-2xl font-black text-white bg-gradient-to-r ${c.restartBtn} text-sm active:scale-95 transition-all`}
            >
              リトライ
            </button>
            <button
              onClick={onBack}
              className="py-3 rounded-2xl font-black text-white/50 bg-white/5 border border-white/10 text-sm active:scale-95 transition-all hover:bg-white/10"
            >
              戻る
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-white/30 mb-3">
            {gameLoading
              ? 'AI が考え中...'
              : inputMode
                ? `残り ${remaining.length} 語（英単語を入力）`
                : `残り ${remaining.length} 語（タップして使う）`}
          </p>
          {gameLoading ? (
            <div className="flex justify-center py-2">
              <div className={`w-6 h-6 border-2 ${c.spinner} rounded-full animate-spin`} />
            </div>
          ) : remaining.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-2">使える単語がありません</p>
          ) : inputMode ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  className={`flex-1 min-w-0 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 outline-none text-white font-bold placeholder:text-white/20 transition-colors ${c.inputFocus}`}
                  value={typedWord}
                  onChange={e => setTypedWord(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && submitTyped()}
                  placeholder="ジャンルに合う英単語を入力..."
                  autoFocus
                />
                <button
                  onClick={submitTyped}
                  disabled={gameLoading || !typedWord.trim()}
                  className={`px-5 py-2.5 rounded-xl font-black text-white bg-gradient-to-r ${c.restartBtn} shadow-lg transition-all active:scale-95 disabled:opacity-30 shrink-0`}
                >
                  送信
                </button>
              </div>
              {hintsEnabled && (() => {
                // 見た順に並べる（Set は追加順を保つ）
                const byWord = new Map(remaining.map(w => [w.word.toLowerCase(), w]));
                const opened = [...(hintedWords ?? [])].flatMap(h => byWord.get(h) ?? []);
                const closed = remaining.filter(w => !hintedWords?.has(w.word.toLowerCase()));
                return (
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        const w = closed[Math.floor(Math.random() * closed.length)];
                        if (w) onRevealHint?.(w.word);
                      }}
                      disabled={closed.length === 0}
                      className="text-xs font-bold text-amber-300/90 border border-amber-400/30 hover:bg-amber-500/10 rounded-full px-3 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ヒント（和訳）を1つ見る
                    </button>
                    {opened.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {opened.map(w => (
                          <span key={w.word} className="text-xs font-bold text-amber-200 bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 rounded-full animate-fade-up">
                            {w.translation || '（訳なし）'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
              {remaining.map(w => (
                <button
                  key={w.word}
                  onClick={() => onPlayWord(w.word)}
                  disabled={gameLoading}
                  className={`flex flex-col items-start px-3 py-2.5 rounded-xl bg-white/8 border border-white/10 text-left ${c.chipHover} transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between w-full gap-1 mb-0.5">
                    <span className="font-black text-sm text-white truncate">{w.word}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${LEVEL_BADGE[w.level] ?? 'bg-white/10 text-white/40'}`}>
                      {w.level.replace('Level ', 'Lv.')}
                    </span>
                  </div>
                  {w.translation && (
                    <span className="text-[11px] text-white/40 truncate w-full leading-tight">{w.translation}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {onRetire && !gameOver && (
        confirmRetire ? (
          <div className="self-center flex items-center gap-2 animate-fade-up">
            <span className="text-xs text-white/60">リタイアしますか？</span>
            <button
              onClick={() => { setConfirmRetire(false); onRetire(); }}
              disabled={gameLoading}
              className="text-xs font-bold text-white bg-rose-500/80 hover:bg-rose-500 rounded-full px-4 py-1.5 transition-colors disabled:opacity-40"
            >
              リタイアする
            </button>
            <button
              onClick={() => setConfirmRetire(false)}
              className="text-xs font-bold text-white/50 border border-white/10 hover:bg-white/10 rounded-full px-4 py-1.5 transition-colors"
            >
              続ける
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRetire(true)}
            disabled={gameLoading}
            className="self-center text-xs font-bold text-white/30 hover:text-rose-300 border border-white/10 hover:border-rose-400/40 rounded-full px-4 py-1.5 transition-colors disabled:opacity-30"
          >
            リタイア
          </button>
        )
      )}
    </div>
  );
}
