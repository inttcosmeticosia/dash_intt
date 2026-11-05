-- O chat "Agente" do dashboard também passa a considerar transferência = existe handoff_events
-- para o telefone (IA ou atendimento humano), além do legado "Representante preenchido".
-- Mesmas assinaturas; apenas create or replace.

create index if not exists handoff_events_phone_norm_idx
  on public.handoff_events (public.handoff_norm_phone(phone), handoff_at desc);

create or replace function public.analytics_ultimo_handoff(p_phone text)
returns table(destino text, telefone_representante text, motivo text, handoff_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select coalesce(nullif(e.representante, ''),
                  case e.handoff_to when 'atendente_regional' then 'Equipe comercial (Bitrix)'
                                    when 'suporte_humano' then 'Suporte (Bitrix)'
                                    else e.handoff_to end),
         nullif(e.telefone_representante, ''), nullif(e.reason, ''), e.handoff_at
  from public.handoff_events e
  where public.handoff_norm_phone(e.phone) = public.handoff_norm_phone(p_phone)
  order by (nullif(e.representante, '') is null), e.handoff_at desc
  limit 1
$$;
revoke all on function public.analytics_ultimo_handoff(text) from public, anon;
grant execute on function public.analytics_ultimo_handoff(text) to authenticated, service_role;

create or replace function public.agente_buscar_conversas(p_busca text DEFAULT NULL::text, p_inicio date DEFAULT NULL::date, p_fim date DEFAULT NULL::date, p_representante text DEFAULT NULL::text, p_tipo_cliente text DEFAULT NULL::text, p_pais text DEFAULT NULL::text, p_apenas_transferidas boolean DEFAULT false, p_limite integer DEFAULT 20)
 returns table(conv_key text, nome text, telefone text, cidade text, regiao text, tipo_cliente text, pais text, representante text, telefone_representante text, motivo_transferencia text, resumo text, criada_em timestamp with time zone, ultima_mensagem_em timestamp with time zone)
 language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_busca text := nullif(trim(coalesce(p_busca, '')), '');
  v_digitos text := nullif(regexp_replace(coalesce(p_busca, ''), '\D', '', 'g'), '');
begin
  perform public.analytics_check_acesso();

  return query
  with base as (
    select c.*, h.destino as h_destino, h.telefone_representante as h_tel, h.motivo as h_motivo
    from public.conversations c
    left join lateral public.analytics_ultimo_handoff(c.phone) h on true
    where c.phone is not null and length(c.phone) > 5
      and (p_inicio is null
           or (coalesce(c.last_message_at, c.created_at) at time zone 'America/Sao_Paulo')::date >= p_inicio)
      and (p_fim is null
           or (c.created_at at time zone 'America/Sao_Paulo')::date <= p_fim)
  )
  select b.conv_key,
         nullif(b."Nome", ''),
         b.phone,
         nullif(b."Cidade", ''),
         nullif(b."Regiao", ''),
         public.analytics_tipo_cliente_label(b."Tipo_Cliente"),
         public.analytics_pais_telefone(b.phone),
         coalesce(b.h_destino, nullif(b."Representante", '')),
         coalesce(b.h_tel, nullif(b."Telefone Representante", '')),
         coalesce(b.h_motivo, nullif(b.reason, '')),
         replace(nullif(b."Resumo", ''), '\n', E'\n'),
         b.created_at,
         b.last_message_at
  from base b
  where (not p_apenas_transferidas
         or b.h_destino is not null
         or (b."Representante" is not null and b."Representante" <> ''))
    and (p_representante is null
         or upper(public.unaccent(trim(coalesce(b.h_destino, b."Representante", ''))))
            like '%' || upper(public.unaccent(trim(p_representante))) || '%')
    and (p_tipo_cliente is null
         or b."Tipo_Cliente" = p_tipo_cliente
         or upper(public.unaccent(coalesce(public.analytics_tipo_cliente_label(b."Tipo_Cliente"), '')))
            = upper(public.unaccent(trim(p_tipo_cliente))))
    and (p_pais is null
         or upper(public.unaccent(coalesce(public.analytics_pais_telefone(b.phone), '')))
            = upper(public.unaccent(trim(p_pais))))
    and (v_busca is null
         or upper(public.unaccent(coalesce(b."Nome", '') || ' ' || coalesce(b."Cidade", '') || ' '
                  || coalesce(b."Regiao", '') || ' ' || coalesce(b."Resumo", '')))
            like '%' || upper(public.unaccent(v_busca)) || '%'
         or (v_digitos is not null and b.phone like '%' || v_digitos || '%'))
  order by coalesce(b.last_message_at, b.created_at) desc
  limit least(greatest(coalesce(p_limite, 20), 1), 50);
end;
$function$;

create or replace function public.agente_estatisticas_perfil(p_inicio date DEFAULT NULL::date, p_fim date DEFAULT NULL::date)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_result jsonb;
begin
  perform public.analytics_check_acesso();

  with transferidos as (
    select distinct public.handoff_norm_phone(e.phone) as phone_n from public.handoff_events e
  ),
  base as (
    select public.analytics_tipo_cliente_label(c."Tipo_Cliente") as tipo_cliente,
           nullif(trim(c."Regiao"), '') as regiao,
           public.analytics_pais_telefone(c.phone) as pais,
           nullif(trim(c.reason), '') as motivo,
           ((c."Representante" is not null and c."Representante" <> '')
             or exists (select 1 from transferidos t where t.phone_n = public.handoff_norm_phone(c.phone))) as transferida
    from public.conversations c
    where c.phone is not null and length(c.phone) > 5
      and (p_inicio is null or (c.created_at at time zone 'America/Sao_Paulo')::date >= p_inicio)
      and (p_fim is null or (c.created_at at time zone 'America/Sao_Paulo')::date <= p_fim)
  )
  select jsonb_build_object(
    'total_conversas', (select count(*) from base),
    'transferidas', (select count(*) from base where transferida),
    'por_tipo_cliente', (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', t.tipo_cliente, 'total', t.n) order by t.n desc), '[]'::jsonb)
      from (select tipo_cliente, count(*) as n from base where tipo_cliente is not null group by 1) t
    ),
    'por_regiao', (
      select coalesce(jsonb_agg(jsonb_build_object('regiao', t.regiao, 'total', t.n) order by t.n desc), '[]'::jsonb)
      from (select regiao, count(*) as n from base where regiao is not null group by 1 order by count(*) desc limit 15) t
    ),
    'por_pais', (
      select coalesce(jsonb_agg(jsonb_build_object('pais', t.pais, 'total', t.n) order by t.n desc), '[]'::jsonb)
      from (select pais, count(*) as n from base where pais is not null group by 1) t
    ),
    'por_motivo_transferencia', (
      select coalesce(jsonb_agg(jsonb_build_object('motivo', t.motivo, 'total', t.n) order by t.n desc), '[]'::jsonb)
      from (select motivo, count(*) as n from base where motivo is not null group by 1) t
    )
  )
  into v_result;

  return v_result;
end;
$function$;
