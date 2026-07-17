'use client';

import { useFilters } from '@/contexts/FilterContext';
import { cn } from '@/lib/utils';

const presets = [
  { label: 'Hoje', dias: 0 },
  { label: '7d', dias: 6 },
  { label: '30d', dias: 29 },
  { label: '90d', dias: 89 },
];

function periodoDe(dias: number) {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - dias);
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  };
}

export function PeriodFilter() {
  const { periodo, setPeriodo } = useFilters();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
        {presets.map((p) => {
          const alvo = periodoDe(p.dias);
          const ativo = periodo.inicio === alvo.inicio && periodo.fim === alvo.fim;
          return (
            <button
              key={p.label}
              onClick={() => setPeriodo(alvo)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                ativo
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <input
        type="date"
        value={periodo.inicio}
        onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <span className="text-zinc-400">até</span>
      <input
        type="date"
        value={periodo.fim}
        onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
    </div>
  );
}
