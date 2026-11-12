'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Clock, Download, ExternalLink, Hash, Search } from 'lucide-react';
import { AlertaSuporte } from '@/components/AlertaSuporte';
import { PaginaIntro } from '@/components/PaginaIntro';
import { ClienteCell } from '@/components/ui/ClienteCell';
import { useFilters } from '@/contexts/FilterContext';
import { cn, downloadCsv, formatDateTime } from '@/lib/utils';
import {
  URGENCIA_BARRA,
  URGENCIA_ESTILO,
  URGENCIA_LABEL,
  fraseAtendimento,
  fraseProblema,
  fraseResumo,
  horasDesde,
  linkBitrix,
  ordenarSuporte,
  tempoTexto,
} from '@/lib/suporte';
import { getRelatorioSuporte, type SuporteRow, type Urgencia } from '@/services/analytics';

// Tudo que a IA passou para o suporte humano: reclamação, atraso, defeito, rastreio, checkout, cadastro.
// Urgência: Alta = atraso, defeito, reação ou menção a Procon/cancelar; Média = reclamação e rastreio; Baixa = resto.

type Aba = 'todos' | 'aguardando' | 'respondidos';

const textoLimpo = (s: string | null) => (s ?? '').replace(/\\n/g, '\n').trim();

function Linha({ l, aberta, onToggle }: { l: SuporteRow; aberta: boolean; onToggle: () => void }) {
  const espera = horasDesde(l.data);
  const tempoResposta = l.primeira_resposta_at ? espera - horasDesde(l.primeira_resposta_at) : null;

  return (
    <li className={cn('relative', aberta && 'bg-zinc-50/70')}>
      <span className={cn('absolute inset-y-0 left-0 w-1', URGENCIA_BARRA[l.urgencia])} aria-hidden />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberta}
        className="grid w-full gap-x-4 gap-y-2 py-3.5 pl-5 pr-4 text-left transition-colors hover:bg-zinc-50 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] sm:items-center"
      >
        <div className="min-w-0 text-sm">
          <ClienteCell nome={l.nome_cliente} telefone={l.telefone} fonte={l.nome_fonte} />
        </div>

        <div className="min-w-0">
          <p className="text-sm text-zinc-800">{fraseProblema(l)}</p>
          <p
            className={cn(
              'mt-0.5 flex items-center gap-1 text-xs',
              l.respondido ? 'text-emerald-700' : 'text-red-600'
            )}
          >
            {l.respondido ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {fraseAtendimento(l)}
            {l.respondido && tempoResposta != null && (
              <span className="text-zinc-400">· em {tempoTexto(tempoResposta)}</span>
            )}
            {!l.respondido && <span>há {tempoTexto(espera)}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', URGENCIA_ESTILO[l.urgencia])}>
            {URGENCIA_LABEL[l.urgencia]}
          </span>
          {l.numero_pedido ? (
            <span className="flex items-center gap-0.5 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
              <Hash className="h-3 w-3" />
              {l.numero_pedido}
            </span>
          ) : (
            <span className="rounded-md px-2 py-0.5 text-xs text-zinc-400 border border-dashed border-zinc-200">
              sem pedido
            </span>
          )}
          <span className="hidden w-24 text-right text-xs text-zinc-400 lg:inline">{formatDateTime(l.data)}</span>
          <ChevronDown className={cn('h-4 w-4 text-zinc-400 transition-transform', aberta && 'rotate-180')} />
        </div>
      </button>

      {aberta && (
        <div className="space-y-3 pb-4 pl-5 pr-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">{l.categoria}</span>
            <span>{formatDateTime(l.data)}</span>
            {l.regiao && <span>{l.regiao}</span>}
            {l.tipo_cliente && <span>{l.tipo_cliente.split(' · ')[0]}</span>}
            <a
              href={linkBitrix(l.telefone)}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Abrir no Bitrix <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-lg border border-zinc-200 bg-white p-3">
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">O que o cliente pediu</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">{textoLimpo(l.resumo) || '—'}</p>
            </section>
            <section className="rounded-lg border border-zinc-200 bg-white p-3">
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                O que o atendimento respondeu{l.qtd_respostas > 0 && ` · ${l.qtd_respostas} mensagens`}
              </h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">
                {textoLimpo(l.resposta_atendimento) || (l.respondido ? 'Só saudação até agora.' : 'Ainda não respondeu.')}
              </p>
            </section>
          </div>
        </div>
      )}
    </li>
  );
}

function Resumo({ todas }: { todas: SuporteRow[] }) {
  const total = todas.length;
  const por = (u: Urgencia) => todas.filter((l) => l.urgencia === u).length;
  const aguardando = todas.filter((l) => !l.respondido).length;
  const comPedido = todas.filter((l) => l.numero_pedido).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const itens = [
    { label: 'Pedidos de suporte', valor: String(total), detalhe: 'a Cris passou para o atendimento' },
    { label: 'Aguardando resposta', valor: String(aguardando), detalhe: aguardando ? 'atendimento ainda não respondeu' : 'tudo respondido', destaque: aguardando > 0 },
    { label: 'Com nº do pedido', valor: `${pct(comPedido)}%`, detalhe: `${comPedido} de ${total}` },
  ];

  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
      {itens.map((i) => (
        <div key={i.label} className="bg-white px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">{i.label}</p>
          <p className={cn('mt-1 text-2xl font-semibold tracking-tight', i.destaque ? 'text-red-600' : 'text-zinc-900')}>{i.valor}</p>
          <p className="text-xs text-zinc-400">{i.detalhe}</p>
        </div>
      ))}
      <div className="bg-white px-4 py-3">
        <p className="text-xs font-medium text-zinc-500">Por urgência</p>
        <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-zinc-100">
          {(['alta', 'media', 'baixa'] as Urgencia[]).map((u) =>
            por(u) ? <div key={u} className={URGENCIA_BARRA[u]} style={{ width: `${pct(por(u))}%` }} /> : null
          )}
        </div>
        <div className="mt-2 flex gap-3 text-xs text-zinc-500">
          {(['alta', 'media', 'baixa'] as Urgencia[]).map((u) => (
            <span key={u} className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', URGENCIA_BARRA[u])} />
              {URGENCIA_LABEL[u]} <b className="text-zinc-700">{por(u)}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ReclamacoesPage() {
  const { periodo } = useFilters();
  const [linhas, setLinhas] = useState<SuporteRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState<Aba>('todos');
  const [urgencias, setUrgencias] = useState<Urgencia[]>([]);
  const [categoria, setCategoria] = useState('');
  const [aberta, setAberta] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    getRelatorioSuporte(periodo)
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

  const todas = useMemo(() => ordenarSuporte(linhas ?? []), [linhas]);
  const categorias = useMemo(() => [...new Set(todas.map((l) => l.categoria))].sort(), [todas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return todas.filter((l) => {
      if (aba === 'aguardando' && l.respondido) return false;
      if (aba === 'respondidos' && !l.respondido) return false;
      if (urgencias.length && !urgencias.includes(l.urgencia)) return false;
      if (categoria && l.categoria !== categoria) return false;
      if (!q) return true;
      return [l.nome_cliente, l.telefone, l.numero_pedido, l.regiao, l.resumo, l.resposta_atendimento].some((c) =>
        c?.toLowerCase().includes(q)
      );
    });
  }, [todas, busca, aba, urgencias, categoria]);

  if (erro) return <div className="text-red-500">{erro}</div>;
  if (!linhas) return <div className="text-zinc-400">Carregando...</div>;

  const contagem: Record<Aba, number> = {
    todos: todas.length,
    aguardando: todas.filter((l) => !l.respondido).length,
    respondidos: todas.filter((l) => l.respondido).length,
  };

  function alternarUrgencia(u: Urgencia) {
    setUrgencias((atual) => (atual.includes(u) ? atual.filter((x) => x !== u) : [...atual, u]));
  }

  function exportar() {
    downloadCsv(
      `reclamacoes_${periodo.inicio}_${periodo.fim}.csv`,
      ['Data', 'Urgência', 'Categoria', 'Pedido', 'Cliente', 'Telefone', 'Região', 'Situação', 'O que o atendimento fez',
        'Resumo', 'O que o cliente pediu', 'O que o atendimento respondeu'],
      filtradas.map((l) => [
        formatDateTime(l.data),
        URGENCIA_LABEL[l.urgencia],
        l.categoria,
        l.numero_pedido,
        l.nome_cliente,
        l.telefone,
        l.regiao,
        l.respondido ? 'Respondido' : 'Aguardando',
        l.acao_atendimento,
        fraseResumo(l),
        textoLimpo(l.resumo),
        textoLimpo(l.resposta_atendimento),
      ])
    );
  }

  const abas: { valor: Aba; label: string }[] = [
    { valor: 'todos', label: 'Todos' },
    { valor: 'aguardando', label: 'Aguardando' },
    { valor: 'respondidos', label: 'Respondidos' },
  ];

  return (
    <div className="space-y-5">
      <PaginaIntro veja={[{ href: '/dashboard/handoffs', label: 'Representantes' }]}>
        Clientes que já compraram e a Cris passou para o <b>atendimento</b>: atraso, defeito, rastreio, reclamação,
        erro no site ou cadastro. Cada caso mostra a urgência, o nº do pedido e o que o atendimento já fez. Clique numa
        linha para ver a conversa resumida.
      </PaginaIntro>

      <AlertaSuporte linhas={todas} />

      <Resumo todas={todas} />

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-3 lg:flex-row lg:items-center">
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
            {abas.map((a) => (
              <button
                key={a.valor}
                type="button"
                onClick={() => setAba(a.valor)}
                className={cn(
                  'flex-1 whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors lg:flex-none',
                  aba === a.valor ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                )}
              >
                {a.label} <span className="text-zinc-400">{contagem[a.valor]}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            {(['alta', 'media', 'baixa'] as Urgencia[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => alternarUrgencia(u)}
                aria-pressed={urgencias.includes(u)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  urgencias.includes(u) ? 'border-zinc-800 bg-zinc-800 text-white' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', URGENCIA_BARRA[u])} />
                {URGENCIA_LABEL[u]}
              </button>
            ))}
          </div>

          <div className="flex flex-1 flex-wrap gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Cliente, telefone ou nº do pedido"
                className="w-full rounded-lg border border-zinc-200 py-1.5 pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm"
              aria-label="Tipo de problema"
            >
              <option value="">Todos os tipos</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={exportar}
              title="Exportar CSV"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <p className="p-10 text-center text-sm text-zinc-400">Nenhum caso nesse filtro.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {filtradas.map((l) => (
              <Linha key={l.id} l={l} aberta={aberta === l.id} onToggle={() => setAberta(aberta === l.id ? null : l.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
