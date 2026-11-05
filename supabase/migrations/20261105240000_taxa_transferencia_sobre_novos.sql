-- taxa_transferencia passa a ser: novos atendimentos do período que foram transferidos ÷ novos atendimentos.
-- Antes era transferidos (todos, inclusive clientes antigos e lotes do atendimento) ÷ novos → passava de 100%.
-- Nova chave novos_transferidos; demais chaves inalteradas.

create or replace function public.metricas_atendimento(p_inicio date, p_fim date)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  v_dias int := (p_fim - p_inicio) + 1;
  v_ant_inicio date := p_inicio - v_dias;
  v_ant_fim date := p_inicio - 1;
  v_novos bigint; v_ativas bigint; v_transferidos bigint; v_internacionais bigint;
  v_transf_ia bigint; v_transf_humano bigint; v_novos_transferidos bigint;
  v_ant_novos bigint; v_ant_ativas bigint; v_ant_transferidos bigint;
begin
  perform public.analytics_check_acesso();

  select count(*) filter (where d between p_inicio and p_fim),
         count(*) filter (where d between p_inicio and p_fim and pais <> 'Brasil'),
         count(*) filter (where d between v_ant_inicio and v_ant_fim)
  into v_novos, v_internacionais, v_ant_novos
  from (select (created_at at time zone 'America/Sao_Paulo')::date d, public.analytics_pais_telefone(phone) pais
        from public.conversations where phone is not null and length(phone) > 5) b;

  select count(distinct h.phone),
         count(distinct h.phone) filter (where 'ia' = any (string_to_array(h.origem, '+'))),
         count(distinct h.phone) filter (where 'humano' = any (string_to_array(h.origem, '+')))
  into v_transferidos, v_transf_ia, v_transf_humano
  from public.analytics_handoffs(p_inicio, p_fim) h;
  -- taxa: dos clientes NOVOS do período, quantos foram transferidos no período
  select count(*) into v_novos_transferidos
  from public.conversations c
  where c.phone is not null and length(c.phone) > 5
    and (c.created_at at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
    and public.handoff_norm_phone(c.phone) in (
      select public.handoff_norm_phone(h.phone) from public.analytics_handoffs(p_inicio, p_fim) h);

  select count(distinct phone) into v_ant_transferidos from public.analytics_handoffs(v_ant_inicio, v_ant_fim);

  select count(distinct m.conv_key) into v_ativas
  from public.inbound_messages m join public.conversations c on c.conv_key = m.conv_key
  where c.phone is not null and length(c.phone) > 5
    and (m.received_at at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim;

  select count(distinct m.conv_key) into v_ant_ativas
  from public.inbound_messages m join public.conversations c on c.conv_key = m.conv_key
  where c.phone is not null and length(c.phone) > 5
    and (m.received_at at time zone 'America/Sao_Paulo')::date between v_ant_inicio and v_ant_fim;

  return jsonb_build_object(
    'novos_atendimentos', v_novos,
    'conversas_ativas', v_ativas,
    'transferidos', v_transferidos,
    'transferidos_pela_ia', v_transf_ia,
    'transferidos_pelo_atendimento_humano', v_transf_humano,
    'novos_transferidos', v_novos_transferidos,
    'taxa_transferencia', case when v_novos > 0 then round(v_novos_transferidos::numeric / v_novos * 100, 1) else 0 end,
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

