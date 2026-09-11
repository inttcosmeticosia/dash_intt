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
| `relatorio_transferencias_ramon2` (ou `transferencias_ramon`) | `relatorio_transferencias_ramon(p_inicio, p_fim)` via Edge Function `agente-export` (`tipo: "relatorio_transferencias_ramon"`) | Telefones mencionados nas conversas do Ramon (`chat_histories_Ramon`) + nome/resumo do cliente; resposta `{ dados, planilha.url }` |
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
Nos headers use sempre `={{ $env.SUPABASE_SERVICE_ROLE_KEY }}` (e `Bearer ` + a mesma env) — nunca hardcode JWT no workflow.

### Opção C — Edge Function `agente-export` (Excel + link assinado)

`POST https://cltxkixvsfrokxdfpfga.supabase.co/functions/v1/agente-export`

Body: `{ "tipo": "<rpc>", "p_inicio", "p_fim", "colunas"?: ... }` — ex.: `tipo: "relatorio_transferencias_ramon"`.
Resposta: `{ dados, planilha: { url, nome_arquivo, linhas, expira_em } | null, aviso? }`.
Se o resultado não tiver linhas para exportar, `planilha` vem `null` (não invente botão/Excel).

Resposta: `{ dados, planilha: { url, nome_arquivo, linhas, expira_em } }` (URL assinada ~24h). O agente deve **sempre** enviar `planilha.url` ao usuário.

### System prompt sugerido para o AI Agent

```
Você é o assistente de relatórios do atendimento WhatsApp da INTT.
Responda em português, com números exatos vindos das ferramentas — nunca invente valores.

Regras:
- Perguntas de métricas/relatórios por período → use as tools de agregados
  (metricas_periodo, serie_diaria, serie_semanal, relatorio_transferencias,
  ranking_representantes, relatorio_internacional).
- Telefones que o Ramon mencionou nas conversas → transferencias_ramon /
  relatorio_transferencias_ramon2 (sempre envie planilha.url ao usuário).
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

---

## Integração com o dashboard (`/dashboard/agente`)

O Next.js **não edita** o workflow live no n8n. O dashboard chama o **mesmo webhook** do agente de forma **síncrona** (espera a resposta no mesmo HTTP request, timeout ~120s) via proxy autenticado `POST /api/agente`.

### Env vars do Next (servidor — nunca `NEXT_PUBLIC_`)

```
N8N_AGENTE_WEBHOOK_URL=https://<seu-n8n>/webhook/8aa3ef1c-1ca4-421b-9eb3-6d91fb741ecd
N8N_AGENTE_WEBHOOK_SECRET=   # opcional; se preenchido, o proxy envia header X-Agente-Secret
```

Não colocar `service_role` no Next — só a URL do webhook (+ secret opcional).

### Contrato request (dashboard → webhook n8n)

```json
{ "message": "quantos transferidos nos últimos 7 dias?", "session": "dash:<user_uuid>" }
```

- `message` — texto do usuário logado.
- `session` — sempre `dash:` + `user.id` do Supabase Auth (evita misturar com memória WhatsApp por telefone).

### Contrato response (webhook → dashboard)

Igual ao `OUTPUT_CONTRACT` do AI Agent:

```json
{
  "messages": [
    { "kind": "text", "text": "..." },
    {
      "kind": "document",
      "url": "https://...",
      "title": "...",
      "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "extension": "xlsx"
    }
  ],
  "metadata": {
    "intent": "kpis",
    "periodo": { "inicio": "YYYY-MM-DD", "fim": "YYYY-MM-DD" }
  }
}
```

Se houver `kind:"document"` com `url` (vindo de `planilha.url` no `agente-export`), a UI mostra **Baixar Excel**.

### O que configurar no n8n (você aplica no editor)

1. **Webhook** — Response mode: *When Last Node Finishes* (ou node *Respond to Webhook* no final). Remova/desconecte o callback assíncrono `enviar resposta` nesse caminho.
2. **Code `Definir payload do agente`** logo após o Webhook:

```js
// body esperado: { message: string, session: string }
const body = $input.first().json.body ?? $input.first().json;
return [{
  json: {
    agent_user_text: String(body.message ?? '').trim(),
    agentPayload: { phone: String(body.session ?? 'dash:anon') }, // Memory já lê este campo
  }
}];
```

3. **Postgres Chat Memory** — `sessionKey` = `$json.body.session` (ou o path equivalente do webhook)  
   Tabela: **`n8n_chat_histories_ia_relatorios`** (colunas `id`, `session_id`, `message`).  
   **NÃO** use `dashboard_agente_conversations` — essa tabela é só do dashboard Next.js (lista de chats na UI: `user_id` + `conversations` jsonb) e **não** serve para o node de memória do LangChain.
4. **AI Agent** — prompt de usuário = `$('Definir payload do agente').first().json.agent_user_text`.
5. **Último node** — Code que normaliza a saída do Agent para o JSON `{ messages, metadata }` e devolve isso como corpo da resposta do webhook.

### Memória

| Origem | Chave de sessão |
|---|---|
| WhatsApp / telefone | telefone (sem prefixo) |
| Dashboard | `dash:<supabase_user_uuid>` |

Usuários diferentes no dashboard → memórias separadas. O mesmo usuário em várias abas compartilha a mesma sessão `dash:…`.
