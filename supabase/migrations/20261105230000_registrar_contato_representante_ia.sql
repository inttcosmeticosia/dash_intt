-- Volta do agente antigo (envia contact card do representante): o [06] passa a registrar
-- também o contato enviado, para a transferência da IA sair com o nome do representante.
-- Ordem no [06]: item "contact" chega antes do item "handoff" (mesma resposta do agente).

create or replace function public.registrar_contato_representante_ia(
  p_conv_key text, p_phone text, p_rep_nome text, p_rep_telefone text, p_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_rep_tel text := nullif(regexp_replace(coalesce(p_rep_telefone, ''), '\D', '', 'g'), '');
  v_rep text := nullif(trim(coalesce(p_rep_nome, '')), '');
  v_id bigint;
begin
  if v_phone = '' or v_rep is null then
    return jsonb_build_object('ok', false, 'erro', 'telefone ou representante vazio');
  end if;

  select id into v_id from public.handoff_events
  where source = 'ia' and phone = v_phone
    and handoff_at > coalesce(p_at, now()) - interval '10 minutes'
  order by handoff_at desc limit 1;

  if v_id is null then
    insert into public.handoff_events (conv_key, phone, source, handoff_to, reason, representante, telefone_representante, handoff_at)
    values (p_conv_key, v_phone, 'ia', 'atendente_regional', 'revenda_volume', v_rep, v_rep_tel, coalesce(p_at, now()))
    returning id into v_id;
  else
    update public.handoff_events set representante = v_rep, telefone_representante = v_rep_tel where id = v_id;
  end if;

  perform public.handoff_aplicar_na_conversa(v_phone, 'ia', 'atendente_regional', 'revenda_volume', v_rep, v_rep_tel, coalesce(p_at, now()));
  return jsonb_build_object('ok', true, 'handoff_id', v_id);
end;
$$;
revoke all on function public.registrar_contato_representante_ia(text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.registrar_contato_representante_ia(text, text, text, text, timestamptz) to service_role;

-- Mesmo handoff já registrado pelo contato → completa motivo/dados em vez de ignorar
create or replace function public.registrar_handoff_ia(p_conv_key text, p_phone text, p_to text, p_reason text, p_dados jsonb default null, p_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_id bigint;
  v_rep text; v_rep_tel text;
begin
  if v_phone = '' then
    return jsonb_build_object('ok', false, 'erro', 'telefone vazio');
  end if;

  select id, representante, telefone_representante into v_id, v_rep, v_rep_tel from public.handoff_events
  where source = 'ia' and phone = v_phone and coalesce(handoff_to, '') = coalesce(p_to, '')
    and handoff_at > coalesce(p_at, now()) - interval '10 minutes'
  order by handoff_at desc limit 1;

  if v_id is null then
    insert into public.handoff_events (conv_key, phone, source, handoff_to, reason, dados, handoff_at)
    values (p_conv_key, v_phone, 'ia', nullif(p_to, ''), nullif(p_reason, ''), p_dados, coalesce(p_at, now()))
    returning id into v_id;
  else
    update public.handoff_events
       set reason = coalesce(nullif(p_reason, ''), reason), dados = coalesce(p_dados, dados)
     where id = v_id;
  end if;

  perform public.handoff_aplicar_na_conversa(v_phone, 'ia', p_to, p_reason, v_rep, v_rep_tel, coalesce(p_at, now()));
  return jsonb_build_object('ok', true, 'handoff_id', v_id);
end;
$$;
