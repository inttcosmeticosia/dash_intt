'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { KpiCard, KpiCardNumber } from '@/components/KpiCard';
import { BarChartCard, DataTable, SERIES } from '@/components/charts';
import { useFilters } from '@/contexts/FilterContext';
import { downloadCsv, formatDateTime, formatPhone, normalizeName } from '@/lib/utils';
import {
  getHandoffsPorRepresentante,
  getRelatorioHandoffs,
  type HandoffRow,
  type RepresentanteRanking,
} from '@/services/analytics';

type Dados = {
  linhas: HandoffRow[];
  ranking: RepresentanteRanking[];
};

export default function HandoffsPage() {
  const { periodo } = useFilters();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [repFiltro, setRepFiltro] = useState('');

  useEffect(() => {
    let ativo = true;
    Promise.all([getRelatorioHandoffs(periodo), getHandoffsPorRepresentante(periodo)])
      .then(([linhas, ranking]) => {
        if (!ativo) return;
        setDados({ linhas, ranking });
        setErro(null);
      })
      .catch((e) => {
        console.error(e);
        if (ativo) setErro('Não foi possível carregar os dados. Verifique sua conexão e tente novamente.');
      });
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const linhas = useMemo(() => dados?.linhas ?? [], [dados]);
  const ranking = useMemo(() => dados?.ranking ?? [], [dados]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (repFiltro && normalizeName(l.representante) !== normalizeName(repFiltro)) return false;
      if (!q) return true;
      return [l.nome_cliente, l.telefone_cliente, l.razao_social, l.representante, l.regiao, l.tipo_cliente]
        .some((campo) => campo?.toLowerCase().includes(q));
    });
  }, [linhas, busca, repFiltro]);

  const topRegioes = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const l of linhas) {
      const r = l.regiao ?? 'Não informada';
      contagem.set(r, (contagem.get(r) ?? 0) + 1);
    }
    return [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([regiao, total]) => ({ regiao, total }));
  }, [linhas]);

  const porTipo = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const l of linhas) {
      const t = l.tipo_cliente ?? 'Não classificado';
      contagem.set(t, (contagem.get(t) ?? 0) + 1);
    }
    return [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tipo, total]) => ({ tipo, total }));
  }, [linhas]);

  if (erro) return <div className="text-red-500">{erro}</div>;
  if (!dados) return <div className="text-zinc-400">Carregando...</div>;

  const top = ranking[0];

  function exportar() {
    downloadCsv(
      `handoffs_${periodo.inicio}_${periodo.fim}.csv`,
      ['Data', 'Nome Cliente', 'Razão Social', 'Telefone Cliente', 'Representante', 'Telefone Representante', 'Região', 'Tipo Cliente', 'Motivo', 'País'],
      filtradas.map((l) => [
        formatDateTime(l.data_handoff),
        l.nome_cliente,
        l.razao_social,
        l.telefone_cliente,
        l.representante,
        l.telefone_representante,
        l.regiao,
        l.tipo_cliente,
        l.motivo,
        l.pais,
      ])
    );
  }

  // Coluna "Empresa" só aparece quando alguma transferência do período tem
  // razão social (o agente só coleta para clientes B2B).
  const temEmpresa = filtradas.some((l) => l.razao_social);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardNumber label="Transferências no Período" value={linhas.length} />
        <KpiCardNumber label="Representantes Acionados" value={ranking.length} />
        <KpiCard
          label="Top Representante"
          value={top?.representante ?? '—'}
          subtitle={top ? `${top.total} transferências` : undefined}
        />
        <KpiCard
          label="Top Região"
          value={topRegioes[0]?.regiao ?? '—'}
          subtitle={topRegioes[0] ? `${topRegioes[0].total} transferências` : undefined}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <BarChartCard
          title="Transferências por Representante (top 10)"
          data={ranking.slice(0, 10).map((r) => ({ representante: r.representante, total: Number(r.total) }))}
          xKey="representante"
          bars={[{ key: 'total', color: SERIES.transferidos, name: 'Transferências' }]}
          layout="horizontal"
          yWidth={130}
        />

        <BarChartCard
          title="Transferências por Região (top 10)"
          data={topRegioes}
          xKey="regiao"
          bars={[{ key: 'total', color: SERIES.novos, name: 'Transferências' }]}
          layout="horizontal"
          yWidth={170}
        />
      </div>

      <BarChartCard
        title="Por Tipo de Cliente"
        data={porTipo}
        xKey="tipo"
        bars={[{ key: 'total', color: SERIES.ativos, name: 'Transferências' }]}
        layout="horizontal"
        yWidth={130}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, telefone, representante ou região..."
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={repFiltro}
          onChange={(e) => setRepFiltro(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">Todos os representantes</option>
          {ranking.map((r) => (
            <option key={r.representante} value={r.representante}>
              {r.representante} ({r.total})
            </option>
          ))}
        </select>
      </div>

      <DataTable
        title={`Transferências (${filtradas.length}${filtradas.length !== linhas.length ? ` de ${linhas.length}` : ''})`}
        pageSize={15}
        actions={
          <button
            onClick={exportar}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        }
        columns={[
          { key: 'data_handoff', label: 'Data', format: (v) => formatDateTime(String(v)) },
          { key: 'nome_cliente', label: 'Cliente' },
          ...(temEmpresa ? [{ key: 'razao_social', label: 'Empresa' }] : []),
          { key: 'telefone_cliente', label: 'Telefone', format: (v) => formatPhone(v as string) },
          { key: 'representante', label: 'Representante' },
          { key: 'regiao', label: 'Região' },
          { key: 'tipo_cliente', label: 'Tipo' },
          { key: 'motivo', label: 'Motivo' },
        ]}
        rows={filtradas as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
