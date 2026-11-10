-- Tipo de cliente com a FONTE da classificação, para o dashboard não mostrar
-- "Consumidor Final" em quem claramente é revenda.
--
-- conversations."Tipo_Cliente" é uma foto tirada pela IA durante a conversa (padrão 115 =
-- Consumidor Final). Transferências feitas por atendente humano NÃO atualizam esse campo.
-- Resolução na leitura (não escreve em conversations), em ordem de confiança:
--   1) formulário do site ("Tipo de Cliente *: Lojista"), só se o WhatsApp do form bate
--      com o telefone                                         → "Lojista · formulário"
--   2) atendente humano mandou para um representante e a IA tinha 115/vazio
--                                                             → "Revenda · atendente"
--   3) classificação da IA                                    → "Consumidor Final · IA"
-- O texto antes de " · " é o tipo; o dashboard agrupa só por ele.

create or replace function public.analytics_tipo_cliente_resolvido(
  p_phone text, p_tipo_ia text, p_origem text, p_representante text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  with p as (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d),
  tels as (
    select distinct t from p, unnest(array[p.d, '55' || p.d, substr(p.d, 3)]) as t
    where length(p.d) >= 8
  ),
  form as (
    select trim((regexp_match(e.message_text, 'Tipo de Cliente\s*\*?\s*:\s*\n?\s*([^\n]+)'))[1]) as tipo
    from public.handoff_events e, p
    where e.phone in (select t from tels)
      and e.message_text ~* 'Tipo de Cliente'
      and right(regexp_replace(coalesce((regexp_match(e.message_text, 'WhatsApp\s*\*?\s*:\s*\n?\s*([^\n]+)'))[1], ''), '\D', '', 'g'), 8)
          = right(p.d, 8)
    order by e.handoff_at desc nulls last
    limit 1
  ),
  ia as (select public.analytics_tipo_cliente_label(p_tipo_ia) as tipo)
  select case
    when (select tipo from form) is not null
      then (select case lower(tipo)
                     when 'lojista' then 'Lojista'
                     when 'consultor' then 'Consultor'
                     when 'e-commerce' then 'E-Commerce'
                     when 'distribuidor' then 'Distribuidor'
                     when 'consumidor final' then 'Consumidor Final'
                     else initcap(tipo) end
            from form) || ' · formulário'
    when coalesce(p_origem, '') like '%humano%'
         and nullif(trim(p_representante), '') is not null
         and coalesce((select tipo from ia), 'Consumidor Final') = 'Consumidor Final'
      then 'Revenda · atendente'
    when (select tipo from ia) is not null
      then (select tipo from ia) || ' · IA'
  end;
$$;

revoke all on function public.analytics_tipo_cliente_resolvido(text, text, text, text) from public, anon, authenticated;

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
         public.analytics_tipo_cliente_resolvido(coalesce(c.phone, h.phone), c."Tipo_Cliente", h.origem, h.representante),
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
