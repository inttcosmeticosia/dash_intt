import { createClient } from '@/lib/supabase/client';

// Prompt da Cris (agente de vendas do WhatsApp), versionado em public.ia_prompts.
// O n8n lê a versão ATIVA a cada mensagem; estas RPCs (dash_ia_prompt_*) checam login
// e registram o e-mail de quem publicou/editou.

export type Alteracao = { adicionar_regra: string } | { buscar: string; substituir: string };

export type PropostaItem = {
  tipo: 'nova_regra' | 'troca' | 'remocao';
  antes: string | null;
  depois: string;
};

export type Proposta = {
  ok: true;
  id: number;
  status: 'proposta' | 'ativa' | 'arquivada' | 'descartada';
  versao: number | null;
  base_versao: number | null;
  versao_ativa: number | null;
  pedido: string | null;
  motivo: string | null;
  autor: string | null;
  criado_em: string;
  publicado_em: string | null;
  alteracoes: Alteracao[];
  itens: PropostaItem[];
};

export type PromptAtual = {
  ok: true;
  id: number;
  versao: number;
  status: string;
  autor: string | null;
  publicado_em: string | null;
  criado_em: string;
  pedido: string | null;
  tamanho: number;
  regras: string | null;
  conteudo: string;
  proposta_pendente: number | null;
};

export type VersaoHistorico = {
  id: number;
  versao: number | null;
  status: 'proposta' | 'ativa' | 'arquivada';
  pedido: string | null;
  motivo: string | null;
  autor: string | null;
  criado_em: string;
  publicado_em: string | null;
  base_versao: number | null;
  alteracoes: Alteracao[] | null;
  tamanho: number;
};

type Falha = { ok: false; erro: string };

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  const r = data as T | Falha;
  if (r && typeof r === 'object' && 'ok' in r && r.ok === false) throw new Error((r as Falha).erro);
  return r as T;
}

export const getPromptAtual = (versao?: number) =>
  rpc<PromptAtual>('dash_ia_prompt_atual', { p_versao: versao ?? null });

export const getProposta = (id: number) => rpc<Proposta>('dash_ia_prompt_proposta', { p_id: id });

export const proporAlteracao = (alteracoes: Alteracao[], pedido?: string, motivo?: string) =>
  rpc<{ ok: true; proposta_id: number }>('dash_ia_prompt_propor', {
    p_alteracoes: alteracoes,
    p_pedido: pedido ?? null,
    p_motivo: motivo ?? null,
  });

export const publicarProposta = (id: number) =>
  rpc<{ ok: true; versao: number; versao_anterior: number }>('dash_ia_prompt_publicar', { p_id: id });

export const descartarProposta = (id: number) => rpc<{ ok: true }>('dash_ia_prompt_descartar', { p_id: id });

export const getHistoricoPrompt = (limite = 30) =>
  rpc<VersaoHistorico[]>('dash_ia_prompt_historico', { p_limite: limite });

export const restaurarVersao = (versao: number, motivo?: string) =>
  rpc<{ ok: true; versao: number }>('dash_ia_prompt_restaurar', { p_versao: versao, p_motivo: motivo ?? null });

/** Salva o prompt inteiro editado à mão como proposta (não publica). */
export const proporConteudo = (conteudo: string, trechos: unknown[], motivo?: string) =>
  rpc<{ ok: true; proposta_id: number }>('dash_ia_prompt_propor_conteudo', {
    p_conteudo: conteudo,
    p_alteracoes: trechos,
    p_motivo: motivo ?? null,
  });
