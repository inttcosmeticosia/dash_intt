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
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
      <div className="flex overflow-hidden rounded-lg border border-zinc-200">
        {presets.map((p) => {
          const alvo = periodoDe(p.dias);
          const ativo = periodo.inicio === alvo.inicio && periodo.fim === alvo.fim;
          return (
            <button
              key={p.label}
              onClick={() => setPeriodo(alvo)}
              className={cn(
                'px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3',
                ativo
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50'
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-none">
        <input
          type="date"
          value={periodo.inicio}
          onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm sm:flex-none sm:px-3"
        />
        <span className="text-zinc-400">até</span>
        <input
          type="date"
          value={periodo.fim}
          onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm sm:flex-none sm:px-3"
        />
      </div>
    </div>
  );
}
