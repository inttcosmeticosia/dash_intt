import { cn } from '@/lib/utils';

/** Ranking simples em lista: nome, barra proporcional e número. Mais legível que gráfico para top-N. */
export function RankingLista({
  itens,
  cor = 'bg-brand-500',
  vazio = 'Sem dados no período',
  limite = 8,
  onSelecionar,
  selecionado,
}: {
  itens: { nome: string; total: number; detalhe?: string }[];
  cor?: string;
  vazio?: string;
  limite?: number;
  onSelecionar?: (nome: string) => void;
  selecionado?: string;
}) {
  if (!itens.length) return <p className="py-6 text-center text-sm text-zinc-400">{vazio}</p>;
  const max = Math.max(...itens.map((i) => i.total));
  const soma = itens.reduce((s, i) => s + i.total, 0);
  const visiveis = itens.slice(0, limite);
  const resto = itens.slice(limite).reduce((s, i) => s + i.total, 0);

  return (
    <ol className="space-y-2.5">
      {visiveis.map((i, idx) => {
        const ativo = selecionado === i.nome;
        const conteudo = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={cn('truncate', ativo ? 'font-semibold text-brand-700' : 'text-zinc-700')}>
                <span className="mr-1.5 inline-block w-4 text-right text-xs text-zinc-400">{idx + 1}</span>
                {i.nome}
                {i.detalhe && <span className="ml-1.5 text-xs text-zinc-400">{i.detalhe}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-zinc-500">
                <b className="font-semibold text-zinc-900">{i.total}</b>
                <span className="ml-1 text-xs">{Math.round((i.total / soma) * 100)}%</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div className={cn('h-full rounded-full', cor)} style={{ width: `${(i.total / max) * 100}%` }} />
            </div>
          </>
        );
        return (
          <li key={i.nome}>
            {onSelecionar ? (
              <button
                type="button"
                onClick={() => onSelecionar(ativo ? '' : i.nome)}
                className="block w-full rounded-md text-left hover:bg-zinc-50"
                title={ativo ? 'Limpar filtro' : 'Filtrar a lista por este item'}
              >
                {conteudo}
              </button>
            ) : (
              conteudo
            )}
          </li>
        );
      })}
      {resto > 0 && (
        <li className="pl-6 text-xs text-zinc-400">
          + {itens.length - limite} outros ({resto})
        </li>
      )}
    </ol>
  );
}
