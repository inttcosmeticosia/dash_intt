-- Applied via MCP user-intt (remote). This file documents the schema for version control.
-- Migrations applied:
--   1. create_analytics_schema
--   2. create_analytics_views
--   3. create_analytics_rpcs
--   4. seed_mock_mercos_data
--   5. grant_mv_access

-- See Supabase project: cltxkixvsfrokxdfpfga
-- Tables: profiles, dim_*, fact_*, mercos_sync_*
-- Views: mv_vendas_diarias, mv_vendas_vendedor, mv_vendas_cliente, mv_produtos_vendas, mv_cliente_recorrencia, mv_produtos_cesta
-- RPCs: metricas_vendas_gerais, ranking_vendedores, analise_revendedor, analise_produtos, produtos_cesta, analise_recorrencia, analise_conversao, tempo_resposta_vendedor, refresh_analytics_views

-- [2026-07-17] LEGADO: os objetos Mercos acima ficaram órfãos após a reformulação
-- para relatórios de atendimento WhatsApp. Ver 20260717150000_create_atendimentos_rpcs.sql
-- (migration `create_atendimentos_rpcs`, aplicada remotamente via MCP).
