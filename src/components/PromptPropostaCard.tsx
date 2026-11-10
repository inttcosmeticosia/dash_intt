'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Rocket, Trash2, X } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import {
  descartarProposta,
  getProposta,
  proporAlteracao,
  publicarProposta,
  type Alteracao,
  type Proposta,
} from '@/services/iaPrompt';

const STATUS: Record<Proposta['status'], { label: string; cls: string }> = {
  proposta: { label: 'Aguardando publicação', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  ativa: { label: 'No ar', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  arquivada: { label: 'Publicada (versão antiga)', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200' },
  descartada: { label: 'Descartada', cls: 'bg-zinc-100 text-zinc-500 ring-zinc-200' },
};

const TIPO: Record<string, string> = {
  nova_regra: 'Nova regra',
  troca: 'Alteração de texto',
  remocao: 'Remoção de texto',
};

function Bloco({ titulo, texto, tom }: { titulo: string; texto: string; tom: 'antes' | 'depois' }) {
  return (
    <div className="min-w-0 flex-1">
      <p className={cn('mb-1 text-[11px] font-semibold uppercase tracking-wide', tom === 'antes' ? 'text-red-600' : 'text-emerald-700')}>
        {titulo}
      </p>
      <pre
        className={cn(
          'max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border px-3 py-2 font-mono text-xs leading-relaxed',
          tom === 'antes' ? 'border-red-200 bg-red-50/60 text-red-900' : 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
        )}
      >
        {texto || <span className="italic text-zinc-400">(vazio — trecho removido)</span>}
      </pre>
    </div>
  );
}

type Props = {
  propostaId: number;
  /** Chamado depois de publicar/descartar/editar, para a tela recarregar o que precisar. */
  onChange?: () => void;
};

export function PromptPropostaCard({ propostaId, onChange }: Props) {
  const [id, setId] = useState(propostaId);
  const [p, setP] = useState<Proposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [acao, setAcao] = useState<null | 'publicar' | 'descartar' | 'salvar'>(null);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async (pid: number) => {
    try {
      setP(await getProposta(pid));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar a proposta.');
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    getProposta(id)
      .then((r) => {
        if (!ativo) return;
        setP(r);
        setErro(null);
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar a proposta.');
      });
    return () => {
      ativo = false;
    };
  }, [id]);

  async function publicar() {
    if (!p) return;
    setAcao('publicar');
    setAviso(null);
    try {
      const r = await publicarProposta(p.id);
      setAviso(`Publicado como versão ${r.versao}. A próxima mensagem no WhatsApp já usa esta versão.`);
      await carregar(p.id);
      onChange?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao publicar.');
    } finally {
      setAcao(null);
    }
  }

  async function descartar() {
    if (!p) return;
    setAcao('descartar');
    try {
      await descartarProposta(p.id);
      await carregar(p.id);
      onChange?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao descartar.');
    } finally {
      setAcao(null);
    }
  }

  function abrirEdicao() {
    if (!p) return;
    setRascunho(p.itens.map((i) => i.depois));
    setEditando(true);
    setErro(null);
  }

  async function salvarEdicao() {
    if (!p) return;
    const novas: Alteracao[] = p.alteracoes.map((a, i) =>
      'adicionar_regra' in a ? { adicionar_regra: rascunho[i] ?? '' } : { buscar: a.buscar, substituir: rascunho[i] ?? '' }
    );
    setAcao('salvar');
    try {
      const r = await proporAlteracao(novas, p.pedido ?? undefined, `Editado no painel a partir da proposta #${p.id}`);
      setEditando(false);
      setAviso(`Nova proposta #${r.proposta_id} criada com a sua edição. Revise e clique em Publicar.`);
      setId(r.proposta_id);
      onChange?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar a edição.');
    } finally {
      setAcao(null);
    }
  }

  if (!p) {
    return (
      <div className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 shadow-sm">
        {erro ?? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando proposta #{id}…
          </span>
        )}
      </div>
    );
  }

  const st = STATUS[p.status];
  const pendente = p.status === 'proposta';
  const desatualizada = pendente && p.base_versao !== p.versao_ativa;

  return (
    <div className="w-full max-w-[95%] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5">
        <div className="text-sm font-semibold text-zinc-800">
          Ajuste no prompt da Cris <span className="font-normal text-zinc-400">#{p.id}</span>
        </div>
        <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1', st.cls)}>
          {p.status === 'ativa' || p.status === 'arquivada' ? `${st.label} · v${p.versao}` : st.label}
        </span>
      </div>

      <div className="space-y-4 px-4 py-3">
        {(p.pedido || p.motivo) && (
          <div className="space-y-0.5 text-xs text-zinc-600">
            {p.pedido && (
              <p>
                <b className="text-zinc-700">Pedido:</b> {p.pedido}
              </p>
            )}
            {p.motivo && (
              <p>
                <b className="text-zinc-700">O que muda:</b> {p.motivo}
              </p>
            )}
          </div>
        )}

        {p.itens.map((item, i) => (
          <div key={i} className="space-y-2">
            <p className="text-xs font-medium text-zinc-500">
              {i + 1}. {TIPO[item.tipo] ?? item.tipo}
            </p>
            <div className="flex flex-col gap-2 lg:flex-row">
              {item.tipo === 'nova_regra' ? (
                <Bloco titulo="Antes" texto="(regra não existia)" tom="antes" />
              ) : (
                <Bloco titulo="Antes" texto={item.antes ?? ''} tom="antes" />
              )}
              {editando ? (
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Depois (editando)</p>
                  <textarea
                    value={rascunho[i] ?? ''}
                    onChange={(e) => setRascunho((r) => r.map((v, k) => (k === i ? e.target.value : v)))}
                    rows={Math.min(14, Math.max(4, (rascunho[i] ?? '').split('\n').length + 1))}
                    className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              ) : (
                <Bloco titulo="Depois" texto={item.depois} tom="depois" />
              )}
            </div>
          </div>
        ))}

        {desatualizada && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            O prompt mudou depois desta proposta (agora está na versão {p.versao_ativa}). Peça uma nova sugestão ao agente.
          </p>
        )}
        {aviso && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{aviso}</p>}
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {pendente && !editando && (
            <>
              <button
                type="button"
                onClick={() => void publicar()}
                disabled={acao !== null || desatualizada}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {acao === 'publicar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Publicar
              </button>
              <button
                type="button"
                onClick={abrirEdicao}
                disabled={acao !== null || desatualizada}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:border-brand-300 hover:text-brand-800 disabled:opacity-50"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
              <button
                type="button"
                onClick={() => void descartar()}
                disabled={acao !== null}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
              >
                {acao === 'descartar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Descartar
              </button>
            </>
          )}
          {editando && (
            <>
              <button
                type="button"
                onClick={() => void salvarEdicao()}
                disabled={acao !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {acao === 'salvar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Salvar edição
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                disabled={acao !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
              <span className="text-xs text-zinc-500">Salvar cria uma nova proposta; nada vai ao ar sem Publicar.</span>
            </>
          )}
          {!pendente && (
            <span className="text-xs text-zinc-500">
              {p.publicado_em ? `Publicado em ${formatDateTime(p.publicado_em)}${p.autor ? ` por ${p.autor}` : ''}` : `Criado em ${formatDateTime(p.criado_em)}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
