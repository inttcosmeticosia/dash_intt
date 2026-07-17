-- Analytics de atendimentos WhatsApp (tabela conversations)
-- Regras:
--   * Conversa válida = phone com mais de 5 caracteres (IDs internos Bitrix são ignorados)
--   * Handoff = coluna "Representante" preenchida; data = coalesce(last_message_at, created_at)
--   * Datas no fuso America/Sao_Paulo

-- ── Helper: país a partir do telefone (DDI) ─────────────────────────────
create or replace function public.analytics_pais_telefone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  p3 text;
  p2 text;
begin
  if p_phone is null or length(p_phone) <= 5 then
    return null;
  end if;
  if p_phone like '55%' and length(p_phone) in (12, 13) then
    return 'Brasil';
  end if;
  -- celular BR sem DDI: DDD + 9 + 8 dígitos
  if length(p_phone) = 11 and substring(p_phone, 3, 1) = '9'
     and substring(p_phone, 1, 2) between '11' and '99' then
    return 'Brasil';
  end if;
  p3 := left(p_phone, 3);
  p2 := left(p_phone, 2);
  return case p3
    when '595' then 'Paraguai'
    when '598' then 'Uruguai'
    when '591' then 'Bolívia'
    when '593' then 'Equador'
    when '597' then 'Suriname'
    when '592' then 'Guiana'
    when '244' then 'Angola'
    when '351' then 'Portugal'
    when '258' then 'Moçambique'
    when '238' then 'Cabo Verde'
    when '245' then 'Guiné-Bissau'
    when '239' then 'São Tomé e Príncipe'
    when '212' then 'Marrocos'
    when '971' then 'Emirados Árabes'
    when '972' then 'Israel'
    else case p2
      when '54' then 'Argentina'
      when '56' then 'Chile'
      when '57' then 'Colômbia'
      when '58' then 'Venezuela'
      when '51' then 'Peru'
      when '52' then 'México'
      when '53' then 'Cuba'
      when '61' then 'Austrália'
      when '64' then 'Nova Zelândia'
      when '44' then 'Reino Unido'
      when '49' then 'Alemanha'
      when '34' then 'Espanha'
      when '33' then 'França'
      when '39' then 'Itália'
      when '81' then 'Japão'
      when '86' then 'China'
      when '91' then 'Índia'
      when '27' then 'África do Sul'
      when '82' then 'Coreia do Sul'
      when '90' then 'Turquia'
      when '31' then 'Holanda'
      when '32' then 'Bélgica'
      when '41' then 'Suíça'
      when '48' then 'Polônia'
      else case left(p_phone, 1)
        when '1' then 'EUA/Canadá'
        when '7' then 'Rússia'
        else 'Outro (+' || p2 || ')'
      end
    end
  end;
end;
$$;

-- ── Helper: label do Tipo_Cliente (enumeration Bitrix) ──────────────────
create or replace function public.analytics_tipo_cliente_label(p_tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when '107' then 'Lojista'
    when '109' then 'E-Commerce'
    when '111' then 'Distribuidor'
    when '113' then 'Consultor'
    when '115' then 'Consumidor Final'
    else nullif(p_tipo, '')
  end;
$$;

-- ── Helper: guarda de acesso (usuário logado ou service_role) ───────────
create or replace function public.analytics_check_acesso()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  -- conexões administrativas diretas (migrations, MCP) passam
  if session_user in ('postgres', 'supabase_admin') then
    return;
  end if;
  if auth.uid() is null and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'acesso negado';
  end if;
end;
$$;

-- ── KPIs do período (com comparação ao período anterior) ────────────────
create or replace function public.metricas_atendimento(p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dias int := (p_fim - p_inicio) + 1;
  v_ant_inicio date := p_inicio - v_dias;
  v_ant_fim date := p_inicio - 1;
  v_novos bigint;
  v_ativas bigint;
  v_transferidos bigint;
  v_internacionais bigint;
  v_ant_novos bigint;
  v_ant_ativas bigint;
  v_ant_transferidos bigint;
begin
  perform public.analytics_check_acesso();

  with base as (
    select (created_at at time zone 'America/Sao_Paulo')::date as dia_criacao,
           case when "Representante" is not null and "Representante" <> ''
                then (coalesce(last_message_at, created_at) at time zone 'America/Sao_Paulo')::date
           end as dia_handoff,
           public.analytics_pais_telefone(phone) as pais
    from public.conversations
    where phone is not null and length(phone) > 5
  )
  select
    count(*) filter (where dia_criacao between p_inicio and p_fim),
    count(*) filter (where dia_handoff between p_inicio and p_fim),
    count(*) filter (where dia_criacao between p_inicio and p_fim and pais <> 'Brasil'),
    count(*) filter (where dia_criacao between v_ant_inicio and v_ant_fim),
    count(*) filter (where dia_handoff between v_ant_inicio and v_ant_fim)
  into v_novos, v_transferidos, v_internacionais, v_ant_novos, v_ant_transferidos
  from base;

  select count(distinct m.conv_key)
  into v_ativas
  from public.inbound_messages m
  join public.conversations c on c.conv_key = m.conv_key
  where c.phone is not null and length(c.phone) > 5
    and (m.received_at at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim;

  select count(distinct m.conv_key)
  into v_ant_ativas
  from public.inbound_messages m
  join public.conversations c on c.conv_key = m.conv_key
  where c.phone is not null and length(c.phone) > 5
    and (m.received_at at time zone 'America/Sao_Paulo')::date between v_ant_inicio and v_ant_fim;

  return jsonb_build_object(
    'novos_atendimentos', v_novos,
    'conversas_ativas', v_ativas,
    'transferidos', v_transferidos,
    'taxa_transferencia', case when v_novos > 0 then round(v_transferidos::numeric / v_novos * 100, 1) else 0 end,
    'internacionais', v_internacionais,
    'periodo_anterior', jsonb_build_object(
      'novos_atendimentos', v_ant_novos,
      'conversas_ativas', v_ant_ativas,
      'transferidos', v_ant_transferidos,
      'crescimento_percentual', case when v_ant_novos > 0
        then round((v_novos - v_ant_novos)::numeric / v_ant_novos * 100, 1) end
    )
  );
end;
$$;

-- ── Série diária: novos, ativos, transferidos ───────────────────────────
create or replace function public.atendimentos_diarios(p_inicio date, p_fim date)
returns table (dia date, novos bigint, ativos bigint, transferidos bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.analytics_check_acesso();

  return query
  with dias as (
    select generate_series(p_inicio, p_fim, interval '1 day')::date as dia
  ),
  base as (
    select conv_key,
           (created_at at time zone 'America/Sao_Paulo')::date as dia_criacao,
           case when "Representante" is not null and "Representante" <> ''
                then (coalesce(last_message_at, created_at) at time zone 'America/Sao_Paulo')::date
           end as dia_handoff
    from public.conversations
    where phone is not null and length(phone) > 5
  ),
  ativos as (
    select (m.received_at at time zone 'America/Sao_Paulo')::date as dia, count(distinct m.conv_key) as n
    from public.inbound_messages m
    join base b on b.conv_key = m.conv_key
    group by 1
  )
  select d.dia,
         (select count(*) from base where base.dia_criacao = d.dia),
         coalesce(a.n, 0),
         (select count(*) from base where base.dia_handoff = d.dia)
  from dias d
  left join ativos a on a.dia = d.dia
  order by d.dia;
end;
$$;

-- ── Série semanal (semana iniciando na segunda) ─────────────────────────
create or replace function public.atendimentos_semanais(p_inicio date, p_fim date)
returns table (semana date, novos bigint, ativos bigint, transferidos bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.analytics_check_acesso();

  return query
  with base as (
    select conv_key,
           (created_at at time zone 'America/Sao_Paulo')::date as dia_criacao,
           case when "Representante" is not null and "Representante" <> ''
                then (coalesce(last_message_at, created_at) at time zone 'America/Sao_Paulo')::date
           end as dia_handoff
    from public.conversations
    where phone is not null and length(phone) > 5
  ),
  semanas as (
    select generate_series(date_trunc('week', p_inicio::timestamp)::date, p_fim, interval '7 days')::date as semana
  ),
  ativos as (
    select date_trunc('week', (m.received_at at time zone 'America/Sao_Paulo'))::date as semana,
           count(distinct m.conv_key) as n
    from public.inbound_messages m
    join base b on b.conv_key = m.conv_key
    where (m.received_at at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
    group by 1
  )
  select s.semana,
         (select count(*) from base where base.dia_criacao between greatest(s.semana, p_inicio) and least(s.semana + 6, p_fim)),
         coalesce(a.n, 0),
         (select count(*) from base where base.dia_handoff between greatest(s.semana, p_inicio) and least(s.semana + 6, p_fim))
  from semanas s
  left join ativos a on a.semana = s.semana
  order by s.semana;
end;
$$;

-- ── Relatório de transferências (linhas, como a planilha Handoff) ───────
create or replace function public.relatorio_handoffs(p_inicio date, p_fim date)
returns table (
  data_handoff timestamptz,
  nome_cliente text,
  telefone_cliente text,
  representante text,
  telefone_representante text,
  regiao text,
  tipo_cliente text,
  motivo text,
  pais text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.analytics_check_acesso();

  return query
  select coalesce(c.last_message_at, c.created_at),
         nullif(c."Nome", ''),
         c.phone,
         c."Representante",
         nullif(c."Telefone Representante", ''),
         nullif(c."Regiao", ''),
         public.analytics_tipo_cliente_label(c."Tipo_Cliente"),
         nullif(c.reason, ''),
         public.analytics_pais_telefone(c.phone)
  from public.conversations c
  where c.phone is not null and length(c.phone) > 5
    and c."Representante" is not null and c."Representante" <> ''
    and (coalesce(c.last_message_at, c.created_at) at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  order by 1 desc;
end;
$$;

-- ── Ranking de representantes por transferências ────────────────────────
create or replace function public.handoffs_por_representante(p_inicio date, p_fim date)
returns table (representante text, telefone_representante text, total bigint, ultima_transferencia timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.analytics_check_acesso();

  return query
  select c."Representante",
         max(nullif(c."Telefone Representante", '')),
         count(*),
         max(coalesce(c.last_message_at, c.created_at))
  from public.conversations c
  where c.phone is not null and length(c.phone) > 5
    and c."Representante" is not null and c."Representante" <> ''
    and (coalesce(c.last_message_at, c.created_at) at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  group by c."Representante"
  order by count(*) desc;
end;
$$;

-- ── Relatório internacional (fora do Brasil, por DDI) ───────────────────
create or replace function public.relatorio_internacional(p_inicio date, p_fim date)
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

  with intl as (
    select c.created_at,
           c.phone,
           nullif(c."Nome", '') as nome,
           public.analytics_pais_telefone(c.phone) as pais,
           nullif(c."Regiao", '') as regiao,
           nullif(c."Representante", '') as representante,
           public.analytics_tipo_cliente_label(c."Tipo_Cliente") as tipo_cliente,
           nullif(c."Resumo", '') as resumo
    from public.conversations c
    where c.phone is not null and length(c.phone) > 5
      and public.analytics_pais_telefone(c.phone) <> 'Brasil'
      and (c.created_at at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  )
  select jsonb_build_object(
    'total', (select count(*) from intl),
    'por_pais', (
      select coalesce(jsonb_agg(jsonb_build_object('pais', t.pais, 'total', t.total) order by t.total desc), '[]'::jsonb)
      from (select pais, count(*) as total from intl group by pais) t
    ),
    'conversas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'data', i.created_at,
               'telefone', i.phone,
               'nome', i.nome,
               'pais', i.pais,
               'regiao', i.regiao,
               'representante', i.representante,
               'tipo_cliente', i.tipo_cliente,
               'resumo', i.resumo
             ) order by i.created_at desc), '[]'::jsonb)
      from intl i
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ── Permissões: nada para anon; só authenticated + service_role ─────────
revoke execute on function public.analytics_pais_telefone(text) from public, anon;
revoke execute on function public.analytics_tipo_cliente_label(text) from public, anon;
revoke execute on function public.analytics_check_acesso() from public, anon;
revoke execute on function public.metricas_atendimento(date, date) from public, anon;
revoke execute on function public.atendimentos_diarios(date, date) from public, anon;
revoke execute on function public.atendimentos_semanais(date, date) from public, anon;
revoke execute on function public.relatorio_handoffs(date, date) from public, anon;
revoke execute on function public.handoffs_por_representante(date, date) from public, anon;
revoke execute on function public.relatorio_internacional(date, date) from public, anon;

grant execute on function public.analytics_pais_telefone(text) to authenticated, service_role;
grant execute on function public.analytics_tipo_cliente_label(text) to authenticated, service_role;
grant execute on function public.analytics_check_acesso() to authenticated, service_role;
grant execute on function public.metricas_atendimento(date, date) to authenticated, service_role;
grant execute on function public.atendimentos_diarios(date, date) to authenticated, service_role;
grant execute on function public.atendimentos_semanais(date, date) to authenticated, service_role;
grant execute on function public.relatorio_handoffs(date, date) to authenticated, service_role;
grant execute on function public.handoffs_por_representante(date, date) to authenticated, service_role;
grant execute on function public.relatorio_internacional(date, date) to authenticated, service_role;
