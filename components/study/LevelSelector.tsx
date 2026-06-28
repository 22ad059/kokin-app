import { LEVELS } from '@/lib/constants';

type Variant = 'emerald' | 'violet' | 'amber';

const ACTIVE: Record<Variant, string> = {
  emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
  violet:  'from-violet-500 to-indigo-600 shadow-violet-500/20',
  amber:   'from-amber-500 to-orange-600 shadow-amber-500/20',
};
const LINK: Record<Variant, string> = {
  emerald: 'text-emerald-400/70 hover:text-emerald-400',
  violet:  'text-violet-400/70  hover:text-violet-400',
  amber:   'text-amber-400/70   hover:text-amber-400',
};

interface Props {
  selectedLevels: string[];
  onChange: (levels: string[]) => void;
  variant?: Variant;
}

export default function LevelSelector({ selectedLevels, onChange, variant = 'emerald' }: Props) {
  const allSelected = selectedLevels.length === LEVELS.length;

  const toggle = (lv: string) =>
    onChange(selectedLevels.includes(lv)
      ? selectedLevels.filter(l => l !== lv)
      : [...selectedLevels, lv]);

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">レベルを選択</p>
        <button
          onClick={() => onChange(allSelected ? [] : [...LEVELS])}
          className={`text-xs font-bold transition-colors ${LINK[variant]}`}
        >
          {allSelected ? '全解除' : '全選択'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {LEVELS.map(lv => {
          const active = selectedLevels.includes(lv);
          return (
            <button
              key={lv}
              onClick={() => toggle(lv)}
              className={`py-3 rounded-xl font-bold text-sm transition-all border ${
                active
                  ? `bg-gradient-to-br ${ACTIVE[variant]} text-white shadow-lg border-transparent`
                  : 'bg-white/5 text-white/30 hover:bg-white/10 border-white/10'
              }`}
            >
              Lv.{lv.split(' ')[1]}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-white/30 mt-3 text-center">
        {selectedLevels.length === 0
          ? 'レベルを選んでください'
          : `${selectedLevels.length} / ${LEVELS.length} レベル選択中`}
      </p>
    </div>
  );
}
