'use client';

import { useEffect, useState } from 'react';
import { KpiCard, KpiCardNumber } from '@/components/KpiCard';
import { BarChartCard, LineChartCard, SERIES } from '@/components/charts';
import { useFilters } from '@/contexts/FilterContext';
import { formatChartDate } from '@/lib/utils';
import {
  getAtendimentosDiarios,
  getAtendimentosSemanais,
  getMetricasAtendimento,
  type AtendimentoDiario,
  type AtendimentoSemanal,
  type MetricasAtendimento,
} from '@/services/analytics';

type Dados = {
  metricas: MetricasAtendimento;
  diarios: AtendimentoDiario[];
  semanais: AtendimentoSemanal[];
};

export default function DashboardPage() {
  const { periodo } = useFilters();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      getMetricasAtendimento(periodo),
      getAtendimentosDiarios(periodo),
      getAtendimentosSemanais(periodo),
    ])
      .then(([metricas, diarios, semanais]) => {
        if (!ativo) return;
        setDados({ metricas, diarios, semanais });
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
  if (!dados) return <div className="text-zinc-400">Carregando...</div>;

  const { metricas, diarios, semanais } = dados;
  const anterior = metricas?.periodo_anterior;

  const chartDiario = diarios.map((d) => ({
    dia: formatChartDate(d.dia),
    novos: Number(d.novos),
    ativos: Number(d.ativos),
    transferidos: Number(d.transferidos),
  }));

  const chartSemanal = semanais.map((s) => ({
    semana: `Sem. ${formatChartDate(s.semana)}`,
    novos: Number(s.novos),
    ativos: Number(s.ativos),
    transferidos: Number(s.transferidos),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Novos Atendimentos"
          value={String(metricas?.novos_atendimentos ?? 0)}
          trend={anterior?.crescimento_percentual}
        />
        <KpiCardNumber
          label="Conversas Ativas"
          value={Number(metricas?.conversas_ativas ?? 0)}
          subtitle={`${anterior?.conversas_ativas ?? 0} no período anterior`}
        />
        <KpiCardNumber
          label="Transferidos"
          value={Number(metricas?.transferidos ?? 0)}
          subtitle={`${anterior?.transferidos ?? 0} no período anterior`}
        />
        <KpiCard label="Taxa de Transferência" value={`${metricas?.taxa_transferencia ?? 0}%`} />
        <KpiCardNumber label="Internacionais" value={Number(metricas?.internacionais ?? 0)} />
      </div>

      <LineChartCard
        title="Atendimentos por Dia"
        data={chartDiario}
        xKey="dia"
        lines={[
          { key: 'novos', color: SERIES.novos, name: 'Novos' },
          { key: 'ativos', color: SERIES.ativos, name: 'Ativos' },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <BarChartCard
          title="Transferências para Representantes por Dia"
          data={chartDiario}
          xKey="dia"
          bars={[{ key: 'transferidos', color: SERIES.transferidos, name: 'Transferidos' }]}
          layout="vertical"
        />

        <BarChartCard
          title="Resumo Semanal"
          data={chartSemanal}
          xKey="semana"
          bars={[
            { key: 'novos', color: SERIES.novos, name: 'Novos' },
            { key: 'ativos', color: SERIES.ativos, name: 'Ativos' },
            { key: 'transferidos', color: SERIES.transferidos, name: 'Transferidos' },
          ]}
          layout="vertical"
        />
      </div>
    </div>
  );
}
