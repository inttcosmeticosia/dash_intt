'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { KpiCardNumber, KpiCard } from '@/components/KpiCard';
import { BarChartCard, DataTable, SERIES } from '@/components/charts';
import { useFilters } from '@/contexts/FilterContext';
import { downloadCsv, formatNumber } from '@/lib/utils';
import { getProdutosMencionados, type ProdutoMencionado } from '@/services/analytics';

export default function ProdutosPage() {
  const { periodo } = useFilters();
  const [produtos, setProdutos] = useState<ProdutoMencionado[] | null>(null);
  const [incluirCategorias, setIncluirCategorias] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setProdutos(null);
    getProdutosMencionados(periodo, { incluirCategorias, limite: 100 })
      .then((r) => {
        if (!ativo) return;
        setProdutos(r);
        setErro(null);
      })
      .catch((e) => {
        console.error(e);
        if (ativo) setErro('Não foi possível carregar os dados. Verifique sua conexão e tente novamente.');
      });
    return () => {
      ativo = false;
    };
  }, [periodo, incluirCategorias]);

  if (erro) return <div className="text-red-500">{erro}</div>;
  if (!produtos) return <div className="text-zinc-400">Carregando...</div>;

  const lista = produtos;
  const especificos = lista.filter((p) => !p.eh_categoria);
  const totalConversas = lista.reduce((acc, p) => acc + Number(p.conversas), 0);
  const top = lista[0];
  const ranking = lista.slice(0, 15).map((p) => ({ produto: p.produto, conversas: Number(p.conversas) }));

  function exportar() {
    downloadCsv(
      `produtos_mencionados_${periodo.inicio}_${periodo.fim}.csv`,
      ['Produto', 'Conversas', 'Nas Mensagens', 'Nos Resumos', 'Tipo'],
      lista.map((p) => [
        p.produto,
        p.conversas,
        p.em_mensagens,
        p.em_resumos,
        p.eh_categoria ? 'Categoria' : 'Produto específico',
      ])
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardNumber label="Produtos/Termos Citados" value={lista.length} />
        <KpiCardNumber label="Produtos Específicos" value={especificos.length} />
        <KpiCardNumber label="Conversas com Menção" value={totalConversas} subtitle="soma por produto" />
        <KpiCard
          label="Mais Citado"
          value={top?.produto ?? '—'}
          subtitle={top ? `${formatNumber(Number(top.conversas))} conversas` : undefined}
        />
      </div>

      <div className="flex items-center justify-end">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={incluirCategorias}
            onChange={(e) => setIncluirCategorias(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
          />
          Incluir termos genéricos (lubrificante, vibrador, etc.)
        </label>
      </div>

      <BarChartCard
        title="Ranking de Produtos Citados"
        data={ranking}
        xKey="produto"
        bars={[{ key: 'conversas', color: SERIES.extra, name: 'Conversas' }]}
        layout="horizontal"
        yWidth={150}
      />

      <DataTable
        title={`Produtos e Termos Citados (${lista.length})`}
        pageSize={20}
        actions={
          <button
            onClick={exportar}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        }
        columns={[
          { key: 'produto', label: 'Produto' },
          { key: 'conversas', label: 'Conversas', format: (v) => formatNumber(Number(v)) },
          { key: 'em_mensagens', label: 'Nas Mensagens', format: (v) => formatNumber(Number(v)) },
          { key: 'em_resumos', label: 'Nos Resumos', format: (v) => formatNumber(Number(v)) },
          {
            key: 'eh_categoria',
            label: 'Tipo',
            format: (v) => (v ? 'Categoria' : 'Específico'),
          },
        ]}
        rows={lista as unknown as Record<string, unknown>[]}
      />
      <p className="text-xs text-zinc-400">
        Ranking cruza o catálogo de produtos INTT com as mensagens recebidas dos clientes e os resumos das conversas.
        Linhas marcadas como &quot;Categoria&quot; são termos genéricos (ex.: lubrificante, vibrador), não um SKU específico.
      </p>
    </div>
  );
}
