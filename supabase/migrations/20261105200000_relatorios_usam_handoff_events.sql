-- Transferências passam a ser contadas por public.handoff_events (fonte única):
--   source = 'ia'     → handoff emitido pelo agente (gravado pelo [06] via registrar_handoff_ia)
--   source = 'humano' → atendente passou o contato do representante (gravado pelo [03] via registrar_mensagem_humana)
-- Antes a regra era "conversations.Representante preenchido", que parou de ser gravado em 2026-10-30
-- quando o handoff da IA passou a transferir para o operador Bitrix em vez de enviar o contato.
-- Nenhuma assinatura existente muda (n8n, e-mail semanal e agente-export continuam compatíveis).

-- Uma transferência por cliente por dia; prioriza a linha com representante identificado.
create or replace function public.analytics_handoffs(p_inicio date, p_fim date)
returns table(phone text, dia date, handoff_at timestamptz, origem text, handoff_to text, reason text,
              representante text, telefone_representante text, destino text, mensagem text)
language sql stable security definer set search_path to '' as $$
  with ev as (
    select public.handoff_norm_phone(e.phone) as phone_n, e.*,
           (e.handoff_at at time zone 'America/Sao_Paulo')::date as dia
    from public.handoff_events e
    where (e.handoff_at at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
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
$$;
revoke all on function public.analytics_handoffs(date, date) from public, anon;
grant execute on function public.analytics_handoffs(date, date) to authenticated, service_role;

-- Relatório completo usado pelo dashboard (p_origem: null = todas, 'ia' ou 'humano')
create or replace function public.relatorio_transferencias(p_inicio date, p_fim date, p_origem text default null)
returns table(data_handoff timestamptz, nome_cliente text, telefone_cliente text, razao_social text,
              origem text, destino text, representante text, telefone_representante text, motivo text,
              regiao text, tipo_cliente text, pais text, resumo text, mensagem text)
language plpgsql stable security definer set search_path to '' as $$
begin
  perform public.analytics_check_acesso();
  return query
  select h.handoff_at,
         nullif(c."Nome", ''),
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
$$;
revoke all on function public.relatorio_transferencias(date, date, text) from public, anon;
grant execute on function public.relatorio_transferencias(date, date, text) to authenticated, service_role;

-- Mesmas colunas de antes; "representante" agora traz o destino (nome ou equipe Bitrix)
create or replace function public.relatorio_handoffs(p_inicio date, p_fim date)
returns table(data_handoff timestamptz, nome_cliente text, telefone_cliente text, razao_social text,
              representante text, telefone_representante text, regiao text, tipo_cliente text,
              motivo text, pais text, resumo text)
language plpgsql stable security definer set search_path to '' as $$
begin
  perform public.analytics_check_acesso();
  return query
  select r.data_handoff, r.nome_cliente, r.telefone_cliente, r.razao_social, r.destino,
         r.telefone_representante, r.regiao, r.tipo_cliente, r.motivo, r.pais, r.resumo
  from public.relatorio_transferencias(p_inicio, p_fim, null) r;
end;
$$;

create or replace function public.handoffs_por_representante(p_inicio date, p_fim date)
returns table(representante text, telefone_representante text, total bigint, ultima_transferencia timestamptz)
language plpgsql stable security definer set search_path to '' as $$
begin
  perform public.analytics_check_acesso();
  return query
  select mode() within group (order by h.destino),
         max(h.telefone_representante),
         count(*),
         max(h.handoff_at)
  from public.analytics_handoffs(p_inicio, p_fim) h
  group by upper(public.unaccent(trim(h.destino)))
  order by count(*) desc;
end;
$$;

-- Transferências do atendimento humano no formato antigo da aba "Transferência Atendimento"
-- (a tabela chat_histories_Ramon parou em 2026-11-04; agora vem do [03] via human_messages)
create or replace function public.relatorio_transferencias_ramon(p_inicio date, p_fim date)
returns table(data timestamptz, nome_cliente text, telefone_cliente text, telefone_mencionado text, resumo text, mensagem text)
language plpgsql stable security definer set search_path to '' as $$
begin
  perform public.analytics_check_acesso();
  return query
  select e.handoff_at,
         nullif(c."Nome", ''),
         e.phone,
         e.telefone_representante,
         nullif(c."Resumo", ''),
         e.message_text
  from public.handoff_events e
  left join lateral (
    select * from public.conversations c
    where c.phone = any (array[e.phone, public.handoff_norm_phone(e.phone)])
    order by c.last_message_at desc nulls last limit 1
  ) c on true
  where e.source = 'humano'
    and (e.handoff_at at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  order by e.handoff_at desc;
end;
$$;

create or replace function public.metricas_atendimento(p_inicio date, p_fim date)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  v_dias int := (p_fim - p_inicio) + 1;
  v_ant_inicio date := p_inicio - v_dias;
  v_ant_fim date := p_inicio - 1;
  v_novos bigint; v_ativas bigint; v_transferidos bigint; v_internacionais bigint;
  v_ant_novos bigint; v_ant_ativas bigint; v_ant_transferidos bigint;
begin
  perform public.analytics_check_acesso();

  select count(*) filter (where d between p_inicio and p_fim),
         count(*) filter (where d between p_inicio and p_fim and pais <> 'Brasil'),
         count(*) filter (where d between v_ant_inicio and v_ant_fim)
  into v_novos, v_internacionais, v_ant_novos
  from (select (created_at at time zone 'America/Sao_Paulo')::date d, public.analytics_pais_telefone(phone) pais
        from public.conversations where phone is not null and length(phone) > 5) b;

  select count(distinct phone) into v_transferidos from public.analytics_handoffs(p_inicio, p_fim);
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

create or replace function public.atendimentos_diarios(p_inicio date, p_fim date)
returns table(dia date, novos bigint, ativos bigint, transferidos bigint)
language plpgsql stable security definer set search_path to '' as $$
begin
  perform public.analytics_check_acesso();
  return query
  with dias as (select generate_series(p_inicio, p_fim, interval '1 day')::date as dia),
  base as (
    select conv_key, (created_at at time zone 'America/Sao_Paulo')::date as dia_criacao
    from public.conversations where phone is not null and length(phone) > 5
  ),
  ativos as (
    select (m.received_at at time zone 'America/Sao_Paulo')::date as dia, count(distinct m.conv_key) as n
    from public.inbound_messages m join base b on b.conv_key = m.conv_key
    where (m.received_at at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
    group by 1
  ),
  transf as (select h.dia, count(distinct h.phone) as n from public.analytics_handoffs(p_inicio, p_fim) h group by 1)
  select d.dia,
         (select count(*) from base where base.dia_criacao = d.dia),
         coalesce(a.n, 0),
         coalesce(t.n, 0)
  from dias d
  left join ativos a on a.dia = d.dia
  left join transf t on t.dia = d.dia
  order by d.dia;
end;
$$;

create or replace function public.atendimentos_semanais(p_inicio date, p_fim date)
returns table(semana date, novos bigint, ativos bigint, transferidos bigint)
language plpgsql stable security definer set search_path to '' as $$
begin
  perform public.analytics_check_acesso();
  return query
  with base as (
    select conv_key, (created_at at time zone 'America/Sao_Paulo')::date as dia_criacao
    from public.conversations where phone is not null and length(phone) > 5
  ),
  semanas as (
    select generate_series(date_trunc('week', p_inicio::timestamp)::date, p_fim, interval '7 days')::date as semana
  ),
  ativos as (
    select date_trunc('week', (m.received_at at time zone 'America/Sao_Paulo'))::date as semana, count(distinct m.conv_key) as n
    from public.inbound_messages m join base b on b.conv_key = m.conv_key
    where (m.received_at at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
    group by 1
  ),
  transf as (
    select date_trunc('week', h.dia::timestamp)::date as semana, count(distinct h.phone) as n
    from public.analytics_handoffs(p_inicio, p_fim) h group by 1
  )
  select s.semana,
         (select count(*) from base where base.dia_criacao between greatest(s.semana, p_inicio) and least(s.semana + 6, p_fim)),
         coalesce(a.n, 0),
         coalesce(t.n, 0)
  from semanas s
  left join ativos a on a.semana = s.semana
  left join transf t on t.semana = s.semana
  order by s.semana;
end;
$$;
