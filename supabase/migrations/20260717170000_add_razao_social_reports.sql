-- Adiciona razao_social (empresa, só preenchida em clientes B2B) aos relatórios.
-- relatorio_handoffs muda o shape de retorno → drop + recreate (re-grant obrigatório).
-- Aplicada remotamente via MCP (migration `add_razao_social_reports`).

drop function if exists public.relatorio_handoffs(date, date);

create function public.relatorio_handoffs(p_inicio date, p_fim date)
returns table (
  data_handoff timestamptz,
  nome_cliente text,
  telefone_cliente text,
  razao_social text,
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
         nullif(trim(c."Razao_social"), ''),
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

revoke execute on function public.relatorio_handoffs(date, date) from public, anon;
grant execute on function public.relatorio_handoffs(date, date) to authenticated, service_role;

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
           nullif(trim(c."Razao_social"), '') as razao_social,
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
               'razao_social', i.razao_social,
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
