'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { DataTable } from '@/components/charts';
import { PaginaIntro } from '@/components/PaginaIntro';
import { ResumoCell } from '@/components/ResumoCell';
import { ClienteCell } from '@/components/ui/ClienteCell';
import { Abas, BotaoCsv, CampoBusca, Painel } from '@/components/ui/Painel';
import { RankingLista } from '@/components/ui/RankingLista';
import { StatStrip } from '@/components/ui/StatStrip';
import { useFilters } from '@/contexts/FilterContext';
import { cn, cleanResumo, downloadCsv, formatDateTime, formatPhone, normalizeName } from '@/lib/utils';
import { getRelatorioTransferencias, type OrigemTransferencia, type TransferenciaRow } from '@/services/analytics';

// Fonte: public.handoff_events → RPC relatorio_transferencias (1 linha por cliente/dia).
// "origem": 'ia', 'humano' ou 'humano+ia' (os dois passaram contato para o mesmo cliente no dia).
// Encaminhamento da IA ao Suporte NÃO entra aqui: fica em "Reclamações e Suporte".

const ORIGEM: Record<string, { label: string; estilo: string }> = {
  ia: { label: 'IA', estilo: 'bg-brand-50 text-brand-700 ring-brand-200' },
  humano: { label: 'Atendimento', estilo: 'bg-sky-50 text-sky-700 ring-sky-200' },
  'humano+ia': { label: 'IA + atendimento', estilo: 'bg-violet-50 text-violet-700 ring-violet-200' },
};

const temOrigem = (l: TransferenciaRow, o: OrigemTransferencia) => l.origem.split('+').includes(o);
const ehSuporte = (l: TransferenciaRow) => l.origem === 'ia' && /^suporte/i.test(l.destino ?? '');

// tipo_cliente vem como "Lojista · formulário" | "Revenda · atendente" | "Consumidor Final · IA".
const tipoBase = (t: string | null | undefined) => t?.split(' · ')[0] ?? null;
const tipoFonte = (t: string | null | undefined) => t?.split(' · ')[1] ?? null;

const FONTE_ESTILO: Record<string, string> = {
  formulário: 'bg-emerald-50 text-emerald-700',
  atendente: 'bg-sky-50 text-sky-700',
  IA: 'bg-zinc-100 text-zinc-600',
};

function TipoCell({ value }: { value: unknown }) {
  const t = value ? String(value) : null;
  if (!t) return <span className="text-zinc-400">—</span>;
  const fonte = tipoFonte(t);
  return (
    <span className="whitespace-nowrap">
      {tipoBase(t)}
      {fonte && (
        <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${FONTE_ESTILO[fonte] ?? FONTE_ESTILO.IA}`}>
          {fonte}
        </span>
      )}
    </span>
  );
}

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
  /** Aba aberta ao entrar (ex.: ?origem=humano vindo do link antigo "Transferência Atendimento"). */
  origemInicial?: '' | OrigemTransferencia;
};

export function TransferenciasView({ origemInicial = '' }: Props) {
  const { periodo } = useFilters();
  const [linhas, setLinhas] = useState<TransferenciaRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [origemFiltro, setOrigemFiltro] = useState<'' | OrigemTransferencia>(origemInicial);
  const [destinoFiltro, setDestinoFiltro] = useState('');
  const [regiaoFiltro, setRegiaoFiltro] = useState('');

  useEffect(() => {
    let ativo = true;
    getRelatorioTransferencias(periodo, null)
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

  const todas = useMemo(() => (linhas ?? []).filter((l) => !ehSuporte(l)), [linhas]);

  // Base dos números e rankings: respeita a aba (origem), ignora busca e filtros de clique.
  const base = useMemo(
    () => (origemFiltro ? todas.filter((l) => temOrigem(l, origemFiltro)) : todas),
    [todas, origemFiltro]
  );

  const porDestino = useMemo(() => contarPor(base, (l) => l.destino), [base]);
  const porRegiao = useMemo(() => contarPor(base, (l) => l.regiao), [base]);
  const porTipo = useMemo(() => contarPor(base, (l) => tipoBase(l.tipo_cliente)), [base]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return base.filter((l) => {
      if (destinoFiltro && normalizeName(l.destino) !== normalizeName(destinoFiltro)) return false;
      if (regiaoFiltro && normalizeName(l.regiao) !== normalizeName(regiaoFiltro)) return false;
      if (!q) return true;
      return [l.nome_cliente, l.telefone_cliente, l.razao_social, l.destino, l.regiao, l.tipo_cliente, l.resumo, l.mensagem]
        .some((campo) => campo?.toLowerCase().includes(q));
    });
  }, [base, busca, destinoFiltro, regiaoFiltro]);

  if (erro) return <div className="text-red-500">{erro}</div>;
  if (!linhas) return <div className="text-zinc-400">Carregando...</div>;

  const pelaIa = todas.filter((l) => temOrigem(l, 'ia')).length;
  const peloHumano = todas.filter((l) => temOrigem(l, 'humano')).length;
  const filtrosAtivos = [destinoFiltro && { label: destinoFiltro, limpar: () => setDestinoFiltro('') },
    regiaoFiltro && { label: regiaoFiltro, limpar: () => setRegiaoFiltro('') }].filter(Boolean) as
    { label: string; limpar: () => void }[];

  function exportar() {
    downloadCsv(
      `representantes${origemFiltro ? `_${origemFiltro}` : ''}_${periodo.inicio}_${periodo.fim}.csv`,
      ['Data', 'Quem passou', 'Cliente', 'Razão Social', 'Telefone Cliente', 'Representante', 'Telefone Representante',
        'Região', 'Tipo Cliente', 'País', 'Motivo', 'Mensagem', 'Resumo'],
      filtradas.map((l) => [
        formatDateTime(l.data_handoff),
        ORIGEM[l.origem]?.label ?? l.origem,
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
    <div className="space-y-5">
      <PaginaIntro
        veja={[
          { href: '/dashboard/reclamacoes', label: 'Reclamações e Suporte' },
          { href: '/dashboard/site', label: 'Enviados ao Site' },
        ]}
      >
        Clientes de <b>revenda</b> que receberam o contato de um <b>representante comercial</b> (ou foram para a equipe
        comercial no Bitrix). <b>Pela IA</b> = a Cris passou o contato; <b>Pelo atendimento</b> = um atendente passou.
        Reclamações e quem foi mandado para o site <b>não entram aqui</b>.
      </PaginaIntro>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Abas<'' | OrigemTransferencia>
          valor={origemFiltro}
          onChange={setOrigemFiltro}
          opcoes={[
            { valor: '', label: 'Todos', contagem: todas.length },
            { valor: 'ia', label: 'Pela IA', contagem: pelaIa },
            { valor: 'humano', label: 'Pelo atendimento', contagem: peloHumano },
          ]}
        />
        <p className="text-xs text-zinc-400">Um cliente conta uma vez por dia. Pode aparecer nas duas abas.</p>
      </div>

      <StatStrip
        itens={[
          { label: 'Clientes encaminhados', valor: base.length, tom: 'marca' },
          { label: 'Representantes acionados', valor: porDestino.length },
          { label: 'Top representante', valor: porDestino[0]?.nome ?? '—', detalhe: porDestino[0] ? `${porDestino[0].total} clientes` : undefined },
          { label: 'Regiões atendidas', valor: porRegiao.length },
        ]}
      />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Painel titulo="Ranking de representantes" descricao="Clique num nome para filtrar a lista.">
          <RankingLista itens={porDestino} onSelecionar={setDestinoFiltro} selecionado={destinoFiltro} />
        </Painel>
        <Painel titulo="Por região" descricao="Clique numa região para filtrar a lista.">
          <RankingLista itens={porRegiao} cor="bg-bronze-500" onSelecionar={setRegiaoFiltro} selecionado={regiaoFiltro} />
        </Painel>
      </div>

      <Painel
        titulo="Tipo de cliente"
        descricao={
          <>
            <b>formulário</b> = o cliente marcou no site · <b>atendente</b> = o atendimento encaminhou para representante ·{' '}
            <b>IA</b> = classificação da Cris na conversa.
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          {porTipo.length === 0 && <span className="text-sm text-zinc-400">Sem dados</span>}
          {porTipo.map((t) => (
            <span key={t.nome} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700">
              {t.nome} <b className="ml-1 text-zinc-900">{t.total}</b>
            </span>
          ))}
        </div>
      </Painel>

      <Painel
        semPadding
        titulo={`Clientes encaminhados (${filtradas.length}${filtradas.length !== base.length ? ` de ${base.length}` : ''})`}
        acoes={<BotaoCsv onClick={exportar} />}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-3">
          <CampoBusca valor={busca} onChange={setBusca} placeholder="Cliente, telefone, representante, região..." />
          {filtrosAtivos.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={f.limpar}
              className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              {f.label} <X className="h-3.5 w-3.5" />
            </button>
          ))}
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
                <ClienteCell
                  nome={r.nome_cliente as string}
                  telefone={r.telefone_cliente as string}
                  extra={r.razao_social as string}
                />
              ),
            },
            {
              key: 'destino',
              label: 'Representante',
              format: (_, r) => (
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-800">{String(r.destino ?? '—')}</p>
                  {r.telefone_representante ? (
                    <p className="truncate text-xs text-zinc-500">{formatPhone(r.telefone_representante as string)}</p>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'origem',
              label: 'Quem passou',
              format: (v) => {
                const o = ORIGEM[String(v)];
                return (
                  <span className={cn('whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', o?.estilo ?? 'bg-zinc-50 text-zinc-600 ring-zinc-200')}>
                    {o?.label ?? String(v)}
                  </span>
                );
              },
            },
            { key: 'regiao', label: 'Região', format: (v) => <span className="text-zinc-600">{(v as string) || '—'}</span> },
            { key: 'tipo_cliente', label: 'Tipo', format: (v) => <TipoCell value={v} /> },
            { key: 'data_handoff', label: 'Quando', format: (v) => <span className="whitespace-nowrap text-zinc-600">{formatDateTime(String(v))}</span> },
            origemFiltro === 'humano'
              ? { key: 'mensagem', label: 'Mensagem do atendente', format: (v) => <ResumoCell value={v} /> }
              : { key: 'resumo', label: 'Resumo', format: (v) => <ResumoCell value={v} /> },
          ]}
          rows={filtradas as unknown as Record<string, unknown>[]}
        />
      </Painel>
    </div>
  );
}
