# Integração n8n — Tools de Analytics INTT

Este documento descreve como estender o fluxo n8n existente (Bitrix24 + WhatsApp) para que a IA consulte métricas de vendas via RPCs do Supabase INTT.

## Pré-requisitos

- Projeto Supabase: `https://cltxkixvsfrokxdfpfga.supabase.co`
- Service Role Key (apenas no n8n, nunca no frontend)
- Fluxo n8n existente com AI Agent

## Configuração no n8n

### 1. Variáveis de ambiente no n8n

```
SUPABASE_URL=https://cltxkixvsfrokxdfpfga.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<sua_service_role_key>
```

### 2. Tool HTTP Request — Faturamento Geral

Adicione um **HTTP Request Tool** ao AI Agent:

| Campo | Valor |
|-------|-------|
| Method | POST |
| URL | `{{ $env.SUPABASE_URL }}/rest/v1/rpc/metricas_vendas_gerais` |
| Headers | `apikey: {{ $env.SUPABASE_SERVICE_ROLE_KEY }}` |
| Headers | `Authorization: Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}` |
| Headers | `Content-Type: application/json` |
| Body | `{"p_inicio": "2026-06-01", "p_fim": "2026-06-30", "p_comparar_anterior": true}` |

**Nome da tool:** `consultar_faturamento`
**Descrição:** Consulta faturamento total, quantidade de pedidos, ticket médio e comparativo com período anterior. Parâmetros: p_inicio (date), p_fim (date), p_comparar_anterior (boolean).

### 3. Tool — Ranking de Vendedores

| Campo | Valor |
|-------|-------|
| URL | `{{ $env.SUPABASE_URL }}/rest/v1/rpc/ranking_vendedores` |
| Body | `{"p_inicio": "2026-06-01", "p_fim": "2026-06-30", "p_limite": 10}` |

**Nome:** `ranking_vendedores`

### 4. Tool — Análise de Revendedores

| Campo | Valor |
|-------|-------|
| URL | `{{ $env.SUPABASE_URL }}/rest/v1/rpc/analise_revendedor` |
| Body | `{"p_inicio": "2026-06-01", "p_fim": "2026-06-30", "p_vendedor_id": null, "p_estado": null}` |

**Nome:** `analise_revendedores`

### 5. Tool — Análise de Produtos

| Campo | Valor |
|-------|-------|
| URL | `{{ $env.SUPABASE_URL }}/rest/v1/rpc/analise_produtos` |
| Body | `{"p_inicio": "2026-06-01", "p_fim": "2026-06-30", "p_agrupar": "produto"}` |

**Nome:** `analise_produtos`
Use `p_agrupar: "categoria"` para categorias.

### 6. Tool — Recorrência de Clientes

| Campo | Valor |
|-------|-------|
| URL | `{{ $env.SUPABASE_URL }}/rest/v1/rpc/analise_recorrencia` |
| Body | `{"p_inicio": "2026-06-01", "p_fim": "2026-06-30"}` |

**Nome:** `analise_recorrencia`

### 7. Tool — Conversão WhatsApp

| Campo | Valor |
|-------|-------|
| URL | `{{ $env.SUPABASE_URL }}/rest/v1/rpc/analise_conversao` |
| Body | `{"p_inicio": "2026-06-01", "p_fim": "2026-06-30"}` |

**Nome:** `analise_conversao`

### 8. Tool — Produtos Cesta (Cross-sell)

| Campo | Valor |
|-------|-------|
| URL | `{{ $env.SUPABASE_URL }}/rest/v1/rpc/produtos_cesta` |
| Body | `{"p_cliente_id": null}` |

**Nome:** `produtos_cesta`

## System Prompt sugerido

```
Você é o assistente de analytics comercial da INTT. Você tem acesso a ferramentas que consultam dados de vendas sincronizados do Mercos.

Métricas disponíveis:
- Faturamento, pedidos, ticket médio e comparativo entre períodos
- Ranking de vendedores
- Revendedores ativos, inativos e com potencial de crescimento
- Produtos mais vendidos, categorias e cross-sell
- Recorrência, churn risk e LTV de clientes
- Taxa de conversão WhatsApp → venda

Regras:
- Responda sempre em português brasileiro
- Formate valores em R$ (ex: R$ 142.300,00)
- Formate percentuais com uma casa decimal
- Se o usuário não especificar período, use o mês atual
- Limite consultas a no máximo 12 meses de histórico
- Nunca exponha tokens ou dados técnicos internos
```

## Exemplo de conversa

**Usuário:** Qual o faturamento de junho?

**Agent:** (chama `consultar_faturamento` com p_inicio=2026-06-01, p_fim=2026-06-30)

**Resposta formatada:** "Em junho/2026 o faturamento foi R$ 142.300,00 com 48 pedidos. O ticket médio ficou em R$ 2.964,58, representando crescimento de +8,2% em relação a maio."

## Sincronização de dados

Para manter dados atualizados, configure um workflow n8n com Cron Trigger:

```
POST https://seu-dominio.com/api/mercos/sync
Authorization: Bearer <CRON_SECRET>
```

Ou chame diretamente quando tokens Mercos estiverem disponíveis.

## RPCs disponíveis (referência)

| RPC | Parâmetros |
|-----|-----------|
| `metricas_vendas_gerais` | p_inicio, p_fim, p_comparar_anterior |
| `ranking_vendedores` | p_inicio, p_fim, p_limite |
| `analise_revendedor` | p_inicio, p_fim, p_vendedor_id, p_estado |
| `analise_produtos` | p_inicio, p_fim, p_agrupar |
| `produtos_cesta` | p_cliente_id |
| `analise_recorrencia` | p_inicio, p_fim |
| `analise_conversao` | p_inicio, p_fim |
| `tempo_resposta_vendedor` | p_vendedor_id |
