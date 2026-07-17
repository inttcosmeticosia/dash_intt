import { createClient } from '@/lib/supabase/client';

export type PeriodFilter = {
  inicio: string;
  fim: string;
};

export type MetricasAtendimento = {
  novos_atendimentos: number;
  conversas_ativas: number;
  transferidos: number;
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

export type HandoffRow = {
  data_handoff: string;
  nome_cliente: string | null;
  telefone_cliente: string;
  razao_social: string | null;
  representante: string;
  telefone_representante: string | null;
  regiao: string | null;
  tipo_cliente: string | null;
  motivo: string | null;
  pais: string | null;
};

export type RepresentanteRanking = {
  representante: string;
  telefone_representante: string | null;
  total: number;
  ultima_transferencia: string;
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

export async function getRelatorioHandoffs(periodo: PeriodFilter): Promise<HandoffRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('relatorio_handoffs', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  });
  if (error) throw error;
  return (data ?? []) as HandoffRow[];
}

export async function getHandoffsPorRepresentante(periodo: PeriodFilter): Promise<RepresentanteRanking[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('handoffs_por_representante', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  });
  if (error) throw error;
  return (data ?? []) as RepresentanteRanking[];
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
