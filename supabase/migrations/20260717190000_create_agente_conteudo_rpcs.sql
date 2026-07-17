-- RPCs de CONTEÚDO das conversas para o agente n8n (o que os clientes falam:
-- produtos citados, interesses, assuntos). Mesmo padrão de segurança dos demais.

-- ── Resumos do período (matéria-prima para o LLM agregar interesses) ────
create or replace function public.agente_resumos_periodo(
  p_inicio date default null,
  p_fim date default null,
  p_limite int default 100
)
returns table (
  data timestamptz,
  nome text,
  telefone text,
  cidade text,
  regiao text,
  tipo_cliente text,
  representante text,
  motivo_transferencia text,
  resumo text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.analytics_check_acesso();

  return query
  select c.created_at,
         nullif(c."Nome", ''),
         c.phone,
         nullif(c."Cidade", ''),
         nullif(c."Regiao", ''),
         public.analytics_tipo_cliente_label(c."Tipo_Cliente"),
         nullif(c."Representante", ''),
         nullif(c.reason, ''),
         replace(nullif(c."Resumo", ''), '\n', E'\n')
  from public.conversations c
  where c.phone is not null and length(c.phone) > 5
    and c."Resumo" is not null and c."Resumo" <> ''
    and (p_inicio is null or (c.created_at at time zone 'America/Sao_Paulo')::date >= p_inicio)
    and (p_fim is null or (c.created_at at time zone 'America/Sao_Paulo')::date <= p_fim)
  order by c.created_at desc
  limit least(greatest(coalesce(p_limite, 100), 1), 200);
end;
$$;

-- ── Busca de termo nas mensagens recebidas dos clientes ─────────────────
create or replace function public.agente_buscar_mensagens(
  p_termo text,
  p_inicio date default null,
  p_fim date default null,
  p_limite int default 30
)
returns table (
  recebida_em timestamptz,
  telefone text,
  nome text,
  regiao text,
  tipo_cliente text,
  representante text,
  mensagem text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_termo text := nullif(trim(coalesce(p_termo, '')), '');
begin
  perform public.analytics_check_acesso();

  if v_termo is null then
    return;
  end if;

  return query
  select m.received_at,
         c.phone,
         nullif(c."Nome", ''),
         nullif(c."Regiao", ''),
         public.analytics_tipo_cliente_label(c."Tipo_Cliente"),
         nullif(c."Representante", ''),
         left(m.text, 300)
  from public.inbound_messages m
  join public.conversations c on c.conv_key = m.conv_key
  where c.phone is not null and length(c.phone) > 5
    and m.text is not null
    and upper(public.unaccent(m.text)) like '%' || upper(public.unaccent(v_termo)) || '%'
    and (p_inicio is null or (m.received_at at time zone 'America/Sao_Paulo')::date >= p_inicio)
    and (p_fim is null or (m.received_at at time zone 'America/Sao_Paulo')::date <= p_fim)
  order by m.received_at desc
  limit least(greatest(coalesce(p_limite, 30), 1), 100);
end;
$$;

-- ── Perfil agregado das conversas do período ────────────────────────────
create or replace function public.agente_estatisticas_perfil(
  p_inicio date default null,
  p_fim date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.analytics_check_acesso();

  with base as (
    select public.analytics_tipo_cliente_label(c."Tipo_Cliente") as tipo_cliente,
           nullif(trim(c."Regiao"), '') as regiao,
           public.analytics_pais_telefone(c.phone) as pais,
           nullif(trim(c.reason), '') as motivo,
           (c."Representante" is not null and c."Representante" <> '') as transferida
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
$$;

-- ── Permissões: nada para anon; só authenticated + service_role ─────────
revoke execute on function public.agente_resumos_periodo(date, date, int) from public, anon;
revoke execute on function public.agente_buscar_mensagens(text, date, date, int) from public, anon;
revoke execute on function public.agente_estatisticas_perfil(date, date) from public, anon;

grant execute on function public.agente_resumos_periodo(date, date, int) to authenticated, service_role;
grant execute on function public.agente_buscar_mensagens(text, date, date, int) to authenticated, service_role;
grant execute on function public.agente_estatisticas_perfil(date, date) to authenticated, service_role;
