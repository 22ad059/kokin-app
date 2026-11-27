'use client';
/**
 * 効果検証実験用の学習ページ（/experiment）
 *
 * 参加者 ID を入れる → ID 順の割り当てで語セットが決まる → 練習ゲームを 3 周
 * （1 周 = 入力して AI と出し合う → リタイア／締め切り → 出せなかった単語を 90 秒見る）→ 終了。
 * 周ごとの記録は端末に一時保存してからサーバーへ送る（通信が切れても後で再送する）。
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { WordEntry, PracticeMessage } from '@/types/study';
import PageShell from '@/components/study/PageShell';
import PracticeGame from '@/components/study/PracticeGame';
import WordCardGrid from '@/components/study/WordCardGrid';
import { sameWord } from '@/lib/wordMatch';
import { postJson } from '@/lib/postJson';
import {
  setForParticipant, isValidParticipantId, ROUNDS, INTRO_SEC, REVIEW_SEC, ROUND_DEADLINE_SEC,
  type ExperimentRecord, type ExperimentMove, type ExperimentRejected,
} from '@/lib/experiment';

type Phase = 'id' | 'demo' | 'confirm' | 'intro' | 'play' | 'review' | 'done';

/** デモで選べる語セット（ID 順の割り当てと同じ並び） */
const DEMO_SETS: { id: string; label: string }[] = [
  { id: 'nature', label: '自然・環境' },
  { id: 'science', label: '科学・技術' },
  { id: 'people', label: '職業・人物' },
  { id: 'health', label: '体・健康・医療' },
];
/** デモの時間: 短縮（4 倍速 = 約 5 分）か本番どおり（20 分） */
const DEMO_SPEEDS = [
  { speed: 4, label: '短縮（約 5 分）' },
  { speed: 1, label: '本番と同じ（20 分）' },
];
type SetInfo = { id: string; label: string; genre: string };

interface RoundData {
  id: string;
  round: number;
  startedAt: number;
  moves: ExperimentMove[];
  rejected: ExperimentRejected[];
  hinted: string[];
  score: number;
}

const OUTBOX_KEY = 'kokin-experiment-outbox';
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function readOutbox(): ExperimentRecord[] {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; }
}
function writeOutbox(records: ExperimentRecord[]) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(records)); } catch { /* 保存できなくても送信は試みる */ }
}

export default function ExperimentPage() {
  const [phase, setPhase] = useState<Phase>('id');
  const [pidInput, setPidInput] = useState('');
  const [pid, setPid] = useState<number | null>(null);
  const [setInfo, setSetInfo] = useState<SetInfo | null>(null);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [idError, setIdError] = useState('');
  const [loadingSet, setLoadingSet] = useState(false);

  const [round, setRound] = useState(1);
  const [history, setHistory] = useState<PracticeMessage[]>([]);
  const [hintedWords, setHintedWords] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [gameLoading, setGameLoading] = useState(false);
  const [gameError, setGameError] = useState('');
  const [reviewWords, setReviewWords] = useState<WordEntry[]>([]);
  const [deadlineAt, setDeadlineAt] = useState(0);
  const [reviewEndsAt, setReviewEndsAt] = useState(0);
  const [now, setNow] = useState(0);
  const [pending, setPending] = useState(0);
  // デモ（記録しない）。null なら本番の参加者
  const [demo, setDemo] = useState<{ speed: number } | null>(null);
  const [demoSpeed, setDemoSpeed] = useState(DEMO_SPEEDS[0].speed);

  // タイマーや送信処理から最新の値を読むための入れ物（描画には使わない）
  // speed: 時間の縮め倍率（デモの短縮と、開発中の ?fast= だけで使う。本番の参加者は常に 1）
  const session = useRef<{ id: string; startedAt: number; pid: number; set: string; words: WordEntry[]; speed: number; demo: boolean } | null>(null);
  const roundData = useRef<RoundData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outbox = useRef<ExperimentRecord[]>([]);
  const sending = useRef(false);

  // ── 記録の送信 ──
  const flush = useCallback(async () => {
    if (sending.current || outbox.current.length === 0) { setPending(outbox.current.length); return; }
    sending.current = true;
    const batch = outbox.current.slice(0, 50);
    try {
      const res = await fetch('/api/experiment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ records: batch }),
      });
      if (res.ok) {
        const sent = new Set(batch.map(r => r.id));
        outbox.current = outbox.current.filter(r => !sent.has(r.id));
        writeOutbox(outbox.current);
      }
    } catch { /* 次の再送で送る */ } finally {
      sending.current = false;
      setPending(outbox.current.length);
    }
  }, []);

  const queue = useCallback((rec: ExperimentRecord) => {
    if (session.current?.demo) return; // デモは記録しない
    outbox.current = [...outbox.current, rec];
    writeOutbox(outbox.current);
    setPending(outbox.current.length);
    void flush();
  }, [flush]);

  // 前回送れなかった記録の読み込みと、10 秒ごとの再送
  useEffect(() => {
    outbox.current = readOutbox();
    const first = setTimeout(() => void flush(), 0);
    const id = setInterval(() => void flush(), 10_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [flush]);

  // 残り時間の表示
  useEffect(() => {
    if (phase !== 'intro' && phase !== 'play' && phase !== 'review') return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [phase]);

  // 学習中にページを閉じようとしたら確認する
  useEffect(() => {
    if (phase !== 'intro' && phase !== 'play' && phase !== 'review') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const base = () => {
    const s = session.current!;
    return { id: uid(), sessionId: s.id, pid: s.pid, set: s.set, at: Date.now() };
  };

  // ── 周の進行 ──
  const finish = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    queue({ ...base(), kind: 'end' });
    setPhase('done');
  }, [queue]);

  const startRoundRef = useRef<(r: number) => void>(() => {});

  const endRound = useCallback((reason: 'retire' | 'time' | 'clear') => {
    const s = session.current, rd = roundData.current;
    if (!s || !rd) return;
    roundData.current = null; // 判定待ちの応答が後から届いても無視する
    if (timer.current) clearTimeout(timer.current);
    const endedAt = Date.now();
    const played = rd.moves.map(m => m.word);
    const remaining = s.words.filter(w => !played.some(p => sameWord(p, w.word)));
    // 出し切ったときは全語を見せる（どの周も一覧で全語に触れる条件をそろえる）
    const review = remaining.length ? remaining : s.words;
    queue({
      ...base(), kind: 'round', round: rd.round, startedAt: rd.startedAt, endedAt, endReason: reason,
      moves: rd.moves, rejected: rd.rejected, hinted: rd.hinted, reviewWords: review.map(w => w.word), score: rd.score,
    });
    setReviewWords(review);
    setGameLoading(false);
    setGameError('');
    const reviewMs = (REVIEW_SEC * 1000) / s.speed;
    setReviewEndsAt(endedAt + reviewMs);
    setNow(endedAt);
    setPhase('review');
    timer.current = setTimeout(() => {
      if (rd.round < ROUNDS) startRoundRef.current(rd.round + 1);
      else finish();
    }, reviewMs);
  }, [queue, finish]);

  const startRound = useCallback((r: number) => {
    const s = session.current;
    if (!s) return;
    const t = Date.now();
    roundData.current = { id: uid(), round: r, startedAt: t, moves: [], rejected: [], hinted: [], score: 0 };
    const deadline = s.startedAt + (ROUND_DEADLINE_SEC[r - 1] * 1000) / s.speed;
    setRound(r);
    setHistory([]);
    setHintedWords(new Set());
    setScore(0);
    setGameError('');
    setGameLoading(false);
    setDeadlineAt(deadline);
    setNow(t);
    setPhase('play');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => endRound('time'), Math.max(0, deadline - t));
  }, [endRound]);

  useEffect(() => { startRoundRef.current = startRound; }, [startRound]);

  // ── ID 入力・確認 ──
  // 語セットを読み込んで確認画面へ。pid は本番の参加者 ID、デモでは 0
  const loadSet = async (setId: string, n: number, demoOpt: { speed: number } | null) => {
    setIdError('');
    setLoadingSet(true);
    try {
      const res = await fetch(`/api/words?set=${encodeURIComponent(setId)}`);
      const d = await res.json();
      if (!res.ok || !d.set) { setIdError(d?.error || '語セットを読み込めませんでした。'); return; }
      setPid(n);
      setDemo(demoOpt);
      setSetInfo(d.set);
      setWords(d.words ?? []);
      setPhase('confirm');
    } catch {
      setIdError('通信エラーが発生しました。もう一度お試しください。');
    } finally { setLoadingSet(false); }
  };

  const submitId = () => {
    const n = Number(pidInput.trim());
    if (!isValidParticipantId(n)) { setIdError('参加者 ID は 1〜9999 の整数で入力してください。'); return; }
    void loadSet(setForParticipant(n), n, null);
  };

  const backToStart = () => {
    if (timer.current) clearTimeout(timer.current);
    session.current = null;
    roundData.current = null;
    setDemo(null);
    setSetInfo(null);
    setPid(null);
    setPidInput('');
    setIdError('');
    setPhase('id');
  };

  const startSession = () => {
    if (pid === null || !setInfo) return;
    const fast = Number(new URLSearchParams(window.location.search).get('fast'));
    const devSpeed = process.env.NODE_ENV !== 'production' && fast > 1 ? fast : 1;
    const speed = demo ? demo.speed : devSpeed;
    const t = Date.now();
    session.current = { id: uid(), startedAt: t, pid, set: setInfo.id, words, speed, demo: !!demo };
    queue({ ...base(), kind: 'start' });
    // 最初に 18 語すべての一覧を見せてから 1 周目に入る
    const introMs = (INTRO_SEC * 1000) / speed;
    setReviewWords(words);
    setReviewEndsAt(t + introMs);
    setNow(t);
    setRound(1);
    setPhase('intro');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => startRoundRef.current(1), introMs);
  };

  // ── 単語を出す ──
  const levels = [...new Set(words.map(w => w.level))].sort();
  const playWord = useCallback(async (word: string): Promise<boolean> => {
    const rd = roundData.current;
    if (!rd || gameLoading) return false;
    setGameError('');
    setGameLoading(true);
    try {
      // 通信が一時的に切れたときは自動で送り直す
      const res = await postJson('/api/game', {
        userWord: word,
        history: history.map(h => h.word),
        mode: 'solo',
        practiceWords: words.map(w => w.word),
        practiceGenres: setInfo ? [setInfo.genre] : [],
        practiceLevels: levels,
        practiceFixed: true,
      });
      const data = res.data;
      if (roundData.current !== rd) return false; // 判定中に周が終わった
      if (!res.ok || typeof data?.is_valid !== 'boolean') {
        setGameError(data?.error || '通信エラーが発生しました。もう一度「送信」を押してください。');
        return false;
      }
      const at = Date.now();
      if (!data.is_valid) {
        rd.rejected.push({ typed: word, reason: String(data.reason || ''), at });
        setGameError(data.reason || 'その単語は使えません。');
        return false;
      }
      const played: string = data.corrected_word || word;
      const hinted = [...hintedWords].some(h => sameWord(h, played));
      const entries: PracticeMessage[] = [{
        word: played,
        typedAs: data.corrected_word ? data.typed_word : undefined,
        translation: data.is_synonym ? '類義語ボーナス x2!' : data.is_antonym ? '対義語ボーナス x2!' : (data.user_word_jp || ''),
        isUser: true, level: data.jacet_level, score: data.score, hinted,
      }];
      rd.moves.push({ word: played, by: 'user', at, level: data.jacet_level, hinted, typedAs: data.corrected_word ? data.typed_word : undefined });
      if (data.ai_response) {
        entries.push({ word: data.ai_response, translation: data.ai_response_jp || '', isUser: false, level: data.ai_jacet_level, score: 0 });
        rd.moves.push({ word: data.ai_response, by: 'ai', at, level: data.ai_jacet_level });
      }
      rd.score += data.score || 0;
      const next = [...history, ...entries];
      setHistory(next);
      setScore(rd.score);
      if (words.every(w => next.some(h => sameWord(h.word, w.word)))) endRound('clear');
      return true;
    } catch {
      if (roundData.current === rd) setGameError('通信エラーが発生しました。もう一度お試しください。');
      return false;
    } finally {
      if (roundData.current === rd) setGameLoading(false);
    }
  }, [gameLoading, history, words, setInfo, levels, hintedWords, endRound]);

  const revealHint = (w: string) => {
    setHintedWords(prev => new Set(prev).add(w.toLowerCase()));
    const rd = roundData.current;
    if (rd && !rd.hinted.includes(w)) rd.hinted.push(w);
  };

  // ── 画面 ──
  if (phase === 'id') {
    return (
      <PageShell variant="amber" contentKey={phase}>
        <div className="flex flex-col gap-4 pt-10">
          <h1 className="text-2xl font-black text-white text-center">英単語の学習</h1>
          <p className="text-white/50 text-sm text-center">監督者の指示に従って、参加者 ID を入力してください。</p>
          <input
            inputMode="numeric"
            value={pidInput}
            onChange={e => setPidInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && submitId()}
            placeholder="参加者 ID（例: 12）"
            className="w-full bg-white/10 border border-white/10 rounded-2xl px-4 py-3 outline-none text-white text-lg font-bold text-center placeholder:text-white/20 focus:border-amber-400/60"
            autoFocus
          />
          {idError && <p role="alert" className="text-rose-300 text-sm font-bold text-center">{idError}</p>}
          <button onClick={submitId} disabled={loadingSet || !pidInput.trim()}
            className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-amber-500 to-orange-600 disabled:opacity-30 active:scale-95 transition-all">
            {loadingSet ? '読み込み中...' : '決定'}
          </button>
          {pending > 0 && <p className="text-xs text-amber-200/70 text-center">前回の記録が {pending} 件未送信です（自動で再送します）</p>}
          <button onClick={() => { setIdError(''); setPhase('demo'); }}
            className="mt-6 mx-auto px-4 py-2 rounded-full text-sm font-bold text-white/60 bg-white/5 border border-white/15 hover:text-white">
            デモで試す（記録しません）
          </button>
        </div>
      </PageShell>
    );
  }

  if (phase === 'demo') {
    return (
      <PageShell variant="amber" contentKey={phase}>
        <div className="flex flex-col gap-4 pt-10">
          <h1 className="text-2xl font-black text-white text-center">デモ</h1>
          <p className="text-white/50 text-sm text-center">本番と同じ流れで試せます。記録はサーバーに送りません。</p>
          <div>
            <p className="text-white/40 text-xs font-bold mb-2">時間</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_SPEEDS.map(o => (
                <button key={o.speed} onClick={() => setDemoSpeed(o.speed)} aria-pressed={demoSpeed === o.speed}
                  className={`py-3 rounded-2xl text-sm font-bold border transition-colors ${demoSpeed === o.speed
                    ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                    : 'bg-white/5 border-white/10 text-white/50'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-white/40 text-xs font-bold mb-2">語セット（押すと始まります）</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_SETS.map(s => (
                <button key={s.id} disabled={loadingSet} onClick={() => void loadSet(s.id, 0, { speed: demoSpeed })}
                  className="py-4 rounded-2xl font-black text-white bg-gradient-to-r from-amber-500 to-orange-600 disabled:opacity-30 active:scale-95 transition-all">
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {idError && <p role="alert" className="text-rose-300 text-sm font-bold text-center">{idError}</p>}
          <button onClick={backToStart} className="text-white/40 text-sm font-bold">← ID 入力に戻る</button>
        </div>
      </PageShell>
    );
  }

  if (phase === 'confirm' && setInfo) {
    return (
      <PageShell variant="amber" contentKey={phase}>
        <div className="flex flex-col gap-5 pt-10">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
            {demo ? (
              <>
                <p className="text-white text-3xl font-black">デモ</p>
                <p className="text-white/50 text-xs mt-1">
                  記録しません · {DEMO_SPEEDS.find(o => o.speed === demo.speed)?.label ?? `${demo.speed} 倍速`}
                </p>
              </>
            ) : (
              <>
                <p className="text-white/50 text-sm">参加者 ID</p>
                <p className="text-white text-3xl font-black">{pid}</p>
              </>
            )}
            <p className="text-white/50 text-sm mt-4">語セット</p>
            <p className="text-amber-300 text-2xl font-black">{setInfo.genre}</p>
            <p className="text-white/40 text-xs mt-1">{words.length} 語</p>
          </div>
          <p className="text-white/60 text-sm text-center leading-relaxed">
            {demo ? (
              <>本番と同じ流れで 3 周します。<br />「学習を始める」を押すと始まります。</>
            ) : (
              <>
                テスト用紙の「語セット」欄と同じ分野か確認してください。<br />
                監督者の合図があったら「学習を始める」を押してください（20 分）。
              </>
            )}
          </p>
          <button onClick={startSession}
            className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-amber-500 to-orange-600 active:scale-95 transition-all">
            学習を始める
          </button>
          <button onClick={backToStart} className="text-white/40 text-sm font-bold">
            {demo ? '最初に戻る' : 'ID を入れ直す'}
          </button>
        </div>
      </PageShell>
    );
  }

  if (phase === 'intro' || phase === 'review') {
    const intro = phase === 'intro';
    const last = round >= ROUNDS;
    return (
      <PageShell variant="amber" contentKey={intro ? 'intro' : `review-${round}`}>
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <p className="text-white/50 text-sm font-bold">
              {demo && <span className="text-amber-300">デモ · </span>}
              {intro ? `これから学習する ${words.length} 語` : `${round} / ${ROUNDS} 周目　終了`}
            </p>
            {setInfo && (
              <p className="mt-2 inline-block px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 text-sm font-black">
                テーマ：{setInfo.genre}
              </p>
            )}
            <h2 className="text-white text-xl font-black mt-2">{intro ? 'まずは単語を覚えよう' : '出せなかった単語を覚えよう'}</h2>
            <p className="text-amber-300 text-4xl font-black tabular-nums mt-2">{mmss(reviewEndsAt - now)}</p>
            <p className="text-white/40 text-xs mt-1">
              {intro ? '時間になると 1 周目が始まります'
                : last ? '時間になると学習は終了します' : '時間になると自動で次の周が始まります'}
            </p>
          </div>
          <WordCardGrid words={reviewWords} />
        </div>
      </PageShell>
    );
  }

  if (phase === 'done') {
    return (
      <PageShell variant="amber" contentKey={phase}>
        <div className="flex flex-col gap-4 pt-16 text-center">
          <h2 className="text-white text-2xl font-black">学習はこれで終わりです</h2>
          {demo ? (
            <>
              <p className="text-white/60 text-sm">デモなので記録はしていません。</p>
              <button onClick={backToStart} className="mx-auto px-5 py-3 rounded-2xl text-sm font-black text-white bg-gradient-to-r from-amber-500 to-orange-600">
                最初に戻る
              </button>
            </>
          ) : (
            <>
              <p className="text-white/60 text-sm">画面はこのままにして、監督者の指示を待ってください。</p>
              <p className={`text-xs font-bold ${pending ? 'text-rose-300' : 'text-emerald-300/80'}`}>
                {pending ? `記録 ${pending} 件が未送信です（自動で再送しています）` : '記録はすべて送信済みです'}
              </p>
            </>
          )}
          {!demo && pending > 0 && (
            <button onClick={() => void flush()} className="mx-auto px-4 py-2 rounded-full text-sm font-bold text-white bg-white/10 border border-white/20">
              今すぐ再送する
            </button>
          )}
        </div>
      </PageShell>
    );
  }

  // play
  return (
    <PageShell variant="amber" contentKey={`play-${round}`}>
      <PracticeGame
        wordList={words}
        history={history}
        score={score}
        gameOver={false}
        gameOverReason=""
        gameLoading={gameLoading}
        errorMsg={gameError}
        onPlayWord={playWord}
        onRestart={() => {}}
        // 3 周目は締め切りまで続けるのでリタイアを出さない
        onRetire={round < ROUNDS ? () => endRound('retire') : undefined}
        headerNote={<span>{demo && <span className="text-amber-300">デモ · </span>}{round} / {ROUNDS} 周目 · 残り <span className="tabular-nums">{mmss(deadlineAt - now)}</span></span>}
        variant="amber"
        inputMode
        hintedWords={hintedWords}
        onRevealHint={revealHint}
        genres={setInfo ? [setInfo.genre] : []}
        levels={levels}
      />
    </PageShell>
  );
}
