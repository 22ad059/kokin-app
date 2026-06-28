export const LEVELS = [
  'Level 1', 'Level 2', 'Level 3', 'Level 4',
  'Level 5', 'Level 6', 'Level 7', 'Level 8',
] as const;

export type Level = typeof LEVELS[number];

/** border 付きバッジ（一覧・結果画面） */
export const LEVEL_COLORS: Record<string, string> = {
  'Level 1': 'bg-sky-500/20 text-sky-300 border-sky-400/30',
  'Level 2': 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  'Level 3': 'bg-lime-500/20 text-lime-300 border-lime-400/30',
  'Level 4': 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
  'Level 5': 'bg-orange-500/20 text-orange-300 border-orange-400/30',
  'Level 6': 'bg-red-500/20 text-red-300 border-red-400/30',
  'Level 7': 'bg-purple-500/20 text-purple-300 border-purple-400/30',
  'Level 8': 'bg-slate-500/20 text-slate-300 border-slate-400/30',
  'Unknown': 'bg-white/10 text-white/40 border-white/10',
};

/** border なしバッジ（チャットバブル内） */
export const LEVEL_BADGE: Record<string, string> = {
  'Level 1': 'bg-sky-400/30 text-sky-200',
  'Level 2': 'bg-emerald-400/30 text-emerald-200',
  'Level 3': 'bg-lime-400/30 text-lime-200',
  'Level 4': 'bg-yellow-400/30 text-yellow-200',
  'Level 5': 'bg-orange-400/30 text-orange-200',
  'Level 6': 'bg-red-400/30 text-red-200',
  'Level 7': 'bg-purple-400/30 text-purple-200',
  'Level 8': 'bg-slate-400/30 text-slate-200',
};
