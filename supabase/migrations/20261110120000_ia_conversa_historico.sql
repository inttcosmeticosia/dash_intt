-- Histórico legível de uma conversa da Cris (memória do agente em n8n_chat_histories),
-- usado pela IA do painel para responder "por que a IA respondeu assim ao cliente X?"
-- e propor ajustes no prompt. Somente leitura.
--
-- session_id = telefone (com ou sem 55). Mensagem human = "INBOUND WINDOW" (texto bruto
-- do cliente após "# MESSAGES"); mensagem ai = JSON da Cris {messages, handoff, metadata}.

create or replace function public.ia_conversa_historico(p_telefone text, p_limite int default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  d text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  r record;
  j jsonb;
  itens jsonb := '[]'::jsonb;
  txt text;
  quando text;
  sessao text;
begin
  if length(d) < 8 then
    return jsonb_build_object('ok', false, 'erro', 'Telefone inválido');
  end if;

  select h.session_id into sessao
  from public.n8n_chat_histories h
  where h.session_id in (d, '55' || d, substr(d, 3))
  order by h.id desc limit 1;

  if sessao is null then
    return jsonb_build_object('ok', false, 'erro', 'Nenhuma conversa da IA encontrada para ' || d);
  end if;

  for r in
    select * from (
      select h.id, h.message from public.n8n_chat_histories h
      where h.session_id = sessao
      order by h.id desc
      limit least(greatest(coalesce(p_limite, 40), 1), 120)
    ) x order by x.id
  loop
    if r.message->>'type' = 'human' then
      txt := r.message->>'content';
      quando := (regexp_match(txt, 'window\.first=(\S+)'))[1];
      if position('# MESSAGES' in txt) > 0 then
        txt := substr(txt, position('# MESSAGES' in txt) + 11);
      end if;
      -- "[#0 @ 2026-... id=XYZ] TEXT: oi" -> "TEXT: oi"
      txt := regexp_replace(txt, '\[#\d+ @ \S+ id=\S+\]\s*', '', 'g');
      itens := itens || jsonb_build_object('id', r.id, 'de', 'cliente', 'quando', quando,
                                           'texto', left(trim(txt), 2000));
    else
      begin
        j := (r.message->>'content')::jsonb;
      exception when others then
        j := null;
      end;
      if j is not null and jsonb_typeof(j->'messages') = 'array' then
        select string_agg(coalesce(m->>'text', '[' || coalesce(m->>'kind', '?') || ']'), E'\n')
          into txt from jsonb_array_elements(j->'messages') m;
        itens := itens || jsonb_strip_nulls(jsonb_build_object(
          'id', r.id, 'de', 'cris',
          'texto', left(coalesce(txt, ''), 2000),
          'intent', j#>>'{metadata,intent}',
          'notas', j#>>'{metadata,notes}',
          'handoff', case when jsonb_typeof(j->'handoff') = 'object' then j->'handoff' end));
      else
        itens := itens || jsonb_build_object('id', r.id, 'de', 'cris',
                                             'texto', left(coalesce(r.message->>'content', ''), 2000));
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'telefone', sessao,
    'nome', (select nullif(trim(c."Nome"), '') from public.conversations c
             where c.phone in (sessao, substr(sessao, 3)) order by c.last_message_at desc nulls last limit 1),
    'prompt_versao_ativa', (select p.versao from public.ia_prompts p
                            where p.agente = 'cris_whatsapp' and p.status = 'ativa'),
    'mensagens', itens);
end;
$$;

revoke all on function public.ia_conversa_historico(text, int) from public, anon, authenticated;
grant execute on function public.ia_conversa_historico(text, int) to service_role;
