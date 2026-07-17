-- Agrupa representantes ignorando caixa/acentos (ex.: "FRED MARTINS" = "Fred Martins",
-- "Betânia" = "Betania"); exibe a grafia mais frequente.
-- Aplicada remotamente via MCP (migration `normalize_representante_ranking`).
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
  select mode() within group (order by trim(c."Representante")),
         max(nullif(c."Telefone Representante", '')),
         count(*),
         max(coalesce(c.last_message_at, c.created_at))
  from public.conversations c
  where c.phone is not null and length(c.phone) > 5
    and c."Representante" is not null and c."Representante" <> ''
    and (coalesce(c.last_message_at, c.created_at) at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  group by upper(public.unaccent(trim(c."Representante")))
  order by count(*) desc;
end;
$$;
