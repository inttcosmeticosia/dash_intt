-- Proposta com o prompt INTEIRO editado à mão no painel (página Prompt da Cris).
-- Mesma validação das outras propostas; p_alteracoes guarda só os trechos alterados
-- (para o antes/depois), marcados com edicao_completa=true.
create or replace function public.ia_prompt_propor_conteudo(
  p_conteudo text,
  p_alteracoes jsonb default '[]'::jsonb,
  p_pedido text default null,
  p_motivo text default null,
  p_autor text default null,
  p_agente text default 'cris_whatsapp')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  a public.ia_prompts;
  novo text := replace(coalesce(p_conteudo, ''), E'\r\n', E'\n');
  erro text;
  pid bigint;
begin
  select * into a from public.ia_prompts where agente = p_agente and status = 'ativa';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Nenhuma versão ativa do prompt.');
  end if;
  if novo = a.conteudo then
    return jsonb_build_object('ok', false, 'erro', 'Nada mudou no prompt.');
  end if;
  erro := public.ia_prompt_validar(a.conteudo, novo);
  if erro is not null then
    return jsonb_build_object('ok', false, 'erro', erro);
  end if;

  update public.ia_prompts set status = 'descartada' where agente = p_agente and status = 'proposta';

  insert into public.ia_prompts (agente, status, conteudo, base_versao, alteracoes, pedido, motivo, autor)
  values (p_agente, 'proposta', novo, a.versao,
          case when jsonb_typeof(p_alteracoes) = 'array' then p_alteracoes else '[]'::jsonb end,
          p_pedido, p_motivo, p_autor)
  returning id into pid;

  return jsonb_build_object('ok', true, 'proposta_id', pid, 'versao_atual', a.versao,
                            'tamanho_antes', length(a.conteudo), 'tamanho_depois', length(novo));
end;
$$;

create or replace function public.dash_ia_prompt_propor_conteudo(p_conteudo text, p_alteracoes jsonb default '[]'::jsonb, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  perform public.analytics_check_acesso();
  return public.ia_prompt_propor_conteudo(p_conteudo, p_alteracoes, 'Edição direta no painel', p_motivo, public.dash_ia_autor(), 'cris_whatsapp');
end;
$$;

revoke all on function public.ia_prompt_propor_conteudo(text, jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ia_prompt_propor_conteudo(text, jsonb, text, text, text, text) to service_role;
revoke all on function public.dash_ia_prompt_propor_conteudo(text, jsonb, text) from public, anon;
grant execute on function public.dash_ia_prompt_propor_conteudo(text, jsonb, text) to authenticated, service_role;
