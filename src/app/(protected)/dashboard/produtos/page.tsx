'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Plus, Trash2, Tag } from 'lucide-react';
import { KpiCardNumber, KpiCard } from '@/components/KpiCard';
import { BarChartCard, DataTable, SERIES } from '@/components/charts';
import { useFilters } from '@/contexts/FilterContext';
import { downloadCsv, formatNumber } from '@/lib/utils';
import {
  getProdutosMencionados,
  getProdutosResumo,
  listarTermosCustom,
  adicionarTermoCustom,
  removerTermoCustom,
  type ProdutoMencionado,
  type ProdutosResumo,
  type TermoCustom,
} from '@/services/analytics';

export default function ProdutosPage() {
  const { periodo } = useFilters();
  const [produtos, setProdutos] = useState<ProdutoMencionado[] | null>(null);
  const [resumo, setResumo] = useState<ProdutosResumo | null>(null);
  const [incluirCategorias, setIncluirCategorias] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [termos, setTermos] = useState<TermoCustom[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [novosAliases, setNovosAliases] = useState('');
  const [novaCategoria, setNovaCategoria] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [termoErro, setTermoErro] = useState<string | null>(null);

  const carregarDados = useCallback(() => {
    Promise.all([
      getProdutosMencionados(periodo, { incluirCategorias, limite: 100 }),
      getProdutosResumo(periodo, { incluirCategorias }),
    ])
      .then(([lista, res]) => {
        setProdutos(lista);
        setResumo(res);
        setErro(null);
      })
      .catch((e) => {
        console.error(e);
        setErro('Não foi possível carregar os dados. Verifique sua conexão e tente novamente.');
      });
  }, [periodo, incluirCategorias]);

  const carregarTermos = useCallback(() => {
    listarTermosCustom()
      .then(setTermos)
      .catch((e) => console.error(e));
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    carregarTermos();
  }, [carregarTermos]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const nome = novoNome.trim();
    if (nome.length < 2) {
      setTermoErro('Informe um termo com pelo menos 2 caracteres.');
      return;
    }
    setSalvando(true);
    setTermoErro(null);
    try {
      const aliases = novosAliases
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      await adicionarTermoCustom({ nome, aliases, categoria: novaCategoria });
      setNovoNome('');
      setNovosAliases('');
      setNovaCategoria(false);
      carregarTermos();
      carregarDados();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível adicionar o termo.';
      setTermoErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: number) {
    try {
      await removerTermoCustom(id);
      carregarTermos();
      carregarDados();
    } catch (err) {
      console.error(err);
    }
  }

  if (erro) return <div className="text-red-500">{erro}</div>;
  if (!produtos) return <div className="text-zinc-400">Carregando...</div>;

  const lista = produtos;
  const especificos = lista.filter((p) => !p.eh_categoria);
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
        <KpiCardNumber
          label="Conversas com Menção"
          value={resumo?.conversas_distintas ?? 0}
          subtitle="conversas distintas"
        />
        <KpiCard
          label="Mais Citado"
          value={top?.produto ?? '—'}
          subtitle={top ? `${formatNumber(Number(top.conversas))} conversas` : undefined}
        />
      </div>

      <div className="flex items-center justify-end">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
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
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
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

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="mb-1 flex items-center gap-2">
          <Tag className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-zinc-800">Termos personalizados monitorados</h3>
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          Adicione produtos ou termos que os clientes pedem e que ainda não estão no catálogo. Eles passam a ser
          contabilizados no ranking acima automaticamente. Use os apelidos para cobrir variações e abreviações
          (ex.: apelidos de <span className="font-medium">GEL COMESTÍVEL</span>: <span className="italic">gel comestivel, geleia</span>).
        </p>

        <form onSubmit={adicionar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Termo / produto</label>
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex.: LUBRIFICANTE VEGANO"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Apelidos <span className="font-normal text-zinc-400">(separados por vírgula)</span>
            </label>
            <input
              value={novosAliases}
              onChange={(e) => setNovosAliases(e.target.value)}
              placeholder="vegano, sem origem animal"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs text-zinc-600 sm:pb-2.5">
            <input
              type="checkbox"
              checked={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
            />
            Termo genérico
          </label>
          <button
            type="submit"
            disabled={salvando}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {salvando ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>

        {termoErro && <p className="mt-2 text-xs text-red-500">{termoErro}</p>}

        {termos.length > 0 ? (
          <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
            {termos.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-zinc-800">{t.nome}</span>
                  {t.categoria && (
                    <span className="ml-2 rounded bg-bronze-300/40 px-1.5 py-0.5 text-[10px] font-medium text-bronze-700">
                      genérico
                    </span>
                  )}
                  {t.aliases.length > 0 && (
                    <span className="ml-2 truncate text-xs text-zinc-400">{t.aliases.join(', ')}</span>
                  )}
                </div>
                <button
                  onClick={() => remover(t.id)}
                  className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remover ${t.nome}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-zinc-400">Nenhum termo personalizado ainda.</p>
        )}
      </section>

      <p className="text-xs text-zinc-400">
        Ranking cruza o catálogo de produtos INTT (mais os termos personalizados) com as mensagens recebidas dos
        clientes e os resumos das conversas. Linhas marcadas como &quot;Categoria&quot; são termos genéricos (ex.:
        lubrificante, vibrador), não um SKU específico.
      </p>
    </div>
  );
}
