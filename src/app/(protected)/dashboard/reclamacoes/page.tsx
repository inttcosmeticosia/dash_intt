'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, ExternalLink, Search } from 'lucide-react';
import { AlertaSuporte } from '@/components/AlertaSuporte';
import { KpiCardNumber } from '@/components/KpiCard';
import { useFilters } from '@/contexts/FilterContext';
import { downloadCsv, formatDateTime, formatPhone } from '@/lib/utils';
import {
  URGENCIA_ESTILO,
  URGENCIA_LABEL,
  fraseResumo,
  horasDesde,
  linkBitrix,
  ordenarSuporte,
  tempoTexto,
} from '@/lib/suporte';
import { getRelatorioSuporte, type SuporteRow, type Urgencia } from '@/services/analytics';

// Tudo que a IA passou para o suporte humano: reclamação, atraso, defeito, rastreio, checkout, cadastro.
// Urgência: Alta = atraso, defeito, reação ou menção a Procon/cancelar; Média = reclamação e rastreio; Baixa = resto.

const textoLimpo = (s: string | null) => (s ?? '').replace(/\\n/g, '\n').trim();

function CardSuporte({ l }: { l: SuporteRow }) {
  const [aberto, setAberto] = useState(false);
  const espera = horasDesde(l.data);

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        !l.respondido && l.urgencia === 'alta' ? 'border-red-300' : 'border-zinc-200'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${URGENCIA_ESTILO[l.urgencia]}`}>
          {URGENCIA_LABEL[l.urgencia]}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">{l.categoria}</span>
        {l.numero_pedido ? (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">Pedido {l.numero_pedido}</span>
        ) : (
          <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-zinc-400">sem nº do pedido</span>
        )}
        {l.respondido ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
            Respondido{l.primeira_resposta_at && ` em ${tempoTexto(horasDesde(l.data) - horasDesde(l.primeira_resposta_at))}`}
          </span>
        ) : (
          <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">
            Aguardando há {tempoTexto(espera)}
          </span>
        )}
        <span className="ml-auto text-zinc-400">{formatDateTime(l.data)}</span>
      </div>

      <p className="mt-3 text-sm font-medium text-zinc-900">{fraseResumo(l)}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>{formatPhone(l.telefone)}</span>
        {l.regiao && <span>{l.regiao}</span>}
        {l.tipo_cliente && <span>{l.tipo_cliente.split(' · ')[0]}</span>}
        <a
          href={linkBitrix(l.telefone)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-semibold text-brand-600 hover:underline"
        >
          Abrir no Bitrix <ExternalLink className="h-3 w-3" />
        </a>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="flex items-center gap-1 font-semibold text-zinc-600 hover:text-zinc-900"
        >
          {aberto ? 'Esconder detalhes' : 'Ver detalhes'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {aberto && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Resumo da IA</p>
            <p className="whitespace-pre-line text-sm text-zinc-700">{textoLimpo(l.resumo) || '—'}</p>
          </div>
          <div className="rounded-lg bg-emerald-50/60 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Resposta do atendimento {l.qtd_respostas > 0 && `(${l.qtd_respostas} mensagens)`}
            </p>
            <p className="whitespace-pre-line text-sm text-zinc-700">
              {textoLimpo(l.resposta_atendimento) || (l.respondido ? 'Só saudação até agora.' : 'Ainda não respondeu.')}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ReclamacoesPage() {
  const { periodo } = useFilters();
  const [linhas, setLinhas] = useState<SuporteRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [urgencia, setUrgencia] = useState<'' | Urgencia>('');
  const [categoria, setCategoria] = useState('');
  const [status, setStatus] = useState<'' | 'pendente' | 'respondido'>('');

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
      if (urgencia && l.urgencia !== urgencia) return false;
      if (categoria && l.categoria !== categoria) return false;
      if (status === 'pendente' && l.respondido) return false;
      if (status === 'respondido' && !l.respondido) return false;
      if (!q) return true;
      return [l.nome_cliente, l.telefone, l.numero_pedido, l.regiao, l.resumo, l.resposta_atendimento]
        .some((c) => c?.toLowerCase().includes(q));
    });
  }, [todas, busca, urgencia, categoria, status]);

  if (erro) return <div className="text-red-500">{erro}</div>;
  if (!linhas) return <div className="text-zinc-400">Carregando...</div>;

  const alta = todas.filter((l) => l.urgencia === 'alta').length;
  const pendentes = todas.filter((l) => !l.respondido).length;
  const comPedido = todas.filter((l) => l.numero_pedido).length;

  function exportar() {
    downloadCsv(
      `reclamacoes_${periodo.inicio}_${periodo.fim}.csv`,
      ['Data', 'Urgência', 'Categoria', 'Pedido', 'Cliente', 'Telefone', 'Região', 'Situação', 'O que o atendimento fez',
        'Resumo', 'Resumo da IA', 'Resposta do atendimento'],
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

  const select = 'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm';

  return (
    <div className="space-y-6">
      <AlertaSuporte linhas={todas} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardNumber label="Pedidos de Suporte" value={todas.length} subtitle="IA passou para o atendimento" />
        <KpiCardNumber label="Urgência Alta" value={alta} subtitle="atraso, defeito, reação" />
        <KpiCardNumber label="Aguardando Atendimento" value={pendentes} />
        <KpiCardNumber label="Com Nº do Pedido" value={comPedido} subtitle={`de ${todas.length}`} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, telefone, nº do pedido..."
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select value={urgencia} onChange={(e) => setUrgencia(e.target.value as '' | Urgencia)} className={select}>
          <option value="">Todas as urgências</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={select}>
          <option value="">Todos os tipos</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as '' | 'pendente' | 'respondido')} className={select}>
          <option value="">Todas as situações</option>
          <option value="pendente">Aguardando atendimento</option>
          <option value="respondido">Respondidos</option>
        </select>
        <button
          onClick={exportar}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        {filtradas.length} de {todas.length} · ordem: aguardando atendimento primeiro, depois urgência.
      </p>

      <div className="space-y-3">
        {filtradas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-400">
            Nenhum pedido de suporte nesse filtro.
          </p>
        ) : (
          filtradas.map((l) => <CardSuporte key={l.id} l={l} />)
        )}
      </div>
    </div>
  );
}
