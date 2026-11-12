'use client';

import { useEffect, useState } from 'react';
import { AlertaSuporte } from '@/components/AlertaSuporte';
import { BarChartCard, LineChartCard, SERIES } from '@/components/charts';
import { ParaOndeForam } from '@/components/ParaOndeForam';
import { StatStrip } from '@/components/ui/StatStrip';
import { useFilters } from '@/contexts/FilterContext';
import { formatChartDate } from '@/lib/utils';
import {
  getAtendimentosDiarios,
  getAtendimentosSemanais,
  getMetricasAtendimento,
  getRelatorioSite,
  getRelatorioSuporte,
  getRelatorioTransferencias,
  type AtendimentoDiario,
  type AtendimentoSemanal,
  type MetricasAtendimento,
  type SuporteRow,
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
  const [suporte, setSuporte] = useState<SuporteRow[] | null>(null);
  const [destinos, setDestinos] = useState<{ representantes: number | null; site: number | null }>({
    representantes: null,
    site: null,
  });

  useEffect(() => {
    let ativo = true;
    Promise.all([getMetricasAtendimento(periodo), getAtendimentosDiarios(periodo), getAtendimentosSemanais(periodo)])
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

  // Alerta e "para onde foram": carregam à parte para não travar a visão geral se falharem.
  useEffect(() => {
    let ativo = true;
    getRelatorioSuporte(periodo)
      .then((r) => ativo && setSuporte(r))
      .catch((e) => console.error(e));
    Promise.all([getRelatorioTransferencias(periodo, null), getRelatorioSite(periodo)])
      .then(([t, s]) => {
        if (!ativo) return;
        // Mesma regra da página Representantes: encaminhamento da IA ao Suporte não conta.
        const reps = t.filter((l) => !(l.origem === 'ia' && /^suporte/i.test(l.destino ?? '')));
        setDestinos({ representantes: reps.length, site: s.length });
      })
      .catch((e) => console.error(e));
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
    <div className="space-y-5">
      {suporte && <AlertaSuporte linhas={suporte} comLink />}

      <StatStrip
        itens={[
          {
            label: 'Novos atendimentos',
            valor: Number(metricas?.novos_atendimentos ?? 0),
            trend: anterior?.crescimento_percentual,
            detalhe: 'vs período anterior',
            tom: 'marca',
          },
          {
            label: 'Conversas ativas',
            valor: Number(metricas?.conversas_ativas ?? 0),
            detalhe: `${anterior?.conversas_ativas ?? 0} no período anterior`,
          },
          {
            label: 'Encaminhados',
            valor: Number(metricas?.transferidos ?? 0),
            detalhe: 'representante ou suporte',
          },
          {
            label: 'Taxa de encaminhamento',
            valor: `${metricas?.taxa_transferencia ?? 0}%`,
            detalhe: `${metricas?.novos_transferidos ?? 0} de ${metricas?.novos_atendimentos ?? 0} novos`,
          },
          { label: 'Internacionais', valor: Number(metricas?.internacionais ?? 0), detalhe: 'fora do Brasil' },
        ]}
      />

      <ParaOndeForam
        representantes={destinos.representantes}
        suporte={suporte ? suporte.length : null}
        site={destinos.site}
      />

      <LineChartCard
        title="Atendimentos por dia"
        description="Novas conversas abertas e conversas com mensagem em cada dia."
        data={chartDiario}
        xKey="dia"
        lines={[
          { key: 'novos', color: SERIES.novos, name: 'Novos' },
          { key: 'ativos', color: SERIES.ativos, name: 'Ativos' },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <BarChartCard
          title="Encaminhamentos por dia"
          description="Conversas que a IA ou o atendimento encaminharam (representante ou suporte)."
          data={chartDiario}
          xKey="dia"
          bars={[{ key: 'transferidos', color: SERIES.transferidos, name: 'Encaminhados' }]}
          layout="vertical"
        />
        <BarChartCard
          title="Comparativo por semana"
          description="Semana começa na segunda."
          data={chartSemanal}
          xKey="semana"
          bars={[
            { key: 'novos', color: SERIES.novos, name: 'Novos' },
            { key: 'ativos', color: SERIES.ativos, name: 'Ativos' },
            { key: 'transferidos', color: SERIES.transferidos, name: 'Encaminhados' },
          ]}
          layout="vertical"
        />
      </div>
    </div>
  );
}
