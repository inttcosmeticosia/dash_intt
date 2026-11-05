import { createClient } from '@/lib/supabase/client';

export type PeriodFilter = {
  inicio: string;
  fim: string;
};

export type MetricasAtendimento = {
  novos_atendimentos: number;
  conversas_ativas: number;
  transferidos: number;
  transferidos_pela_ia?: number;
  transferidos_pelo_atendimento_humano?: number;
  /** novos atendimentos do período que foram transferidos (base da taxa) */
  novos_transferidos?: number;
  taxa_transferencia: number;
  internacionais: number;
  periodo_anterior: {
    novos_atendimentos: number;
    conversas_ativas: number;
    transferidos: number;
    crescimento_percentual: number | null;
  };
};

export type AtendimentoDiario = {
  dia: string;
  novos: number;
  ativos: number;
  transferidos: number;
};

export type AtendimentoSemanal = {
  semana: string;
  novos: number;
  ativos: number;
  transferidos: number;
};

// Uma linha por cliente por dia (fonte: public.handoff_events via RPC relatorio_transferencias).
// origem: 'ia' (agente transferiu), 'humano' (atendente passou o contato) ou 'humano+ia'.
export type OrigemTransferencia = 'ia' | 'humano';

export type TransferenciaRow = {
  data_handoff: string;
  nome_cliente: string | null;
  telefone_cliente: string;
  razao_social: string | null;
  origem: string;
  destino: string;
  representante: string | null;
  telefone_representante: string | null;
  motivo: string | null;
  regiao: string | null;
  tipo_cliente: string | null;
  pais: string | null;
  resumo: string | null;
  mensagem: string | null;
};

export type SiteRow = {
  data: string;
  nome_cliente: string | null;
  telefone: string;
  regiao: string | null;
  cidade: string | null;
  tipo_cliente: string | null;
  resumo: string | null;
};

export type ConversaInternacional = {
  data: string;
  telefone: string;
  nome: string | null;
  razao_social: string | null;
  pais: string;
  regiao: string | null;
  representante: string | null;
  tipo_cliente: string | null;
  resumo: string | null;
};

export type RelatorioInternacional = {
  total: number;
  por_pais: { pais: string; total: number }[];
  conversas: ConversaInternacional[];
};

export async function getMetricasAtendimento(periodo: PeriodFilter): Promise<MetricasAtendimento> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('metricas_atendimento', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  });
  if (error) throw error;
  return data as MetricasAtendimento;
}

export async function getAtendimentosDiarios(periodo: PeriodFilter): Promise<AtendimentoDiario[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('atendimentos_diarios', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  });
  if (error) throw error;
  return (data ?? []) as AtendimentoDiario[];
}

export async function getAtendimentosSemanais(periodo: PeriodFilter): Promise<AtendimentoSemanal[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('atendimentos_semanais', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  });
  if (error) throw error;
  return (data ?? []) as AtendimentoSemanal[];
}

export async function getRelatorioTransferencias(
  periodo: PeriodFilter,
  origem: OrigemTransferencia | null = null
): Promise<TransferenciaRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('relatorio_transferencias', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
    p_origem: origem,
  });
  if (error) throw error;
  return (data ?? []) as TransferenciaRow[];
}

export async function getRelatorioInternacional(periodo: PeriodFilter): Promise<RelatorioInternacional> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('relatorio_internacional', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  });
  if (error) throw error;
  return data as RelatorioInternacional;
}

export async function getRelatorioSite(periodo: PeriodFilter): Promise<SiteRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('relatorio_site', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  });
  if (error) throw error;
  return (data ?? []) as SiteRow[];
}

export type ProdutoMencionado = {
  produto: string;
  conversas: number;
  em_mensagens: number;
  em_resumos: number;
  eh_categoria: boolean;
};

export async function getProdutosMencionados(
  periodo: PeriodFilter,
  opts?: { incluirCategorias?: boolean; limite?: number }
): Promise<ProdutoMencionado[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('agente_produtos_mencionados', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
    p_incluir_categorias: opts?.incluirCategorias ?? true,
    p_limite: opts?.limite ?? 100,
  });
  if (error) throw error;
  return (data ?? []) as ProdutoMencionado[];
}

export type ProdutosResumo = {
  conversas_distintas: number;
  produtos_citados: number;
};

export async function getProdutosResumo(
  periodo: PeriodFilter,
  opts?: { incluirCategorias?: boolean }
): Promise<ProdutosResumo> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('agente_produtos_resumo', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
    p_incluir_categorias: opts?.incluirCategorias ?? true,
  });
  if (error) throw error;
  return (data ?? { conversas_distintas: 0, produtos_citados: 0 }) as ProdutosResumo;
}

export type TermoCustom = {
  id: number;
  nome: string;
  aliases: string[];
  categoria: boolean;
  criado_em: string;
};

export async function listarTermosCustom(): Promise<TermoCustom[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('analytics_produtos_listar');
  if (error) throw error;
  return (data ?? []) as TermoCustom[];
}

export async function adicionarTermoCustom(input: {
  nome: string;
  aliases: string[];
  categoria: boolean;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('analytics_produtos_adicionar', {
    p_nome: input.nome,
    p_aliases: input.aliases,
    p_categoria: input.categoria,
  });
  if (error) throw error;
}

export async function removerTermoCustom(id: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('analytics_produtos_remover', { p_id: id });
  if (error) throw error;
}

export async function getProfile() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

export async function signIn(email: string, password: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
