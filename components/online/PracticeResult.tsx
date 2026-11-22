'use client';
import type { PlayerNo, RoomState } from '@/lib/online';
import { playerLabel } from '@/lib/online';
import { sameWord } from '@/lib/wordMatch';
import WordCardGrid from '@/components/study/WordCardGrid';
import { ResultButtons } from '@/components/online/BattleResult';

interface Props {
  room: RoomState;
  myPlayer: PlayerNo;
  onRematch: () => void;
  onToLobby: () => void;
  onLeave: () => void;
}

/** オンライン練習ゲームの結果（協力: チームの成績 / 競争: 順位）と、出せなかった単語 */
export default function PracticeResult({ room, myPlayer, onRematch, onToLobby, onLeave }: Props) {
  const coop = room.settings.practiceMode === 'coop';
  const players = room.players.filter(p => p.inGame);
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const remaining = room.wordList.filter(w => !room.history.some(h => sameWord(h.word, w.word)));
  const used = room.wordList.length - remaining.length;
  const hintUsed = room.history.filter(h => h.hinted).length;
  const spellFixed = room.history.filter(h => h.typedAs).length;
  const here = room.players.filter(p => p.connected).length;

  const title = coop
    ? (room.cleared ? 'クリア！' : 'おつかれさま！')
    : room.winner === null ? '引き分け' : room.winner === myPlayer ? 'あなたの勝ち！' : `${playerLabel(room.winner, myPlayer)}の勝ち！`;

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
        <div className="px-6 pt-8 pb-5 text-center bg-gradient-to-b from-amber-500/20 to-transparent">
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">
            練習ゲーム・{coop ? '協力' : '競争'}／{room.settings.genres.join('・')}
          </p>
          <p className="text-2xl font-black text-white">{title}</p>
          {room.reason && <p className="text-sm text-white/50 mt-3">{room.reason}</p>}
          <p className="text-sm text-white/70 mt-3">
            {used} / {room.wordList.length} 語を出しました{coop && hintUsed > 0 ? `（うちヒント ${hintUsed} 語）` : ''}
          </p>
          <p className="text-xs text-white/50 mt-1">
            つづり修正 {spellFixed} 回
          </p>
        </div>

        {/* 一人ひとりの成績 */}
        <ol className="px-5 pb-5 flex flex-col gap-1.5">
          {(coop ? players : ranked).map((p, i) => (
            <li key={p.no} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border ${
              !coop && i === 0 && room.winner !== null ? 'bg-amber-500/15 border-amber-400/40' : 'bg-white/5 border-white/10'
            }`}>
              {!coop && <span className="w-6 text-center font-black text-white/60 tabular-nums">{i + 1}</span>}
              <p className="flex-1 font-black text-white text-sm">{playerLabel(p.no, myPlayer)}</p>
              <p className="text-xs text-white/50">{p.words} 語{p.spellFixes > 0 ? `・つづり修正 ${p.spellFixes}` : ''}{p.misses > 0 ? `・ミス ${p.misses}` : ''}</p>
              <p className="font-black text-white tabular-nums w-16 text-right">{p.score}<span className="text-[10px] text-white/40 ml-0.5">pt</span></p>
            </li>
          ))}
        </ol>

        {remaining.length > 0 && (
          <div className="px-5 pb-5">
            <p className="text-xs font-bold text-white/40 mb-2">出せなかった単語 {remaining.length} 語</p>
            <div className="max-h-80 overflow-y-auto pr-1">
              <WordCardGrid words={remaining} />
            </div>
          </div>
        )}
      </div>

      <ResultButtons myPlayer={myPlayer} here={here} onRematch={onRematch} onToLobby={onToLobby} onLeave={onLeave} />
    </div>
  );
}
