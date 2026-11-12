import type { ReactNode } from 'react';
import { cn, formatPercent } from '@/lib/utils';

export type Stat = {
  label: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  /** variação % vs período anterior */
  trend?: number | null;
  tom?: 'normal' | 'alerta' | 'marca';
};

/** Faixa de números lado a lado, num cartão só (substitui vários KpiCards soltos). */
export function StatStrip({ itens, className }: { itens: Stat[]; className?: string }) {
  const cols: Record<number, string> = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-3 lg:grid-cols-5',
  };
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 shadow-sm',
        cols[itens.length] ?? 'sm:grid-cols-2 lg:grid-cols-4',
        className
      )}
    >
      {itens.map((i) => (
        <div key={i.label} className="bg-white px-4 py-3.5">
          <p className="text-xs font-medium text-zinc-500">{i.label}</p>
          <p
            className={cn(
              'mt-1 truncate text-2xl font-semibold tracking-tight',
              i.tom === 'alerta' ? 'text-red-600' : i.tom === 'marca' ? 'text-brand-600' : 'text-zinc-900'
            )}
          >
            {i.valor}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
            {i.trend != null && (
              <span className={cn('font-medium', i.trend > 0 ? 'text-emerald-600' : i.trend < 0 ? 'text-red-500' : '')}>
                {formatPercent(i.trend)}
              </span>
            )}
            {i.detalhe && <span className="truncate">{i.detalhe}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
