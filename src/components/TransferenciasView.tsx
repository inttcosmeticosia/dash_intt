'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { KpiCard, KpiCardNumber } from '@/components/KpiCard';
import { BarChartCard, DataTable, SERIES } from '@/components/charts';
import { ResumoCell } from '@/components/ResumoCell';
import { useFilters } from '@/contexts/FilterContext';
import { cleanResumo, downloadCsv, formatDateTime, formatPhone, normalizeName } from '@/lib/utils';
import {
  getRelatorioTransferencias,
  type OrigemTransferencia,
  type TransferenciaRow,
} from '@/services/analytics';

// Fonte única: public.handoff_events → RPC relatorio_transferencias (1 linha por cliente/dia).
// "origem" pode ser 'ia', 'humano' ou 'humano+ia' (os dois transferiram o mesmo cliente no dia).

const ORIGEM_LABEL: Record<string, string> = {
  ia: 'IA',
  humano: 'Atendimento humano',
  'humano+ia': 'IA + humano',
};

const temOrigem = (l: TransferenciaRow, o: OrigemTransferencia) => l.origem.split('+').includes(o);

/** Conta ocorrências por chave normalizada, exibindo a grafia mais frequente. */
function contarPor(linhas: TransferenciaRow[], campo: (l: TransferenciaRow) => string | null | undefined) {
  const grupos = new Map<string, { total: number; grafias: Map<string, number> }>();
  for (const l of linhas) {
    const valor = campo(l)?.trim();
    if (!valor) continue;
    const chave = normalizeName(valor);
    const g = grupos.get(chave) ?? { total: 0, grafias: new Map() };
    g.total += 1;
    g.grafias.set(valor, (g.grafias.get(valor) ?? 0) + 1);
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .map((g) => ({ nome: [...g.grafias.entries()].sort((a, b) => b[1] - a[1])[0][0], total: g.total }))
    .sort((a, b) => b.total - a.total);
}

type Props = {
  /** Fixa a origem (ex.: aba "Transferência Atendimento" = 'humano'); sem ela a página mostra o filtro. */
  origemFixa?: OrigemTransferencia;
};

export function TransferenciasView({ origemFixa }: Props) {
  const { periodo } = useFilters();
  const [linhas, setLinhas] = useState<TransferenciaRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [origemFiltro, setOrigemFiltro] = useState<'' | OrigemTransferencia>('');
  const [destinoFiltro, setDestinoFiltro] = useState('');

  useEffect(() => {
    let ativo = true;
    getRelatorioTransferencias(periodo, origemFixa ?? null)
      .then((r) => {
        if (!ativo) return;
        setLinhas(r);
        setErro(null);
      })
      .catch((e) => {
        console.error(e);
        if (ativo) setErro('Não foi possível carregar os dados. Verifique sua conexão e tente novamente.');
      });
    return () => {
      ativo = false;
    };
  }, [periodo, origemFixa]);

  const todas = useMemo(() => linhas ?? [], [linhas]);

  // Base dos KPIs/gráficos: respeita o filtro de origem, ignora busca/destino.
  const base = useMemo(
    () => (origemFiltro ? todas.filter((l) => temOrigem(l, origemFiltro)) : todas),
    [todas, origemFiltro]
  );

  const porDestino = useMemo(() => contarPor(base, (l) => l.destino), [base]);
  const porRegiao = useMemo(() => contarPor(base, (l) => l.regiao), [base]);
  const porTipo = useMemo(() => contarPor(base, (l) => l.tipo_cliente), [base]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return base.filter((l) => {
      if (destinoFiltro && normalizeName(l.destino) !== normalizeName(destinoFiltro)) return false;
      if (!q) return true;
      return [l.nome_cliente, l.telefone_cliente, l.razao_social, l.destino, l.regiao, l.tipo_cliente, l.resumo, l.mensagem]
        .some((campo) => campo?.toLowerCase().includes(q));
    });
  }, [base, busca, destinoFiltro]);

  if (erro) return <div className="text-red-500">{erro}</div>;
  if (!linhas) return <div className="text-zinc-400">Carregando...</div>;

  const pelaIa = base.filter((l) => temOrigem(l, 'ia')).length;
  const peloHumano = base.filter((l) => temOrigem(l, 'humano')).length;
  const comRepresentante = base.filter((l) => l.representante).length;
  const top = porDestino[0];
  const temEmpresa = filtradas.some((l) => l.razao_social);

  function exportar() {
    downloadCsv(
      `transferencias${origemFixa ? `_${origemFixa}` : ''}_${periodo.inicio}_${periodo.fim}.csv`,
      ['Data', 'Origem', 'Cliente', 'Razão Social', 'Telefone Cliente', 'Destino', 'Telefone Representante',
        'Região', 'Tipo Cliente', 'País', 'Motivo', 'Mensagem', 'Resumo'],
      filtradas.map((l) => [
        formatDateTime(l.data_handoff),
        ORIGEM_LABEL[l.origem] ?? l.origem,
        l.nome_cliente,
        l.razao_social,
        l.telefone_cliente,
        l.destino,
        l.telefone_representante,
        l.regiao,
        l.tipo_cliente,
        l.pais,
        l.motivo,
        l.mensagem,
        l.resumo ? cleanResumo(l.resumo, Number.MAX_SAFE_INTEGER) : null,
      ])
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardNumber label="Clientes Transferidos" value={base.length} />
        {origemFixa === 'humano' ? (
          <KpiCardNumber label="Com Representante Identificado" value={comRepresentante} />
        ) : (
          <KpiCard
            label="Pela IA / Pelo Atendimento"
            value={`${pelaIa} / ${peloHumano}`}
            subtitle="cliente pode contar nos dois"
          />
        )}
        <KpiCardNumber label="Destinos Acionados" value={porDestino.length} />
        <KpiCard label="Top Destino" value={top?.nome ?? '—'} subtitle={top ? `${top.total} clientes` : undefined} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <BarChartCard
          title="Transferências por Destino (top 10)"
          data={porDestino.slice(0, 10)}
          xKey="nome"
          bars={[{ key: 'total', color: SERIES.transferidos, name: 'Clientes' }]}
          layout="horizontal"
          yWidth={170}
        />
        <BarChartCard
          title="Transferências por Região (top 10)"
          data={porRegiao.slice(0, 10)}
          xKey="nome"
          bars={[{ key: 'total', color: SERIES.novos, name: 'Clientes' }]}
          layout="horizontal"
          yWidth={170}
        />
      </div>

      <BarChartCard
        title="Por Tipo de Cliente"
        data={porTipo}
        xKey="nome"
        bars={[{ key: 'total', color: SERIES.ativos, name: 'Clientes' }]}
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
            placeholder="Buscar por cliente, telefone, destino, região ou mensagem..."
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>
        {!origemFixa && (
          <select
            value={origemFiltro}
            onChange={(e) => setOrigemFiltro(e.target.value as '' | OrigemTransferencia)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas as origens</option>
            <option value="ia">IA</option>
            <option value="humano">Atendimento humano</option>
          </select>
        )}
        <select
          value={destinoFiltro}
          onChange={(e) => setDestinoFiltro(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">Todos os destinos</option>
          {porDestino.map((d) => (
            <option key={d.nome} value={d.nome}>
              {d.nome} ({d.total})
            </option>
          ))}
        </select>
      </div>

      <DataTable
        title={`Transferências (${filtradas.length}${filtradas.length !== base.length ? ` de ${base.length}` : ''})`}
        pageSize={15}
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
          { key: 'data_handoff', label: 'Data', format: (v) => formatDateTime(String(v)) },
          ...(origemFixa ? [] : [{ key: 'origem', label: 'Origem', format: (v: unknown) => ORIGEM_LABEL[String(v)] ?? String(v) }]),
          { key: 'nome_cliente', label: 'Cliente' },
          ...(temEmpresa ? [{ key: 'razao_social', label: 'Empresa' }] : []),
          { key: 'telefone_cliente', label: 'Telefone', format: (v) => formatPhone(v as string) },
          { key: 'destino', label: 'Destino' },
          { key: 'telefone_representante', label: 'Tel. Representante', format: (v) => (v ? formatPhone(v as string) : '—') },
          { key: 'regiao', label: 'Região' },
          { key: 'tipo_cliente', label: 'Tipo' },
          origemFixa === 'humano'
            ? { key: 'mensagem', label: 'Mensagem', format: (v) => <ResumoCell value={v} /> }
            : { key: 'resumo', label: 'Resumo', format: (v) => <ResumoCell value={v} /> },
        ]}
        rows={filtradas as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
