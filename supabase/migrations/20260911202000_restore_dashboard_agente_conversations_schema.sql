-- Undo n8n-shaped columns mistakenly added to the dashboard sidebar table.
-- n8n Postgres Chat Memory must use n8n_chat_histories_ia_relatorios instead.
alter table public.dashboard_agente_conversations
  drop column if exists message,
  drop column if exists session_id,
  drop column if exists id;
