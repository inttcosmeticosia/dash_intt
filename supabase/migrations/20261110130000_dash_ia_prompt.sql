-- Wrappers do painel (usuário logado) para o prompt da Cris em public.ia_prompts.
-- A lógica/validação fica nas funções ia_prompt_* (service_role); aqui só checamos
-- acesso e registramos o autor (e-mail do usuário logado).

create or replace function public.dash_ia_autor()
returns text
language sql
stable
set search_path to ''
as $$
  select coalesce(nullif(auth.jwt() ->> 'email', ''), auth.uid()::text, 'dashboard');
$$;

-- Versão ativa + regras ajustáveis + proposta pendente (se houver).
create or replace function public.dash_ia_prompt_atual(p_versao int default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  a public.ia_prompts;
  pend bigint;
begin
  perform public.analytics_check_acesso();
  if p_versao is null then
    select * into a from public.ia_prompts where agente = 'cris_whatsapp' and status = 'ativa';
  else
    select * into a from public.ia_prompts where agente = 'cris_whatsapp' and versao = p_versao;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Versão não encontrada.');
  end if;
  select id into pend from public.ia_prompts
  where agente = 'cris_whatsapp' and status = 'proposta' order by id desc limit 1;
  return jsonb_build_object(
    'ok', true,
    'id', a.id, 'versao', a.versao, 'status', a.status, 'autor', a.autor,
    'publicado_em', a.publicado_em, 'criado_em', a.criado_em, 'pedido', a.pedido,
    'tamanho', length(a.conteudo),
    'regras', public.ia_prompt_bloco(a.conteudo, 'regras_ajustaveis'),
    'conteudo', a.conteudo,
    'proposta_pendente', pend);
end;
$$;

-- Detalhe de uma proposta, com antes/depois de cada alteração.
create or replace function public.dash_ia_prompt_proposta(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  p public.ia_prompts;
  ativa int;
begin
  perform public.analytics_check_acesso();
  select * into p from public.ia_prompts where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Proposta não encontrada.');
  end if;
  select versao into ativa from public.ia_prompts where agente = p.agente and status = 'ativa';
  return jsonb_build_object(
    'ok', true,
    'id', p.id, 'status', p.status, 'versao', p.versao, 'base_versao', p.base_versao,
    'versao_ativa', ativa, 'pedido', p.pedido, 'motivo', p.motivo, 'autor', p.autor,
    'criado_em', p.criado_em, 'publicado_em', p.publicado_em,
    'alteracoes', coalesce(p.alteracoes, '[]'::jsonb),
    'itens', coalesce((
      select jsonb_agg(
        case when e ? 'adicionar_regra'
          then jsonb_build_object('tipo', 'nova_regra', 'antes', null, 'depois', e ->> 'adicionar_regra')
          else jsonb_build_object(
            'tipo', case when coalesce(e ->> 'substituir', '') = '' then 'remocao' else 'troca' end,
            'antes', e ->> 'buscar', 'depois', coalesce(e ->> 'substituir', ''))
        end order by ord)
      from jsonb_array_elements(coalesce(p.alteracoes, '[]'::jsonb)) with ordinality as t(e, ord)
    ), '[]'::jsonb));
end;
$$;

create or replace function public.dash_ia_prompt_propor(p_alteracoes jsonb, p_pedido text default null, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.analytics_check_acesso();
  return public.ia_prompt_propor(p_alteracoes, p_pedido, p_motivo, public.dash_ia_autor(), 'cris_whatsapp');
end;
$$;

create or replace function public.dash_ia_prompt_publicar(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.analytics_check_acesso();
  return public.ia_prompt_publicar(p_id, public.dash_ia_autor());
end;
$$;

create or replace function public.dash_ia_prompt_descartar(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.analytics_check_acesso();
  return public.ia_prompt_descartar(p_id);
end;
$$;

create or replace function public.dash_ia_prompt_historico(p_limite int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  perform public.analytics_check_acesso();
  return public.ia_prompt_historico(p_limite, 'cris_whatsapp');
end;
$$;

create or replace function public.dash_ia_prompt_restaurar(p_versao int, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.analytics_check_acesso();
  return public.ia_prompt_restaurar(p_versao, public.dash_ia_autor(), p_motivo, 'cris_whatsapp');
end;
$$;

revoke all on function public.dash_ia_autor() from public, anon;
revoke all on function public.dash_ia_prompt_atual(int) from public, anon;
revoke all on function public.dash_ia_prompt_proposta(bigint) from public, anon;
revoke all on function public.dash_ia_prompt_propor(jsonb, text, text) from public, anon;
revoke all on function public.dash_ia_prompt_publicar(bigint) from public, anon;
revoke all on function public.dash_ia_prompt_descartar(bigint) from public, anon;
revoke all on function public.dash_ia_prompt_historico(int) from public, anon;
revoke all on function public.dash_ia_prompt_restaurar(int, text) from public, anon;
grant execute on function public.dash_ia_autor() to authenticated, service_role;
grant execute on function public.dash_ia_prompt_atual(int) to authenticated, service_role;
grant execute on function public.dash_ia_prompt_proposta(bigint) to authenticated, service_role;
grant execute on function public.dash_ia_prompt_propor(jsonb, text, text) to authenticated, service_role;
grant execute on function public.dash_ia_prompt_publicar(bigint) to authenticated, service_role;
grant execute on function public.dash_ia_prompt_descartar(bigint) to authenticated, service_role;
grant execute on function public.dash_ia_prompt_historico(int) to authenticated, service_role;
grant execute on function public.dash_ia_prompt_restaurar(int, text) to authenticated, service_role;
