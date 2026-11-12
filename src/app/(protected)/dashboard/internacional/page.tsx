'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { DataTable } from '@/components/charts';
import { PaginaIntro } from '@/components/PaginaIntro';
import { ResumoCell } from '@/components/ResumoCell';
import { ClienteCell } from '@/components/ui/ClienteCell';
import { BotaoCsv, CampoBusca, Painel } from '@/components/ui/Painel';
import { RankingLista } from '@/components/ui/RankingLista';
import { StatStrip } from '@/components/ui/StatStrip';
import { useFilters } from '@/contexts/FilterContext';
import { cleanResumo, downloadCsv, formatDateTime } from '@/lib/utils';
import { getRelatorioInternacional, type RelatorioInternacional } from '@/services/analytics';

export default function InternacionalPage() {
  const { periodo } = useFilters();
  const [relatorio, setRelatorio] = useState<RelatorioInternacional | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [pais, setPais] = useState('');

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

  const conversas = useMemo(() => relatorio?.conversas ?? [], [relatorio]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return conversas.filter((c) => {
      if (pais && c.pais !== pais) return false;
      if (!q) return true;
      return [c.nome, c.telefone, c.razao_social, c.pais, c.regiao, c.representante, c.resumo].some((v) =>
        v?.toLowerCase().includes(q)
      );
    });
  }, [conversas, busca, pais]);

  if (erro) return <div className="text-red-500">{erro}</div>;
  if (!relatorio) return <div className="text-zinc-400">Carregando...</div>;

  const porPais = (relatorio.por_pais ?? []).map((p) => ({ nome: p.pais, total: Number(p.total) }));
  const comRepresentante = conversas.filter((c) => c.representante).length;
  const temEmpresa = conversas.some((c) => c.razao_social);

  function exportar() {
    downloadCsv(
      `internacional_${periodo.inicio}_${periodo.fim}.csv`,
      ['Data', 'Nome', 'Razão Social', 'Telefone', 'País', 'Região', 'Encaminhado para', 'Tipo Cliente', 'Resumo'],
      filtradas.map((c) => [
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

  return (
    <div className="space-y-5">
      <PaginaIntro>
        Conversas de clientes <b>fora do Brasil</b> (identificados pelo código do país no telefone). Paraguai vai para o
        atendimento comercial; os demais países são passados para o atendimento humano orientar.
      </PaginaIntro>

      <StatStrip
        itens={[
          { label: 'Atendimentos internacionais', valor: Number(relatorio.total ?? 0), tom: 'marca' },
          { label: 'Países', valor: porPais.length },
          { label: 'Top país', valor: porPais[0]?.nome ?? '—', detalhe: porPais[0] ? `${porPais[0].total} atendimentos` : undefined },
          { label: 'Encaminhados', valor: comRepresentante, detalhe: `de ${conversas.length}` },
        ]}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Painel titulo="Por país" descricao="Clique num país para filtrar.">
          <RankingLista itens={porPais} limite={12} onSelecionar={setPais} selecionado={pais} />
        </Painel>

        <Painel
          semPadding
          titulo={`Conversas (${filtradas.length}${filtradas.length !== conversas.length ? ` de ${conversas.length}` : ''})`}
          acoes={<BotaoCsv onClick={exportar} />}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-3">
            <CampoBusca valor={busca} onChange={setBusca} placeholder="Cliente, telefone, país ou resumo" />
            {pais && (
              <button
                type="button"
                onClick={() => setPais('')}
                className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
              >
                {pais} <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <DataTable
            bare
            title="Conversas"
            pageSize={12}
            columns={[
              {
                key: 'nome',
                label: 'Cliente',
                format: (_, r) => (
                  <ClienteCell
                    nome={r.nome as string}
                    telefone={r.telefone as string}
                    extra={temEmpresa ? (r.razao_social as string) : null}
                  />
                ),
              },
              {
                key: 'pais',
                label: 'País',
                format: (v) => (
                  <span className="whitespace-nowrap rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">{String(v)}</span>
                ),
              },
              { key: 'representante', label: 'Encaminhado para', format: (v) => <span className="text-zinc-600">{(v as string) || '—'}</span> },
              { key: 'data', label: 'Quando', format: (v) => <span className="whitespace-nowrap text-zinc-600">{formatDateTime(String(v))}</span> },
              { key: 'resumo', label: 'Resumo', format: (v) => <ResumoCell value={v} /> },
            ]}
            rows={filtradas as unknown as Record<string, unknown>[]}
          />
        </Painel>
      </div>
    </div>
  );
}
