'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { KpiCard, KpiCardNumber } from '@/components/KpiCard';
import { BarChartCard, DataTable, SERIES } from '@/components/charts';
import { useFilters } from '@/contexts/FilterContext';
import { cleanResumo, downloadCsv, formatDateTime, formatPhone } from '@/lib/utils';
import { getRelatorioInternacional, type RelatorioInternacional } from '@/services/analytics';

export default function InternacionalPage() {
  const { periodo } = useFilters();
  const [relatorio, setRelatorio] = useState<RelatorioInternacional | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    getRelatorioInternacional(periodo)
      .then((r) => {
        if (!ativo) return;
        setRelatorio(r);
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

  if (erro) return <div className="text-red-500">{erro}</div>;
  if (!relatorio) return <div className="text-zinc-400">Carregando...</div>;

  const porPais = relatorio.por_pais ?? [];
  const conversas = relatorio.conversas ?? [];
  const transferidas = conversas.filter((c) => c.representante).length;

  function exportar() {
    downloadCsv(
      `internacional_${periodo.inicio}_${periodo.fim}.csv`,
      ['Data', 'Nome', 'Razão Social', 'Telefone', 'País', 'Região', 'Representante', 'Tipo Cliente', 'Resumo'],
      conversas.map((c) => [
        formatDateTime(c.data),
        c.nome,
        c.razao_social,
        c.telefone,
        c.pais,
        c.regiao,
        c.representante,
        c.tipo_cliente,
        c.resumo ? cleanResumo(c.resumo, Number.MAX_SAFE_INTEGER) : null,
      ])
    );
  }

  const temEmpresa = conversas.some((c) => c.razao_social);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardNumber label="Atendimentos Internacionais" value={Number(relatorio.total ?? 0)} />
        <KpiCardNumber label="Países" value={porPais.length} />
        <KpiCardNumber label="Transferidos" value={transferidas} />
        <KpiCard
          label="Top País"
          value={porPais[0]?.pais ?? '—'}
          subtitle={porPais[0] ? `${porPais[0].total} atendimentos` : undefined}
        />
      </div>

      <BarChartCard
        title="Atendimentos por País"
        data={porPais.map((p) => ({ pais: p.pais, total: Number(p.total) }))}
        xKey="pais"
        bars={[{ key: 'total', color: SERIES.novos, name: 'Atendimentos' }]}
        layout="horizontal"
        yWidth={130}
      />

      <DataTable
        title={`Conversas Internacionais (${conversas.length})`}
        pageSize={15}
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
          { key: 'data', label: 'Data', format: (v) => formatDateTime(String(v)) },
          { key: 'nome', label: 'Nome' },
          ...(temEmpresa ? [{ key: 'razao_social', label: 'Empresa' }] : []),
          { key: 'telefone', label: 'Telefone', format: (v) => formatPhone(v as string) },
          { key: 'pais', label: 'País' },
          { key: 'regiao', label: 'Região' },
          { key: 'representante', label: 'Representante' },
          { key: 'tipo_cliente', label: 'Tipo' },
          { key: 'resumo', label: 'Resumo', format: (v) => cleanResumo(v as string | null) },
        ]}
        rows={conversas as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
