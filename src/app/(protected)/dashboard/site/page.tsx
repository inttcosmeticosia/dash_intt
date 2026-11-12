'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { DataTable } from '@/components/charts';
import { PaginaIntro } from '@/components/PaginaIntro';
import { ResumoCell } from '@/components/ResumoCell';
import { ClienteCell } from '@/components/ui/ClienteCell';
import { Abas, BotaoCsv, CampoBusca, Painel } from '@/components/ui/Painel';
import { StatStrip } from '@/components/ui/StatStrip';
import { useFilters } from '@/contexts/FilterContext';
import { cn, cleanResumo, downloadCsv, formatDateTime } from '@/lib/utils';
import { INICIO_REGISTRO_SITE, getRelatorioSite, type SiteRow } from '@/services/analytics';

// Cada vez que a Cris manda o link do site para o cliente (registrado a partir de 12/11/2026).
// compreintt = site de uso próprio; lojaintt = site de revenda (AP/RR ou quando não há representante).

const SITE: Record<SiteRow['site'], { label: string; detalhe: string; estilo: string }> = {
  compreintt: { label: 'compreintt', detalhe: 'uso próprio', estilo: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  lojaintt: { label: 'lojaintt', detalhe: 'revenda', estilo: 'bg-sky-50 text-sky-700 ring-sky-200' },
};

type Filtro = 'todos' | SiteRow['site'];

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

export default function SitePage() {
  const { periodo } = useFilters();
  const [linhas, setLinhas] = useState<SiteRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  useEffect(() => {
    let ativo = true;
    getRelatorioSite(periodo)
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
  }, [periodo]);

  const todas = useMemo(() => linhas ?? [], [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return todas.filter((l) => {
      if (filtro !== 'todos' && l.site !== filtro) return false;
      if (!q) return true;
      return [l.nome_cliente, l.telefone, l.regiao, l.cidade, l.tipo_cliente, l.resumo, l.mensagem].some((c) =>
        c?.toLowerCase().includes(q)
      );
    });
  }, [todas, busca, filtro]);

  if (erro) return <div className="text-red-500">{erro}</div>;
  if (!linhas) return <div className="text-zinc-400">Carregando...</div>;

  const compre = todas.filter((l) => l.site === 'compreintt').length;
  const loja = todas.filter((l) => l.site === 'lojaintt').length;
  const clientes = new Set(todas.map((l) => l.telefone)).size;
  const periodoAntesDoRegistro = periodo.inicio < INICIO_REGISTRO_SITE;

  function exportar() {
    downloadCsv(
      `enviados_site_${periodo.inicio}_${periodo.fim}.csv`,
      ['Data', 'Cliente', 'Telefone', 'Site', 'Região', 'Cidade', 'Tipo', 'Mensagem da Cris', 'Resumo'],
      filtradas.map((l) => [
        formatDateTime(l.data),
        l.nome_cliente,
        l.telefone,
        l.site,
        l.regiao,
        l.cidade,
        l.tipo_cliente,
        l.mensagem,
        l.resumo ? cleanResumo(l.resumo, Number.MAX_SAFE_INTEGER) : null,
      ])
    );
  }

  return (
    <div className="space-y-5">
      <PaginaIntro
        veja={[
          { href: '/dashboard/handoffs', label: 'Representantes' },
          { href: '/dashboard/reclamacoes', label: 'Reclamações e Suporte' },
        ]}
      >
        Toda vez que a <b>Cris mandou o link do site</b> para o cliente comprar sozinho. <b>compreintt</b> = uso próprio;{' '}
        <b>lojaintt</b> = revenda em região sem representante (ex.: AP/RR). Quem foi para representante aparece em
        Representantes.
      </PaginaIntro>

      {periodoAntesDoRegistro && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <CalendarClock className="h-4 w-4 shrink-0" />
          Este registro começou em {dataBr(INICIO_REGISTRO_SITE)}. Antes disso não há dados de links enviados.
        </div>
      )}

      <StatStrip
        itens={[
          { label: 'Links enviados', valor: todas.length, detalhe: 'um por cliente por dia' },
          { label: 'Clientes', valor: clientes },
          { label: 'compreintt', valor: compre, detalhe: 'uso próprio' },
          { label: 'lojaintt', valor: loja, detalhe: 'revenda sem representante' },
        ]}
      />

      <Painel
        semPadding
        titulo={`Links enviados (${filtradas.length}${filtradas.length !== todas.length ? ` de ${todas.length}` : ''})`}
        acoes={<BotaoCsv onClick={exportar} />}
      >
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-3 sm:flex-row sm:items-center">
          <Abas<Filtro>
            valor={filtro}
            onChange={setFiltro}
            opcoes={[
              { valor: 'todos', label: 'Todos', contagem: todas.length },
              { valor: 'compreintt', label: 'Uso próprio', contagem: compre },
              { valor: 'lojaintt', label: 'Revenda', contagem: loja },
            ]}
          />
          <CampoBusca valor={busca} onChange={setBusca} placeholder="Cliente, telefone, cidade ou resumo" />
        </div>
        <DataTable
            bare
            title="Lista"
            pageSize={15}
            columns={[
              {
                key: 'nome_cliente',
                label: 'Cliente',
                format: (_, r) => (
                  <ClienteCell nome={r.nome_cliente as string} telefone={r.telefone as string} fonte={r.nome_fonte as string} />
                ),
              },
              {
                key: 'site',
                label: 'Site',
                format: (v) => {
                  const s = SITE[v as SiteRow['site']];
                  return s ? (
                    <span className={cn('whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', s.estilo)}>
                      {s.label}
                    </span>
                  ) : (
                    String(v)
                  );
                },
              },
              { key: 'data', label: 'Quando', format: (v) => <span className="whitespace-nowrap">{formatDateTime(String(v))}</span> },
              {
                key: 'cidade',
                label: 'Local',
                format: (_, r) => <span className="text-zinc-600">{(r.cidade as string) || (r.regiao as string) || '—'}</span>,
              },
              { key: 'mensagem', label: 'O que a Cris disse', format: (v) => <ResumoCell value={v} /> },
              { key: 'resumo', label: 'Resumo da conversa', format: (v) => <ResumoCell value={v} /> },
            ]}
            rows={filtradas as unknown as Record<string, unknown>[]}
          />
      </Painel>
    </div>
  );
}
