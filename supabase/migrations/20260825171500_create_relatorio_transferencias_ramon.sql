-- RPC: telefones mencionados em chat_histories_Ramon + dados do cliente em conversations

create or replace function public.relatorio_transferencias_ramon(p_inicio date, p_fim date)
returns table (
  data timestamptz,
  nome_cliente text,
  telefone_cliente text,
  telefone_mencionado text,
  resumo text,
  mensagem text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.analytics_check_acesso();

  return query
  with matches as (
    select
      h.created_at,
      h.session_id::text as session_id,
      h.message,
      regexp_replace(m[1], '\D', '', 'g') as digits
    from public."chat_histories_Ramon" h
    cross join lateral regexp_matches(
      coalesce(h.message, ''),
      -- BR: opcional wa.me/ + DDI 55 + DDD + 8/9 dígitos (com/sem separadores).
      -- Bordas não-dígito evitam falso positivo em CNPJ (14 dígitos seguidos).
      '(?:^|[^0-9])((?:(?:https?://)?wa\.me/)?(?:\+?55[\s./-]*)?\(?[1-9][0-9]\)?[\s./-]*[0-9](?:[\s./-]*[0-9]){7,8})(?:$|[^0-9])',
      'gi'
    ) as m
    where h.message is not null
      and h.session_id is not null
      and (h.created_at at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  ),
  normalized as (
    select
      created_at,
      session_id,
      message,
      case
        when length(digits) in (12, 13) and left(digits, 2) = '55'
          then substr(digits, 3)
        else digits
      end as telefone_mencionado,
      case
        when length(regexp_replace(session_id, '\D', '', 'g')) >= 12
             and left(regexp_replace(session_id, '\D', '', 'g'), 2) = '55'
          then substr(regexp_replace(session_id, '\D', '', 'g'), 3)
        else regexp_replace(session_id, '\D', '', 'g')
      end as session_digits
    from matches
    where length(digits) between 10 and 13
  )
  select
    n.created_at,
    nullif(c."Nome", ''),
    n.session_id,
    n.telefone_mencionado,
    nullif(c."Resumo", ''),
    n.message
  from normalized n
  left join public.conversations c on c.phone = n.session_id
  where n.telefone_mencionado <> n.session_digits
    and n.telefone_mencionado <> n.session_id
  order by n.created_at desc;
end;
$$;

revoke execute on function public.relatorio_transferencias_ramon(date, date) from public, anon;
grant execute on function public.relatorio_transferencias_ramon(date, date) to authenticated, service_role;
