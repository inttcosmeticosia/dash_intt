-- Página "Atendimento Humano": só eventos do atendimento humano.
-- analytics_handoffs junta IA + humano do mesmo cliente/dia (origem 'humano+ia') e a linha
-- escolhida podia ser o evento da IA (destino/mensagem da IA). analytics_handoffs_fonte
-- filtra os eventos pela fonte ANTES de juntar; relatorio_transferencias usa ela quando
-- p_origem é informado.

create or replace function public.analytics_handoffs_fonte(p_inicio date, p_fim date, p_fonte text)
 returns table(phone text, dia date, handoff_at timestamp with time zone, origem text, handoff_to text, reason text, representante text, telefone_representante text, destino text, mensagem text)
 language sql
 stable security definer
 set search_path to ''
as $function$
  with ev as (
    select public.handoff_norm_phone(e.phone) as phone_n, e.*,
           (e.handoff_at at time zone 'America/Sao_Paulo')::date as dia
    from public.handoff_events e
    where (e.handoff_at at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
      and (p_fonte is null or e.source = p_fonte)
  ),
  origens as (
    select phone_n, dia, string_agg(distinct source, '+' order by source) as origem from ev group by 1, 2
  )
  select distinct on (ev.phone_n, ev.dia)
         '55' || ev.phone_n, ev.dia, ev.handoff_at, o.origem, ev.handoff_to, ev.reason,
         nullif(ev.representante, ''), nullif(ev.telefone_representante, ''),
         coalesce(nullif(ev.representante, ''),
                  case ev.handoff_to
                    when 'atendente_regional' then 'Equipe comercial (Bitrix)'
                    when 'suporte_humano' then 'Suporte (Bitrix)'
                    when 'representante' then 'Representante (não identificado)'
                    else coalesce(ev.handoff_to, 'Não informado') end),
         ev.message_text
  from ev join origens o using (phone_n, dia)
  where ev.phone_n is not null and length(ev.phone_n) >= 10
  order by ev.phone_n, ev.dia, (nullif(ev.representante, '') is null), ev.handoff_at desc
$function$;

revoke all on function public.analytics_handoffs_fonte(date, date, text) from public, anon, authenticated;

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
  from public.analytics_handoffs_fonte(p_inicio, p_fim, nullif(trim(p_origem), '')) h
  left join lateral (
    select * from public.conversations c
    where c.phone = any (array[h.phone, substr(h.phone, 3)])
    order by c.last_message_at desc nulls last limit 1
  ) c on true
  order by 1 desc;
end;
$function$;
