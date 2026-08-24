-- RPC relatorio_site (conversas que passaram pelo site) + resumo em relatorio_handoffs

-- ── Relatório Site: conversas com Passouosite = true ────────────────────
create or replace function public.relatorio_site(p_inicio date, p_fim date)
returns table (
  data timestamptz,
  nome_cliente text,
  telefone text,
  regiao text,
  cidade text,
  tipo_cliente text,
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
  select coalesce(c.last_message_at, c.created_at),
         nullif(c."Nome", ''),
         c.phone,
         nullif(c."Regiao", ''),
         nullif(c."Cidade", ''),
         public.analytics_tipo_cliente_label(c."Tipo_Cliente"),
         nullif(c."Resumo", '')
  from public.conversations c
  where c.phone is not null and length(c.phone) > 5
    and c."Passouosite" is true
    and (coalesce(c.last_message_at, c.created_at) at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  order by 1 desc;
end;
$$;

revoke execute on function public.relatorio_site(date, date) from public, anon;
grant execute on function public.relatorio_site(date, date) to authenticated, service_role;

-- ── relatorio_handoffs: adiciona coluna resumo ──────────────────────────
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
  pais text,
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
  select coalesce(c.last_message_at, c.created_at),
         nullif(c."Nome", ''),
         c.phone,
         nullif(trim(c."Razao_social"), ''),
         c."Representante",
         nullif(c."Telefone Representante", ''),
         nullif(c."Regiao", ''),
         public.analytics_tipo_cliente_label(c."Tipo_Cliente"),
         nullif(c.reason, ''),
         public.analytics_pais_telefone(c.phone),
         nullif(c."Resumo", '')
  from public.conversations c
  where c.phone is not null and length(c.phone) > 5
    and c."Representante" is not null and c."Representante" <> ''
    and (coalesce(c.last_message_at, c.created_at) at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  order by 1 desc;
end;
$$;

revoke execute on function public.relatorio_handoffs(date, date) from public, anon;
grant execute on function public.relatorio_handoffs(date, date) to authenticated, service_role;
