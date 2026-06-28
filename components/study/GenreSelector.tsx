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
  genres: string[];
  selectedGenres: string[];
  onChange: (genres: string[]) => void;
  variant?: Variant;
}

export default function GenreSelector({ genres, selectedGenres, onChange, variant = 'emerald' }: Props) {
  const allSelected = genres.length > 0 && selectedGenres.length === genres.length;

  const toggle = (g: string) =>
    onChange(selectedGenres.includes(g)
      ? selectedGenres.filter(x => x !== g)
      : [...selectedGenres, g]);

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">ジャンルを選択</p>
        <button
          onClick={() => onChange(allSelected ? [] : [...genres])}
          className={`text-xs font-bold transition-colors ${LINK[variant]}`}
        >
          {allSelected ? '全解除' : '全選択'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {genres.map(genre => {
          const active = selectedGenres.includes(genre);
          return (
            <button
              key={genre}
              onClick={() => toggle(genre)}
              className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all border ${
                active
                  ? `bg-gradient-to-r ${ACTIVE[variant]} text-white shadow-lg border-transparent`
                  : 'bg-white/5 text-white/40 hover:bg-white/10 border-white/10'
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-white/30 mt-3 text-center">
        {selectedGenres.length === 0
          ? 'ジャンルを選んでください'
          : `${selectedGenres.length} / ${genres.length} ジャンル選択中`}
      </p>
    </div>
  );
}
