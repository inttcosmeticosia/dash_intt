export type Database = {
  public: {
    Tables: {
      profiles: { Row: { id: string; nome: string; role: string }; Insert: { id: string; nome: string; role?: string } };
      // Tabela de produção do agente WhatsApp/n8n (leitura via RPCs abaixo — não escrever a partir do dashboard)
      conversations: {
        Row: {
          conv_key: string;
          origin: string;
          api: string;
          phone: string | null;
          chat_id: string | null;
          is_group: boolean;
          last_message_at: string | null;
          last_dispatch_at: string | null;
          created_at: string;
          updated_at: string;
          Cidade: string | null;
          Endereco: string | null;
          CEP: string | null;
          Tipo_Cliente: string | null;
          Resumo: string | null;
          Nome: string | null;
          Representante: string | null;
          'Telefone Representante': string | null;
          Razao_social: string | null;
          representante_email: string | null;
          Regiao: string | null;
          Resumo_Qualificacao: string | null;
          handoff_to: string | null;
          reason: string | null;
        };
      };
      inbound_messages: {
        Row: {
          id: number;
          conv_key: string;
          platform_msg_id: string | null;
          received_at: string;
          type: string | null;
          text: string | null;
          created_at: string;
        };
      };
    };
    Functions: {
      metricas_atendimento: { Args: { p_inicio: string; p_fim: string }; Returns: Record<string, unknown> };
      atendimentos_diarios: { Args: { p_inicio: string; p_fim: string }; Returns: unknown };
      atendimentos_semanais: { Args: { p_inicio: string; p_fim: string }; Returns: unknown };
      relatorio_handoffs: { Args: { p_inicio: string; p_fim: string }; Returns: unknown };
      handoffs_por_representante: { Args: { p_inicio: string; p_fim: string }; Returns: unknown };
      relatorio_internacional: { Args: { p_inicio: string; p_fim: string }; Returns: Record<string, unknown> };
    };
  };
};
