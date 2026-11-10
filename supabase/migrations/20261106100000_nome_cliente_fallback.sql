-- Nome do cliente quando conversations."Nome" está vazio.
-- Não escreve em conversations (tabela compartilhada com a IA): o nome é resolvido
-- na leitura, a partir de fontes já gravadas, em ordem de confiança:
--   1) handoff da IA (handoff_events.dados->>'Nome')
--   2) formulário do site repassado pelo atendente ("Nome Completo *: ..."),
--      só quando o WhatsApp do formulário bate com o telefone do cliente
--   3) o próprio cliente se apresentando ("meu nome é X" / "me chamo X"), só o 1º nome
-- Nomes todo em maiúsculas/minúsculas viram "Nome Próprio"; números no começo são removidos.

create or replace function public.analytics_nome_cliente(p_phone text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  with p as (
    select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d
  ),
  tels as (
    select distinct t from p, unnest(array[p.d, '55' || p.d, substr(p.d, 3)]) as t
    where length(p.d) >= 8
  ),
  cand as (
    select 1 as prio, e.handoff_at as quando, nullif(trim(e.dados->>'Nome'), '') as nome
    from public.handoff_events e
    where e.phone in (select t from tels) and e.dados ? 'Nome'

    union all

    select 2, e.handoff_at,
           nullif(trim((regexp_match(e.message_text, 'Nome Completo\s*\*?\s*:\s*\n?\s*([^\n]+)'))[1]), '')
    from public.handoff_events e, p
    where e.phone in (select t from tels)
      and e.message_text ~* 'Nome Completo'
      and right(regexp_replace(coalesce((regexp_match(e.message_text, 'WhatsApp\s*\*?\s*:\s*\n?\s*([^\n]+)'))[1], ''), '\D', '', 'g'), 8)
          = right(p.d, 8)

    union all

    select 3, i.received_at,
           (regexp_match(i.text, '(?:meu nome [ée]|me chamo)\s+([A-Za-zÀ-ÿ]{2,})', 'i'))[1]
    from public.inbound_messages i
    where i.conv_key in (select 'wa:Pachequinho:' || t from tels)
      and i.text ~* '(meu nome [ée]|me chamo)\s+[A-Za-zÀ-ÿ]{2,}'
  )
  , limpo as (
    -- tira números/pontuação do começo (ex.: CPF colado antes do nome)
    select prio, quando, trim(regexp_replace(nome, '^[^A-Za-zÀ-ÿ]+', '')) as nome from cand
  )
  select case when nome = upper(nome) or nome = lower(nome) then initcap(lower(nome)) else nome end
  from limpo
  where nome ~ '^[A-Za-zÀ-ÿ]' and length(nome) between 2 and 80
    and nome !~ '\d{3,}' and nome !~ '@'
    and lower(nome) not in ('eu', 'aqui', 'a', 'o')
  order by prio, quando desc nulls last
  limit 1;
$$;

-- Contém dado pessoal: só as RPCs do dashboard (SECURITY DEFINER) chamam.
revoke all on function public.analytics_nome_cliente(text) from public, anon, authenticated;

create or replace function public.relatorio_transferencias(p_inicio date, p_fim date, p_origem text DEFAULT NULL::text)
 returns table(data_handoff timestamp with time zone, nome_cliente text, telefone_cliente text, razao_social text, origem text, destino text, representante text, telefone_representante text, motivo text, regiao text, tipo_cliente text, pais text, resumo text, mensagem text)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  perform public.analytics_check_acesso();
  return query
  select h.handoff_at,
         coalesce(nullif(trim(c."Nome"), ''), public.analytics_nome_cliente(coalesce(c.phone, h.phone))),
         coalesce(c.phone, h.phone),
         nullif(trim(c."Razao_social"), ''),
         h.origem,
         h.destino,
         h.representante,
         h.telefone_representante,
         nullif(h.reason, ''),
         nullif(c."Regiao", ''),
         public.analytics_tipo_cliente_label(c."Tipo_Cliente"),
         public.analytics_pais_telefone(coalesce(c.phone, h.phone)),
         nullif(c."Resumo", ''),
         h.mensagem
  from public.analytics_handoffs(p_inicio, p_fim) h
  left join lateral (
    select * from public.conversations c
    where c.phone = any (array[h.phone, substr(h.phone, 3)])
    order by c.last_message_at desc nulls last limit 1
  ) c on true
  where p_origem is null or h.origem like '%' || p_origem || '%'
  order by 1 desc;
end;
$function$;

create or replace function public.relatorio_site(p_inicio date, p_fim date)
 returns table(data timestamp with time zone, nome_cliente text, telefone text, regiao text, cidade text, tipo_cliente text, resumo text)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  perform public.analytics_check_acesso();

  return query
  select coalesce(c.last_message_at, c.created_at),
         coalesce(nullif(trim(c."Nome"), ''), public.analytics_nome_cliente(c.phone)),
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
$function$;

create or replace function public.relatorio_internacional(p_inicio date, p_fim date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_result jsonb;
begin
  perform public.analytics_check_acesso();

  with intl as (
    select c.created_at,
           c.phone,
           coalesce(nullif(trim(c."Nome"), ''), public.analytics_nome_cliente(c.phone)) as nome,
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
$function$;
