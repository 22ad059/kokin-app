type Variant = 'emerald' | 'violet' | 'amber';

const ORBS: Record<Variant, [string, string, string]> = {
  emerald: ['bg-emerald-600/15', 'bg-teal-600/15',  'bg-indigo-600/10'],
  violet:  ['bg-violet-600/15',  'bg-indigo-600/15', 'bg-purple-600/10'],
  amber:   ['bg-amber-600/15',   'bg-orange-600/15', 'bg-yellow-600/10'],
};

export default function PageShell({
  children,
  variant = 'emerald',
  contentKey,
}: {
  children: React.ReactNode;
  variant?: Variant;
  /** 値が変わるたびにコンテンツの入場アニメーションを再生する */
  contentKey?: string;
}) {
  const [a, b, c] = ORBS[variant];
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center px-4 py-10">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-grid-overlay" />
        <div className={`absolute -top-40 -right-40 w-96 h-96 ${a} rounded-full blur-3xl animate-float-a`} />
        <div className={`absolute -bottom-40 -left-40 w-96 h-96 ${b} rounded-full blur-3xl animate-float-b`} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 ${c} rounded-full blur-3xl`} />
      </div>
      <div key={contentKey} className="relative w-full max-w-sm animate-fade-up">{children}</div>
    </div>
  );
}
