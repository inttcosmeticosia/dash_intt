@AGENTS.md

# INTT Analytics

Dashboard web (Next.js) de relatórios do atendimento WhatsApp da INTT. Lê **direto** as tabelas de produção do agente n8n (`conversations`, `inbound_messages`) no Supabase via RPCs. A integração Mercos foi removida em 2026-07-17 (reformulação); não existe mais modo mock.

## Stack

- **Next.js 16.2.10** (React 19.2.4) — versão com breaking changes; ler `node_modules/next/dist/docs/` antes de codar (ver AGENTS.md). Aviso conhecido no build: convenção `middleware.ts` deprecada em favor de `proxy.ts` (ainda não migrado).
- **Supabase** — auth + Postgres (project ref: `cltxkixvsfrokxdfpfga`); `@supabase/ssr` + `@supabase/supabase-js`
- **Tailwind CSS v4**, **Recharts** (gráficos), **lucide-react**, **date-fns**
- MCP Supabase configurado em `.mcp.json` (`https://mcp.supabase.com/mcp?project_ref=cltxkixvsfrokxdfpfga`)

## Fluxo de dados

```
Agente WhatsApp (n8n) → grava conversations / inbound_messages (Supabase)
→ RPCs de atendimento (SECURITY DEFINER) → dashboard Next.js
```

## Estrutura

### Rotas (`src/app/`)
- `/` — server component; redireciona logado → `/dashboard`, senão → `/login`
- `(auth)/login` — form email/senha (client), usa `signIn` de `services/analytics.ts`
- `(protected)/dashboard/*` — todas client components, período via `useFilters` (default últimos 30 dias):
  - `/dashboard` — Visão Geral: KPIs (novos, ativos, transferidos, taxa, internacionais) + série diária + série semanal (RPCs `metricas_atendimento`, `atendimentos_diarios`, `atendimentos_semanais`)
  - `/dashboard/handoffs` — Transferências (IA + atendimento humano): filtro de origem, KPIs, ranking por destino, região, tipo, tabela + CSV (RPC `relatorio_transferencias`)
  - `/dashboard/atendimento-humano` — "Atendimento Humano": mesma view travada em origem `humano`; a RPC usa `analytics_handoffs_fonte(..., 'humano')` (só eventos humanos, sem dados da IA). `/dashboard/transferencias-ramon` redireciona para cá
  - Ambas renderizam `src/components/TransferenciasView.tsx` (prop `origemFixa`); agregações (ranking/região/tipo) são feitas no client a partir das linhas
  - `/dashboard/internacional` — atendimentos fora do Brasil por país + export CSV (RPC `relatorio_internacional`)
  - `/dashboard/agente` — chat com o [IA plataforma] (n8n) via `/api/agente`; item `kind:"prompt_proposta"` renderiza `components/PromptPropostaCard.tsx` (antes/depois + Publicar/Editar/Descartar)
  - `/dashboard/prompt-cris` — versão no ar do prompt da Cris, regras da equipe, proposta pendente, histórico com Restaurar, prompt completo
  - Sidebar (`DashboardShell`) agrupada: Atendimento / Clientes / Inteligência Artificial
  - Coluna Tipo das transferências: `"Tipo · fonte"` (formulário > atendente > IA) de `analytics_tipo_cliente_resolvido` (migration `20261110100000`); o client agrupa só pelo tipo

### Middleware
- `src/middleware.ts` — matcher `['/dashboard/:path*', '/login']`
- `src/lib/supabase/middleware.ts` — `updateSession()`: refresh de cookie + guard (sem user em `/dashboard` → `/login`; logado em `/login` → `/dashboard`)

### Camadas
- `src/lib/supabase/` — `client.ts` (browser), `server.ts` (server + cookies), `database.types.ts` (tipos manuais, documentação do shape)
- `src/services/analytics.ts` — getters tipados que chamam os RPCs direto (sem mock, sem fallback); também `getProfile`, `signIn`, `signOut`
- `src/contexts/FilterContext.tsx` — período `{inicio, fim}` (default últimos 30 dias)
- `src/components/` — `DashboardShell` (sidebar escura `#1d1d1d` com logo `public/logo-intt.webp` + 3 seções + logout), `PeriodFilter` (presets Hoje/7d/30d/90d + date inputs), `charts/` (LineChartCard, BarChartCard, DataTable com paginação/`actions`, e `SERIES` — paleta categórica validada: novos `#bd3a41`, ativos `#b97a1c`, transferidos `#1f9d8a`; cor segue a entidade em todos os gráficos), `KpiCard`
- `src/lib/utils.ts` — formatadores + `downloadCsv` (export client-side, separador `;`, BOM UTF-8) + `normalizeName` (comparação sem caixa/acento) + `cleanResumo` (remove `\n` literais gravados pelo agente)
- **Identidade visual** (extraída de lojaintt.com.br): tokens Tailwind v4 em `globals.css` — `brand-*` (bordô, primário `#82181c`) e `bronze-*` (`#a7815c`). Logos em `public/`: `logo-intt-letra-amarela.webp` (dourada, usada na sidebar e no login) e `logo-intt.webp` (branca, exige fundo escuro). Login = página escura standalone (glow bordô, card glass), sem título nem instruções de cadastro

## Banco (Supabase — `cltxkixvsfrokxdfpfga`)

**ATENÇÃO: banco compartilhado.** Este projeto Supabase hospeda TAMBÉM sistemas pré-existentes que NÃO fazem parte deste repo — não mexer sem confirmar:
- **RAG:** `rag_documents`, `rag_chunks`, `rag_queries`, `file_logs`, schema `rag`, funções `hybrid_search_chunks_v2_1`, `ingest_and_maybe_claim` etc.; extensões `vector` (pgvector), `pg_trgm`, `unaccent`
- **Agente WhatsApp/n8n (produção, com dados reais):** `conversations` (~1.1k), `inbound_messages` (~13.8k), `n8n_chat_histories` (~5k), `ai_sent_messages`, `agent_blocks`, `debounce_windows` — **este dashboard LÊ `conversations`/`inbound_messages` via RPCs; nunca escrever nelas a partir daqui**
- **Diversos:** `representantes`, `representantePorDD`, `SpCapital`, `id_drive_bitrix`, `supabase_keep_alive`
- **Legado Mercos (órfão, mantido por segurança):** tabelas `dim_*`/`fact_*`/`mercos_*`, MVs `mv_*` e RPCs de vendas (`metricas_vendas_gerais` etc.) das 5 migrations antigas continuam no banco mas nada no repo os usa. Podem ser dropados no futuro após confirmação.

### Shape relevante de `conversations`

`conv_key` (PK), `phone`, `created_at`, `last_message_at`, colunas gravadas pelo agente: `Nome`, `Cidade`, `Regiao`, `Tipo_Cliente` (IDs Bitrix: 107 Lojista, 109 E-Commerce, 111 Distribuidor, 113 Consultor, 115 Consumidor Final), `Resumo`, `Representante`, `"Telefone Representante"`, `handoff_to`, `reason`. `inbound_messages`: `conv_key`, `received_at`, `text`.

**Peculiaridades dos dados (verificado 2026-07-17):**
- ~559 linhas têm `phone` = ID interno do conector Bitrix (2–4 dígitos, ex.: "285") sem metadados → regra global: **conversa válida = `length(phone) > 5`**
- `updated_at` foi tocado em batch (mesmo timestamp em todas as linhas) → inútil como data de handoff; usar `coalesce(last_message_at, created_at)`
- ~~Handoff registrado = `Representante` preenchido~~ — **regra antiga, abandonada em 2026-11-05**: desde 2026-10-30 a IA transfere para o operador Bitrix (USER_ID 25) e não grava mais `Representante`, então os relatórios zeraram. Ver "Transferências (handoff_events)" abaixo
- Planilha externa `Handoff.xlsx`/CSV do usuário é um log manual com o mesmo formato (não importada; banco é a fonte de verdade)

### Transferências (`handoff_events`) — fonte única desde 2026-11-05

Migrations (aplicadas via MCP): `handoff_events_*` (tabelas/funções/backfill), `relatorios_usam_handoff_events`, `agente_usa_handoff_events`.
- `handoff_events` (RLS on, sem policies): `source` `'ia'|'humano'`, `handoff_to`, `reason`, `representante`, `telefone_representante`, `operator_user_id`, `message_id`, `message_text`, `dados` jsonb, `handoff_at`. Unique `(source, message_id, phone)`
- `human_messages`: toda mensagem de operador Bitrix (`fromApi=true`) — log bruto usado para detectar transferência humana
- **Quem grava (n8n):** `[06] Responder usuario` → node "Registrar handoff IA (Supabase)" (após "Formatar Resposta IA4") chama `registrar_handoff_ia` (dedup 10 min). `[03] Pausar a IA` → node "Registrar mensagem humana (Supabase)" chama `registrar_mensagem_humana`, que grava `human_messages` e cria evento `humano` quando: (A) o atendente manda contato/wa.me/menção a representante para o cliente; ou (B) a conversa é com um representante conhecido (ou o texto tem "segue contatos"/"WhatsApp*:") e o atendente repassa o lead — o evento fica no telefone do **cliente** extraído do texto. Representante resolvido por `handoff_lookup_representante` (tabelas `representantes`, `representantePorDD`, `SpCapital` + histórico, match pelos últimos 8 dígitos). Ambos os nodes têm `onError: continueRegularOutput`
- Backfill: IA a partir de `n8n_chat_histories` (`message_id 'n8n-<id>'`), humano a partir de `chat_histories_Ramon` (`'ramon-<id>'`; essa tabela parou de ser alimentada em 2026-11-04)
- `analytics_handoffs(p_inicio, p_fim)` (interna) → 1 linha por cliente/dia, prioriza a linha com representante; `origem` = `ia`/`humano`/`humano+ia`; `destino` = nome do rep ou "Equipe comercial (Bitrix)"/"Suporte (Bitrix)"/"Representante (não identificado)"
- `relatorio_transferencias(p_inicio, p_fim, p_origem default null)` → usado pelo dashboard. `relatorio_handoffs`, `handoffs_por_representante`, `relatorio_transferencias_ramon`, `metricas_atendimento`, `atendimentos_*` mantêm assinatura (e-mail semanal, agente de relatórios e `agente-export` dependem delas) mas agora leem `analytics_handoffs`
- `agente_buscar_conversas`/`agente_estatisticas_perfil`: transferida = existe `handoff_events` p/ o telefone OU `Representante` legado; helper `analytics_ultimo_handoff(phone)` (índice de expressão `handoff_events_phone_norm_idx`)
- "Transferidos" pode passar de "novos" num dia: o atendente repassa lotes de clientes ("Segue contatos de hoje") que podem ter vindo de outros canais
- **`taxa_transferencia`** (migration `taxa_transferencia_sobre_novos`) = `novos_transferidos` ÷ `novos_atendimentos` (dos clientes novos do período, quantos foram transferidos) → sempre 0–100%. `metricas_atendimento` também devolve `transferidos_pela_ia` e `transferidos_pelo_atendimento_humano` (distintos; um cliente pode estar nos dois)
- **Agente WhatsApp revertido em 2026-11-05** (`[5] Agente de IA`, ramo false do `If` → "AI Agent1"): a IA volta a chamar a tool `[Tool] Achar o Representante correto` e manda o cartão de contato do vendedor. **Exceção: cidade de São Paulo (capital)** → sem tool, emite `handoff.to="atendente_regional"` (atendimento interno Bitrix). Demais cidades de SP/DDD 11 usam a tool. Fallback (tool sem representante) segue Thais Plaza. O agente "AI Agent - Atendimento interno Bitrix" ficou desconectado (ver sticky "Como alternar os agentes")
- `[06]` node "Registrar contato representante (Supabase)" (após "RESPONDER EM TEXTO | Bitrix25") chama `registrar_contato_representante_ia` (migration `registrar_contato_representante_ia`): grava/atualiza o evento `ia` com nome+telefone do representante
- **Lacuna conhecida:** eventos `humano` de 2026-11-04 ~12:58 UTC a 2026-11-05 ~20:21 UTC não foram gravados (`chat_histories_Ramon` parou e o node do [03] ainda não existia). Recuperável só pelo histórico de execuções do [03] (~100 execuções/h) — exige API key do n8n
- **Nunca `DROP FUNCTION`** nesses RPCs — o usuário recusou; sempre `create or replace` mantendo assinatura

### RPCs de atendimento (migration `create_atendimentos_rpcs`, 2026-07-17)

Todas `SECURITY DEFINER`, `set search_path = ''`, `EXECUTE` revogado de `public`/`anon`, concedido a `authenticated` + `service_role`, e com guard `analytics_check_acesso()` no corpo (exige `auth.uid()` ou role `service_role`; conexões `postgres`/`supabase_admin` passam). Datas no fuso `America/Sao_Paulo`.

- `metricas_atendimento(p_inicio date, p_fim date)` → jsonb: `novos_atendimentos`, `conversas_ativas` (distinct conv com msg no período), `transferidos`, `transferidos_pela_ia`, `transferidos_pelo_atendimento_humano`, `novos_transferidos`, `taxa_transferencia` (novos transferidos ÷ novos), `internacionais`, `periodo_anterior{...crescimento_percentual}`
- `atendimentos_diarios(p_inicio, p_fim)` → table(dia, novos, ativos, transferidos) — um row por dia via generate_series
- `atendimentos_semanais(p_inicio, p_fim)` → table(semana, ...) — semana ISO (segunda), contagens truncadas ao período
- `relatorio_handoffs(p_inicio, p_fim)` → (compat; `representante` = destino) linhas estilo planilha Handoff (data, cliente, telefone, razao_social, representante, tel. representante, região, tipo_cliente, motivo, país); `razao_social` também nas conversas de `relatorio_internacional` (migration `add_razao_social_reports`). Nas tabelas do dashboard a coluna "Empresa" só renderiza quando alguma linha do período tem razão social (hoje o banco tem 0 preenchidas — agente só coleta de B2B)
- `handoffs_por_representante(p_inicio, p_fim)` → ranking (representante, telefone, total, última); agrupa por `upper(unaccent(trim(nome)))` (dados têm "FRED MARTINS"/"Fred Martins", "Betânia"/"Betania") e exibe a grafia mais frequente (migration `normalize_representante_ranking`)
- `relatorio_internacional(p_inicio, p_fim)` → jsonb `{total, por_pais[], conversas[]}` — não-Brasil pelo DDI
- **RPCs do agente n8n de relatórios** (migrations `create_agente_rpcs` + `create_agente_conteudo_rpcs`, 2026-07-17; mesmo padrão de segurança): `agente_buscar_conversas(p_busca, p_inicio, p_fim, p_representante, p_tipo_cliente, p_pais, p_apenas_transferidas, p_limite)` — busca livre (nome/cidade/região/resumo via unaccent, telefone por dígitos), máx 50 linhas, resumo com `\n` literal convertido; `agente_detalhe_conversa(p_conv_key, p_telefone, p_max_mensagens)` — jsonb `{conversa, mensagens_recebidas[]}`, máx 100 msgs; `agente_resumos_periodo(p_inicio, p_fim, p_limite)` — resumos do período (máx 200) para o LLM agregar interesses/produtos citados; `agente_buscar_mensagens(p_termo, p_inicio, p_fim, p_limite)` — busca termo (unaccent) em `inbound_messages`, máx 100; `agente_estatisticas_perfil(p_inicio, p_fim)` — jsonb com distribuição por tipo/região/país/motivo; `agente_produtos_mencionados(p_inicio, p_fim, p_incluir_categorias, p_limite)` (migration `create_produtos_mencionados`) — ranking de produtos citados: cruza a tabela dicionário `analytics_produtos` (~110 nomes+aliases extraídos do catálogo INTT 2025 do RAG, RLS on sem policies, flag `categoria` p/ termos genéricos) com `inbound_messages.text` + `Resumo` via regex de palavra inteira (`\m...\M` sobre unaccent+upper). Setup do agente em `docs/n8n-agente-relatorios.md`. **Melhorias (migration `improve_produtos_mencionados`, 2026-07-21):** dicionário ganhou termos de categoria observados no onboarding de revenda (`SABORIZADO`, `SACHE`, `EFEITO GELADO`, `EFEITO VIBRACAO`, `COSMETICO`, `MIX INICIAL`) — cobertura 30d subiu de ~10% p/ ~18% das conversas; `analytics_produtos` ganhou colunas `custom`/`criado_por`/`criado_em`; `agente_produtos_resumo(p_inicio, p_fim, p_incluir_categorias)` → jsonb `{conversas_distintas, produtos_citados}` (corrige o KPI "Conversas com Menção", antes soma por produto). **Termos gerenciáveis pelos usuários logados** (página `/dashboard/produtos`): `analytics_produtos_listar()` (só `custom`), `analytics_produtos_adicionar(p_nome, p_aliases text[], p_categoria)` (normaliza upper+trim, dedup de aliases, `custom=true`, bloqueia conflito com nomes do catálogo), `analytics_produtos_remover(p_id)` (só remove `custom`) — mesmo padrão de segurança dos demais RPCs
- Helpers: `analytics_pais_telefone(text)` (país por DDI; trata BR sem DDI len-11 com 9º dígito), `analytics_tipo_cliente_label(text)`, `analytics_check_acesso()`

- **Auth:** criar user no Supabase → trigger `handle_new_user` cria linha em `profiles`; setar `role='admin'` via SQL

### Pendências de segurança (advisors)

- **ERROR — RLS desligado em tabelas públicas (sistemas legados):** `file_logs`, `rag_documents`, `rag_chunks`, `rag_queries`, `supabase_keep_alive`, `n8n_chat_histories`
- **ERROR — view SECURITY DEFINER:** `v_files_with_storage`
- **WARN — RPCs legados Mercos ainda executáveis por `anon`** (os RPCs novos de atendimento NÃO são — anon revogado)
- **WARN — `function_search_path_mutable`** em ~20 funções legadas; extensões no schema `public`

### Prompt da Cris versionado (`ia_prompts`, 2026-11-10)

- Tabela `public.ia_prompts` (RLS on, sem acesso anon/authenticated): `agente` (`cris_whatsapp`), `versao`, `status` (proposta/ativa/arquivada/descartada; 1 ativa por agente), `conteudo`, `base_versao`, `alteracoes` jsonb, `pedido`, `motivo`, `autor`. v0 = original copiado do n8n; v1 = mesmo texto com `{{AGORA}}` e bloco `<regras_ajustaveis>` (prevalece sobre o resto)
- n8n `[5] Agente de IA`: node **Montar prompt** (Code, entre If-false e AI Agent1) lê a versão ativa via PostgREST a cada mensagem, troca `{{AGORA}}` pela hora SP, guarda cópia em staticData (fallback se o Supabase falhar) e o AI Agent1 usa `$('Montar prompt').first().json.system_prompt`
- Funções service_role (usadas pelo n8n [IA plataforma]): `ia_prompt_ler`, `ia_prompt_propor` (itens `{adicionar_regra}` ou `{buscar,substituir}` com trecho único; valida), `ia_prompt_publicar` (exige base_versao = ativa), `ia_prompt_descartar`, `ia_prompt_historico`, `ia_prompt_restaurar`; `ia_prompt_validar` protege `output_contract`, `json_formatting_rules`, `handoff_payload`, `tools`, `{{AGORA}}` e tamanho ≥70%
- `ia_conversa_historico(p_telefone, p_limite)` — conversa legível de `n8n_chat_histories` (cliente × Cris com intent/notas/handoff) para "por que a Cris respondeu assim"
- Wrappers do painel (authenticated + `analytics_check_acesso`, autor = e-mail do JWT): `dash_ia_prompt_atual/proposta/propor/publicar/descartar/historico/restaurar` (migration `20261110130000`); client em `src/services/iaPrompt.ts`

## Env vars (`.env.example`)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — só isso; não há mais vars Mercos/mock

## Integração n8n / WhatsApp

- O agente de atendimento (workflow n8n "AI Agent" com tools RAG/Bitrix/representantes) é quem alimenta `conversations`; o dashboard é só leitura
- `docs/n8n-analytics-tools.md` e `docs/n8n-intt-analytics-whatsapp.json` referem-se à fase Mercos (desatualizados)
- `docs/n8n-agente-relatorios.md` — agente de IA (n8n) que responde perguntas sobre relatórios/conversas via os RPCs (atual); workflow importável em `docs/n8n-agente-relatorios.json` (Chat Trigger público → agent gpt-5.1 → 12 HTTP Request Tools via PostgREST). Headers usam `$env.SUPABASE_SERVICE_ROLE_KEY` (repo tem remote público na org — nunca commitar a key; a versão preenchida que roda no n8n vive fora do repo)
- `docs/n8n-relatorio-semanal-email.json` — workflow importável: toda segunda 08:00 (SP) monta e envia por e-mail o relatório da semana anterior (seg–dom) via 5 RPCs, sem LLM (HTML determinístico no Code node; SMTP + vars `REPORT_EMAIL_TO`/`FROM`)
