import type { ReactNode } from 'react';
import { Download, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Cartão com cabeçalho (título, descrição e ações à direita). */
export function Painel({
  titulo,
  descricao,
  acoes,
  children,
  className,
  semPadding,
}: {
  titulo?: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
  semPadding?: boolean;
}) {
  return (
    <section className={cn('overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm', className)}>
      {(titulo || acoes) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
          <div className="min-w-0">
            {titulo && <h3 className="text-sm font-semibold text-zinc-800">{titulo}</h3>}
            {descricao && <p className="mt-0.5 text-xs text-zinc-500">{descricao}</p>}
          </div>
          {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
        </header>
      )}
      <div className={semPadding ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

export function CampoBusca({
  valor,
  onChange,
  placeholder,
  className,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn('relative min-w-48 flex-1', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}

/** Abas em "pílula" (segmented control). */
export function Abas<T extends string>({
  valor,
  onChange,
  opcoes,
}: {
  valor: T;
  onChange: (v: T) => void;
  opcoes: { valor: T; label: ReactNode; contagem?: number }[];
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          className={cn(
            'flex-1 whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors sm:flex-none',
            valor === o.valor ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
          )}
        >
          {o.label}
          {o.contagem != null && <span className="ml-1 text-zinc-400">{o.contagem}</span>}
        </button>
      ))}
    </div>
  );
}

export function BotaoCsv({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
    >
      <Download className="h-4 w-4" />
      CSV
    </button>
  );
}
