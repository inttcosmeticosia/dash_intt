# Agente de relatórios (n8n) — atendimento WhatsApp

Agente de IA no n8n que responde perguntas sobre relatórios, conversas e informações do atendimento, consultando o Supabase (`cltxkixvsfrokxdfpfga`) **exclusivamente via RPCs** — nunca SQL livre.

## Por que RPCs e não consulta direta

| Critério | RPC (escolhido) | SQL direto gerado pelo LLM |
|---|---|---|
| Regras de negócio | Centralizadas nas funções: conversa válida = `length(phone) > 5`, fuso `America/Sao_Paulo`, handoff = `Representante` preenchido, labels Bitrix de `Tipo_Cliente`, país por DDI, `Resumo` com `\n` literal | LLM teria que reaprender cada regra a cada pergunta; erra silenciosamente |
| Segurança | `SECURITY DEFINER`, `search_path = ''`, guard `analytics_check_acesso()`, `EXECUTE` revogado de `anon` | Exigiria credencial com acesso amplo a um banco **compartilhado** (RAG, n8n, tabelas de produção) |
| Risco operacional | Read-only, `LIMIT` interno (busca ≤ 50 linhas, mensagens ≤ 100) | Scans pesados / joins errados em produção |
| Determinismo | Mesma pergunta → mesma query → testável | Query muda a cada geração |

## Ferramentas do agente (8 tools = 8 RPCs)

RPCs de agregados já existentes (migration `create_atendimentos_rpcs`) + 2 novos para conversas (migration `create_agente_rpcs`):

| Tool | RPC | Quando o agente usa |
|---|---|---|
| `metricas_periodo` | `metricas_atendimento(p_inicio, p_fim)` | KPIs: novos, ativos, transferidos, taxa, internacionais, comparação com período anterior |
| `serie_diaria` | `atendimentos_diarios(p_inicio, p_fim)` | Evolução dia a dia |
| `serie_semanal` | `atendimentos_semanais(p_inicio, p_fim)` | Evolução semanal (semana ISO) |
| `relatorio_transferencias` | `relatorio_handoffs(p_inicio, p_fim)` | Lista de handoffs estilo planilha |
| `ranking_representantes` | `handoffs_por_representante(p_inicio, p_fim)` | Quem mais recebeu transferências |
| `relatorio_internacional` | `relatorio_internacional(p_inicio, p_fim)` | Atendimentos fora do Brasil, por país |
| `buscar_conversas` | `agente_buscar_conversas(p_busca, p_inicio, p_fim, p_representante, p_tipo_cliente, p_pais, p_apenas_transferidas, p_limite)` | Procurar conversas por nome, telefone, cidade, região, texto do resumo; todos os parâmetros opcionais |
| `detalhe_conversa` | `agente_detalhe_conversa(p_conv_key, p_telefone, p_max_mensagens)` | Ficha completa de uma conversa + últimas mensagens recebidas |

## Montagem no n8n

Workflow: **Chat Trigger (ou WhatsApp) → AI Agent (Tools Agent) → resposta**.

### Opção A — Postgres Tool (recomendada: credencial Postgres já existe no n8n do agente WhatsApp)

Um node **Postgres Tool** por RPC, query com `$fromAI`:

```sql
select * from public.metricas_atendimento(
  '{{ $fromAI("p_inicio", "data inicial YYYY-MM-DD") }}'::date,
  '{{ $fromAI("p_fim", "data final YYYY-MM-DD") }}'::date
);
```

```sql
select * from public.agente_buscar_conversas(
  p_busca => nullif('{{ $fromAI("busca", "texto livre: nome, telefone, cidade ou assunto; vazio se nao usar") }}', ''),
  p_inicio => nullif('{{ $fromAI("inicio", "data inicial YYYY-MM-DD ou vazio") }}', '')::date,
  p_fim => nullif('{{ $fromAI("fim", "data final YYYY-MM-DD ou vazio") }}', '')::date,
  p_representante => nullif('{{ $fromAI("representante", "nome do representante ou vazio") }}', ''),
  p_apenas_transferidas => coalesce(nullif('{{ $fromAI("apenas_transferidas", "true ou false") }}', '')::boolean, false)
);
```

```sql
select public.agente_detalhe_conversa(
  p_conv_key => nullif('{{ $fromAI("conv_key", "conv_key exato ou vazio") }}', ''),
  p_telefone => nullif('{{ $fromAI("telefone", "telefone do cliente ou vazio") }}', '')
);
```

Conexão direta como `postgres` passa o guard `analytics_check_acesso()`. Se criar uma role dedicada para o n8n, dê `GRANT EXECUTE` nessas funções (o guard exige `auth.uid()` ou `service_role` para roles não-administrativas — nesse caso prefira a Opção B).

### Opção B — HTTP Request Tool (PostgREST)

`POST https://cltxkixvsfrokxdfpfga.supabase.co/rest/v1/rpc/agente_buscar_conversas`
Headers: `apikey: <service_role>`, `Authorization: Bearer <service_role>`, `Content-Type: application/json`
Body: JSON com os parâmetros (`{"p_busca": "...", "p_limite": 20}`).

**Nunca** usar a chave `anon` (EXECUTE revogado) e **nunca** expor a `service_role` fora do n8n.

### System prompt sugerido para o AI Agent

```
Você é o assistente de relatórios do atendimento WhatsApp da INTT.
Responda em português, com números exatos vindos das ferramentas — nunca invente valores.

Regras:
- Perguntas de métricas/relatórios por período → use as tools de agregados
  (metricas_periodo, serie_diaria, serie_semanal, relatorio_transferencias,
  ranking_representantes, relatorio_internacional).
- Perguntas sobre conversas ou clientes específicos → buscar_conversas; para ver
  o histórico/resumo completo de uma conversa → detalhe_conversa.
- Datas sempre em YYYY-MM-DD. Hoje é {{ $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd') }}.
  Se o usuário não der período, use os últimos 30 dias e diga qual período usou.
- "Transferido/handoff" = conversa encaminhada a um representante.
- Se a busca retornar várias conversas, liste as principais e pergunte qual detalhar.
- Não responda nada fora do tema atendimento/relatórios INTT.
```

## Segurança

- Tools são só de leitura; o dashboard e o agente **nunca escrevem** em `conversations`/`inbound_messages`.
- `agente_buscar_conversas` limita a 50 linhas; `agente_detalhe_conversa` a 100 mensagens.
- Conteúdo de `Resumo`/mensagens é dado de usuário (WhatsApp) — o system prompt deve tratá-lo como dado, não como instrução.
