'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, History, Loader2, MessageSquare, RotateCcw, ScrollText } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { PromptPropostaCard } from '@/components/PromptPropostaCard';
import { cn, formatDateTime } from '@/lib/utils';
import {
  getHistoricoPrompt,
  getPromptAtual,
  restaurarVersao,
  type PromptAtual,
  type VersaoHistorico,
} from '@/services/iaPrompt';

/** Extrai as linhas "- regra" do bloco <regras_ajustaveis>. */
function listarRegras(bloco: string | null): string[] {
  if (!bloco) return [];
  return bloco
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2));
}

function resumoAlteracoes(v: VersaoHistorico): string {
  const a = v.alteracoes ?? [];
  if (!a.length) return v.pedido ?? '—';
  const regras = a.filter((x) => 'adicionar_regra' in x).length;
  const trocas = a.length - regras;
  return [regras && `${regras} regra${regras > 1 ? 's' : ''} nova${regras > 1 ? 's' : ''}`, trocas && `${trocas} trecho${trocas > 1 ? 's' : ''} alterado${trocas > 1 ? 's' : ''}`]
    .filter(Boolean)
    .join(' · ');
}

export default function PromptCrisPage() {
  const [atual, setAtual] = useState<PromptAtual | null>(null);
  const [hist, setHist] = useState<VersaoHistorico[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [verCompleto, setVerCompleto] = useState(false);
  const [restaurando, setRestaurando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [a, h] = await Promise.all([getPromptAtual(), getHistoricoPrompt(30)]);
      setAtual(a);
      setHist(h);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o prompt.');
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    Promise.all([getPromptAtual(), getHistoricoPrompt(30)])
      .then(([a, h]) => {
        if (!ativo) return;
        setAtual(a);
        setHist(h);
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar o prompt.');
      });
    return () => {
      ativo = false;
    };
  }, []);

  async function restaurar(v: number) {
    if (!window.confirm(`Voltar o prompt da Cris para a versão ${v}? Isso cria uma versão nova e vale já na próxima mensagem do WhatsApp.`)) return;
    setRestaurando(v);
    setAviso(null);
    try {
      const r = await restaurarVersao(v, 'Restaurado pelo painel');
      setAviso(`Versão ${v} restaurada como versão ${r.versao}.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao restaurar.');
    } finally {
      setRestaurando(null);
    }
  }

  if (erro && !atual) return <div className="text-red-500">{erro}</div>;
  if (!atual) return <div className="text-zinc-400">Carregando...</div>;

  const regras = listarRegras(atual.regras);
  const publicadas = hist.filter((h) => h.status !== 'proposta');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Versão no ar" value={`v${atual.versao}`} subtitle={atual.publicado_em ? formatDateTime(atual.publicado_em) : undefined} />
        <KpiCard label="Publicada por" value={atual.autor ?? 'Sistema'} />
        <KpiCard label="Regras da equipe" value={String(regras.length)} subtitle="têm prioridade sobre o resto do prompt" />
        <KpiCard label="Versões publicadas" value={String(publicadas.length)} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
        <p>
          A Cris (IA do WhatsApp) lê esta versão a cada mensagem. Para mudar o comportamento dela, peça no{' '}
          <Link href="/dashboard/agente" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
            <MessageSquare className="h-3.5 w-3.5" /> Agente
          </Link>{' '}
          — ex.: <i>&quot;por que a Cris respondeu assim ao cliente 5511…?&quot;</i> ou <i>&quot;a Cris tem que perguntar X antes do link&quot;</i>.
          Ele mostra o antes/depois e nada vai ao ar sem você clicar em <b>Publicar</b>.
        </p>
      </div>

      {aviso && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{aviso}</p>}
      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {atual.proposta_pendente && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-800">Proposta aguardando publicação</h2>
          <PromptPropostaCard key={atual.proposta_pendente} propostaId={atual.proposta_pendente} onChange={() => void carregar()} />
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-800">Regras definidas pela equipe</h2>
        {regras.length ? (
          <ol className="list-decimal space-y-2 py-3 pl-9 pr-4 text-sm text-zinc-700">
            {regras.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        ) : (
          <p className="px-4 py-3 text-sm text-zinc-500">Nenhuma regra extra ainda. As regras criadas pelo Agente aparecem aqui.</p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <h2 className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-800">
          <History className="h-4 w-4 text-zinc-400" /> Histórico de versões
        </h2>
        <div className="divide-y divide-zinc-100">
          {publicadas.map((v) => (
            <div key={v.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
              <span
                className={cn(
                  'mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                  v.status === 'ativa' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-zinc-100 text-zinc-600 ring-zinc-200'
                )}
              >
                v{v.versao}
                {v.status === 'ativa' ? ' · no ar' : ''}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-zinc-800">{v.motivo || v.pedido || (v.versao === 0 ? 'Prompt original (antes do painel)' : 'Versão inicial no painel')}</p>
                <p className="text-xs text-zinc-500">
                  {formatDateTime(v.publicado_em ?? v.criado_em)}
                  {v.autor ? ` · ${v.autor}` : ''}
                  {v.alteracoes?.length ? ` · ${resumoAlteracoes(v)}` : ''}
                </p>
              </div>
              {v.status !== 'ativa' && v.versao !== null && v.versao > 0 && (
                <button
                  type="button"
                  onClick={() => void restaurar(v.versao as number)}
                  disabled={restaurando !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:border-brand-300 hover:text-brand-800 disabled:opacity-50"
                >
                  {restaurando === v.versao ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Restaurar
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setVerCompleto((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-zinc-800"
        >
          <ScrollText className="h-4 w-4 text-zinc-400" />
          Prompt completo (v{atual.versao}, {atual.tamanho.toLocaleString('pt-BR')} caracteres)
          <ChevronDown className={cn('ml-auto h-4 w-4 text-zinc-400 transition-transform', verCompleto && 'rotate-180')} />
        </button>
        {verCompleto && (
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words border-t border-zinc-100 px-4 py-3 font-mono text-xs leading-relaxed text-zinc-700">
            {atual.conteudo}
          </pre>
        )}
      </section>
    </div>
  );
}
