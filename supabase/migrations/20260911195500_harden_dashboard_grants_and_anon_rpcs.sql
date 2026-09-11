-- Defense in depth for the analytics dashboard:
-- 1) Table access only via SECURITY DEFINER RPCs / service_role (n8n).
-- 2) Revoke anonymous EXECUTE on orphaned Mercos SECURITY DEFINER RPCs.

revoke all on table public.conversations from anon, authenticated;
revoke all on table public.inbound_messages from anon, authenticated;
revoke all on table public."chat_histories_Ramon" from anon, authenticated;

grant all on table public.conversations to service_role;
grant all on table public.inbound_messages to service_role;
grant all on table public."chat_histories_Ramon" to service_role;

-- Legacy Mercos / maintenance RPCs must not be callable without a session
revoke execute on function public.analise_conversao(date, date) from public, anon;
revoke execute on function public.analise_produtos(date, date, text) from public, anon;
revoke execute on function public.analise_recorrencia(date, date) from public, anon;
revoke execute on function public.analise_revendedor(date, date, uuid, text) from public, anon;
revoke execute on function public.metricas_vendas_gerais(date, date, boolean) from public, anon;
revoke execute on function public.produtos_cesta(uuid) from public, anon;
revoke execute on function public.ranking_vendedores(date, date, integer) from public, anon;
revoke execute on function public.tempo_resposta_vendedor(uuid) from public, anon;
revoke execute on function public.refresh_analytics_views() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_storage_to_file_logs() from public, anon, authenticated;
revoke execute on function public.inherit_chunk_metadata_from_document() from public, anon, authenticated;
revoke execute on function public.propagate_document_metadata_to_chunks() from public, anon, authenticated;
revoke execute on function public.propagate_file_metadata() from public, anon, authenticated;

-- Reports-agent chat history: enable RLS (service_role bypasses; anon blocked)
alter table public.n8n_chat_histories_ia_relatorios enable row level security;
