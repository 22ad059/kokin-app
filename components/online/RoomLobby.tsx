'use client';
import { useEffect, useRef, useState } from 'react';
import type { PlayerNo, RoomSettings, RoomState } from '@/lib/online';
import { MAX_PLAYERS, playerLabel } from '@/lib/online';
import { TurnRuleSelector, ThemeCard, LimitsCard } from '@/components/RuleSettings';
import LevelSelector from '@/components/study/LevelSelector';
import GenreSelector from '@/components/study/GenreSelector';

interface Props {
  room: RoomState;
  myPlayer: PlayerNo;
  errorMsg: string;
  onSettings: (s: RoomSettings) => void;
  onStart: () => void;
  onLeave: () => void;
}

/** 部屋の中: 部屋主がルールを決め、2人以上そろったら開始する */
export default function RoomLobby({ room, myPlayer, errorMsg, onSettings, onStart, onLeave }: Props) {
  const s = room.settings;
  const isHost = myPlayer === 1;
  const [copied, setCopied] = useState(false);
  // 入力中のテーマ（送信を少し待ってまとめる）。遅れて送るときは最新のルールと合わせる
  const [themeDraft, setThemeDraft] = useState<string | null>(null);
  const themeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(s);
  useEffect(() => { latest.current = s; }, [s]);
  const [allGenres, setAllGenres] = useState<string[]>([]);

  // 練習ゲームのジャンル一覧
  useEffect(() => {
    if (!isHost) return;
    fetch('/api/words?limit=1')
      .then(r => r.json())
      .then(d => {
        const all: string[] = d.genres ?? [];
        setAllGenres([...all.filter(g => g !== 'その他'), ...all.filter(g => g === 'その他')]);
      })
      .catch(() => {});
  }, [isHost]);

  const themeValue = themeDraft ?? s.theme;
  const send = (patch: Partial<RoomSettings>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    onSettings(next);
  };
  const update = (patch: Partial<RoomSettings>) => send({ theme: themeValue, ...patch });
  const onThemeChange = (v: string) => {
    setThemeDraft(v);
    clearTimeout(themeTimer.current);
    themeTimer.current = setTimeout(() => send({ theme: v }), 400);
  };

  const here = room.players.filter(p => p.connected);
  const enoughPlayers = here.length >= 2;
  const battle = s.gameType === 'battle';
  const rulesReady = battle ? !!themeValue.trim() : s.levels.length > 0 && s.genres.length > 0;
  const canStart = enoughPlayers && rulesReady && !room.starting;
  const startLabel = room.starting
    ? (battle ? 'お題を準備中...' : '単語リストを準備中...')
    : !enoughPlayers ? 'あと1人以上の参加を待っています'
      : !rulesReady ? (battle ? 'テーマを決めてください' : 'レベルとジャンルを選んでください')
        : `${here.length}人で${battle ? '対戦' : '練習'}開始！`;

  const start = () => {
    clearTimeout(themeTimer.current);
    if (themeValue !== s.theme) send({ theme: themeValue });
    onStart();
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* コピーできない環境では何もしない */ }
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
      <button onClick={onLeave} className="self-start inline-flex items-center gap-1 text-white/40 hover:text-white/70 text-sm font-medium transition-colors">
        ← {isHost ? '部屋を閉じる' : '部屋を出る'}
      </button>

      {/* 部屋コードと参加者 */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 text-center">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">部屋コード</p>
        <button onClick={copyCode} className="mt-1 text-5xl font-black tracking-[0.3em] text-white tabular-nums pl-[0.3em] hover:text-rose-200 transition-colors" title="押すとコピー">
          {room.code}
        </button>
        <p className="text-[11px] text-white/40 h-4">{copied ? 'コピーしました' : isHost ? 'みんなにこのコードを伝えてください（押すとコピー）' : ''}</p>
        <p className="text-[11px] font-bold text-white/40 mt-3 mb-1.5">参加者 {here.length} / {MAX_PLAYERS}人</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {room.players.map(p => (
            <span key={p.no} className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
              p.connected ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200' : 'bg-white/5 border-white/10 text-white/40'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${p.connected ? 'bg-emerald-400' : 'bg-white/30 animate-pulse'}`} />
              {playerLabel(p.no, myPlayer)}{p.no === 1 ? '（部屋主）' : ''}{p.connected ? '' : ' 接続待ち'}
            </span>
          ))}
          {room.players.length < 2 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border border-dashed border-white/15 text-white/30">
              参加を待っています…
            </span>
          )}
        </div>
      </div>

      {isHost ? (
        <>
          {/* 遊び方 */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">ルールを決める</p>
            <p className="text-[11px] text-white/30 mb-3">変えた内容はみんなの画面にもすぐ表示されます</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: 'battle', label: '対戦ゲーム', sub: 'テーマで古今東西' },
                { v: 'practice', label: '練習ゲーム', sub: '単語リストを出し合う' },
              ] as const).map(o => (
                <button
                  key={o.v}
                  onClick={() => update({ gameType: o.v })}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                    s.gameType === o.v ? 'bg-rose-500/25 border-rose-400/50 text-rose-200' : 'bg-white/5 text-white/40 hover:bg-white/10 border-white/10'
                  }`}
                >
                  <div>{o.label}</div>
                  <div className="text-[10px] opacity-60 mt-0.5 font-medium">{o.sub}</div>
                </button>
              ))}
            </div>
            {battle ? (
              <>
                <TurnRuleSelector isOvertake={s.isOvertake} setIsOvertake={v => update({ isOvertake: v })} />
                <p className="text-[11px] text-white/30 mt-3">テーマ外の単語や時間切れで脱落。最後に残った1人の勝ち。</p>
              </>
            ) : (
              <div className="mt-4">
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">遊び方</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'coop', label: '協力', sub: 'みんなで出し切る' },
                    { v: 'compete', label: '競争', sub: '点数で勝負' },
                  ] as const).map(o => (
                    <button
                      key={o.v}
                      onClick={() => update({ practiceMode: o.v })}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                        s.practiceMode === o.v ? 'bg-amber-500/25 border-amber-400/50 text-amber-200' : 'bg-white/5 text-white/40 hover:bg-white/10 border-white/10'
                      }`}
                    >
                      <div>{o.label}</div>
                      <div className="text-[10px] opacity-60 mt-0.5 font-medium">{o.sub}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-white/30 mt-2">
                  {s.practiceMode === 'coop'
                    ? '順番に英単語を出して、選んだレベル・ジャンルの単語をみんなで出し切ったらクリア。和訳ヒントも使える。'
                    : '順番に英単語を出して点数を競う。リストを出し切るか、だれかがリタイアしたら終わり。'}
                </p>
              </div>
            )}
          </div>

          {battle ? (
            <>
              <ThemeCard theme={themeValue} setTheme={onThemeChange} onEnter={() => canStart && start()} autoFocus={false} />
              <LimitsCard
                charLimit={s.charLimit} setCharLimit={v => update({ charLimit: v })}
                posLimit={s.posLimit} setPosLimit={v => update({ posLimit: v })}
                timeLimit={s.timeLimit} setTimeLimit={v => update({ timeLimit: v })}
              />
            </>
          ) : (
            <>
              <LevelSelector selectedLevels={s.levels} onChange={levels => update({ levels })} variant="amber" />
              <GenreSelector genres={allGenres} selectedGenres={s.genres} onChange={genres => update({ genres })} variant="amber" />
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
                <LimitsCard
                  onlyTime
                  charLimit={null} setCharLimit={() => {}}
                  posLimit={null} setPosLimit={() => {}}
                  timeLimit={s.timeLimit} setTimeLimit={v => update({ timeLimit: v })}
                />
              </div>
            </>
          )}

          {errorMsg && <p role="alert" className="text-sm font-bold text-rose-300 text-center">{errorMsg}</p>}
          <button
            onClick={start}
            disabled={!canStart}
            className={`w-full py-4 rounded-2xl font-black text-white text-lg shadow-xl transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r ${
              battle ? 'from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500' : 'from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500'
            }`}
          >
            {startLabel}
          </button>
        </>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-sm font-bold text-white/70">
              {room.starting ? 'まもなく始まります…' : '部屋主がルールを決めています…'}
            </span>
          </div>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest mt-5 mb-2">今のルール</p>
          <RulesSummary settings={s} />
          <p className="text-[11px] text-white/30 mt-4">部屋主が開始を押すと始まります</p>
        </div>
      )}
    </div>
  );
}

/** ルールの要約（参加者の画面・結果画面用） */
export function RulesSummary({ settings: s }: { settings: RoomSettings }) {
  const battle = s.gameType === 'battle';
  const items = battle
    ? [
      s.isOvertake ? 'スコアモード' : '交互',
      s.posLimit ? `品詞 ${s.posLimit}` : '',
      s.charLimit !== null ? `${s.charLimit}文字` : '',
      s.timeLimit !== null ? `1手 ${s.timeLimit}秒` : '',
    ]
    : [
      s.practiceMode === 'coop' ? '協力' : '競争',
      ...s.levels.map(l => l.replace('Level ', 'Lv.')),
      s.timeLimit !== null ? `1手 ${s.timeLimit}秒` : '',
    ];
  return (
    <div>
      <p className="text-[11px] font-bold text-white/40">{battle ? '対戦ゲーム' : '練習ゲーム'}</p>
      <p className="text-2xl font-black text-white mt-0.5">
        {battle ? (s.theme || 'テーマ未定') : (s.genres.length ? s.genres.join('・') : 'ジャンル未定')}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5 mt-3">
        {items.filter(Boolean).map(t => (
          <span key={t} className="text-[11px] font-bold text-white/60 bg-white/10 border border-white/10 px-2.5 py-0.5 rounded-full">{t}</span>
        ))}
      </div>
    </div>
  );
}
