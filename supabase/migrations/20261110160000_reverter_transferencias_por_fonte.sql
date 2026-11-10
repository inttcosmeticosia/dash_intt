-- Reverte 20261110150000 (a pedido): relatorio_transferencias volta a usar analytics_handoffs
-- com filtro "origem contém p_origem" (aba humana inclui 'humano+ia').
-- analytics_handoffs_fonte fica no banco sem uso (regra do projeto: não dropar funções).
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
