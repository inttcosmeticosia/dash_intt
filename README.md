# INTT Analytics

Dashboard de relatórios do atendimento WhatsApp da INTT. Lê direto as tabelas de produção do agente n8n (`conversations`, `inbound_messages`) no Supabase — sem integração Mercos.

## Stack

- **Frontend:** Next.js 16 + Tailwind v4 + Recharts
- **Backend:** Supabase (Postgres + Auth + RPCs)
- **Origem dos dados:** agente de atendimento WhatsApp (n8n) que grava em `conversations`

## Setup

```bash
cp .env.example .env.local
# Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev
```

## Autenticação

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard/project/cltxkixvsfrokxdfpfga/auth/users)
2. Crie um usuário em Authentication → Users
3. O trigger `handle_new_user` cria automaticamente o perfil em `profiles`
4. Para admin, atualize `profiles.role = 'admin'` via SQL

## Relatórios disponíveis

Todos filtráveis por data (filtro de período no topo do dashboard).

| Página | Conteúdo | RPCs |
|--------|----------|------|
| `/dashboard` | KPIs do período, atendimentos por dia, transferências por dia, resumo semanal | `metricas_atendimento`, `atendimentos_diarios`, `atendimentos_semanais` |
| `/dashboard/handoffs` | Transferências para representantes: ranking + tabela completa + export CSV | `relatorio_handoffs`, `handoffs_por_representante` |
| `/dashboard/internacional` | Atendimentos fora do Brasil por país (DDI do telefone) + export CSV | `relatorio_internacional` |

### Regras de negócio

- **Conversa válida:** `phone` com mais de 5 caracteres (IDs internos do conector Bitrix são ignorados)
- **Novo atendimento:** conversa criada no dia (`created_at`, fuso America/Sao_Paulo)
- **Conversa ativa:** conversa com mensagem recebida no dia (`inbound_messages.received_at`)
- **Transferência (handoff):** coluna `Representante` preenchida; data = `coalesce(last_message_at, created_at)`
- **Internacional:** DDI do telefone diferente de 55 (país derivado do prefixo)

## Estrutura

```
src/
├── app/
│   ├── (auth)/login/
│   └── (protected)/dashboard/
│       ├── page.tsx           # Visão Geral
│       ├── handoffs/          # Transferências
│       └── internacional/     # Fora do Brasil
├── components/
├── contexts/
├── lib/supabase/
└── services/analytics.ts
```
