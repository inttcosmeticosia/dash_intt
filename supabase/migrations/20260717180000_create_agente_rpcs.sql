-- RPCs para o agente de relatórios n8n (leitura, mesmo padrão dos RPCs de atendimento):
--   * SECURITY DEFINER + search_path = '' + guard analytics_check_acesso()
--   * Conversa válida = phone com mais de 5 caracteres
--   * Resumo gravado pelo agente contém "\n" literais → convertidos em quebras reais

-- ── Busca de conversas (texto livre + filtros) ──────────────────────────
create or replace function public.agente_buscar_conversas(
  p_busca text default null,
  p_inicio date default null,
  p_fim date default null,
  p_representante text default null,
  p_tipo_cliente text default null,
  p_pais text default null,
  p_apenas_transferidas boolean default false,
  p_limite int default 20
)
returns table (
  conv_key text,
  nome text,
  telefone text,
  cidade text,
  regiao text,
  tipo_cliente text,
  pais text,
  representante text,
  telefone_representante text,
  motivo_transferencia text,
  resumo text,
  criada_em timestamptz,
  ultima_mensagem_em timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_busca text := nullif(trim(coalesce(p_busca, '')), '');
  v_digitos text := nullif(regexp_replace(coalesce(p_busca, ''), '\D', '', 'g'), '');
begin
  perform public.analytics_check_acesso();

  return query
  select c.conv_key,
         nullif(c."Nome", ''),
         c.phone,
         nullif(c."Cidade", ''),
         nullif(c."Regiao", ''),
         public.analytics_tipo_cliente_label(c."Tipo_Cliente"),
         public.analytics_pais_telefone(c.phone),
         nullif(c."Representante", ''),
         nullif(c."Telefone Representante", ''),
         nullif(c.reason, ''),
         replace(nullif(c."Resumo", ''), '\n', E'\n'),
         c.created_at,
         c.last_message_at
  from public.conversations c
  where c.phone is not null and length(c.phone) > 5
    and (p_inicio is null
         or (coalesce(c.last_message_at, c.created_at) at time zone 'America/Sao_Paulo')::date >= p_inicio)
    and (p_fim is null
         or (c.created_at at time zone 'America/Sao_Paulo')::date <= p_fim)
    and (not p_apenas_transferidas
         or (c."Representante" is not null and c."Representante" <> ''))
    and (p_representante is null
         or upper(public.unaccent(trim(coalesce(c."Representante", ''))))
            like '%' || upper(public.unaccent(trim(p_representante))) || '%')
    and (p_tipo_cliente is null
         or c."Tipo_Cliente" = p_tipo_cliente
         or upper(public.unaccent(coalesce(public.analytics_tipo_cliente_label(c."Tipo_Cliente"), '')))
            = upper(public.unaccent(trim(p_tipo_cliente))))
    and (p_pais is null
         or upper(public.unaccent(coalesce(public.analytics_pais_telefone(c.phone), '')))
            = upper(public.unaccent(trim(p_pais))))
    and (v_busca is null
         or upper(public.unaccent(coalesce(c."Nome", '') || ' ' || coalesce(c."Cidade", '') || ' '
                  || coalesce(c."Regiao", '') || ' ' || coalesce(c."Resumo", '')))
            like '%' || upper(public.unaccent(v_busca)) || '%'
         or (v_digitos is not null and c.phone like '%' || v_digitos || '%'))
  order by coalesce(c.last_message_at, c.created_at) desc
  limit least(greatest(coalesce(p_limite, 20), 1), 50);
end;
$$;

-- ── Detalhe de uma conversa + últimas mensagens recebidas ───────────────
create or replace function public.agente_detalhe_conversa(
  p_conv_key text default null,
  p_telefone text default null,
  p_max_mensagens int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_digitos text := nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), '');
  v_conv record;
  v_msgs jsonb;
begin
  perform public.analytics_check_acesso();

  if p_conv_key is null and v_digitos is null then
    return jsonb_build_object('erro', 'informe conv_key ou telefone');
  end if;

  select c.conv_key,
         nullif(c."Nome", '') as nome,
         c.phone,
         nullif(c."Cidade", '') as cidade,
         nullif(c."Regiao", '') as regiao,
         public.analytics_tipo_cliente_label(c."Tipo_Cliente") as tipo_cliente,
         public.analytics_pais_telefone(c.phone) as pais,
         nullif(c."Representante", '') as representante,
         nullif(c."Telefone Representante", '') as telefone_representante,
         nullif(c.reason, '') as motivo_transferencia,
         replace(nullif(c."Resumo", ''), '\n', E'\n') as resumo,
         c.created_at,
         c.last_message_at
  into v_conv
  from public.conversations c
  where (p_conv_key is not null and c.conv_key = p_conv_key)
     or (p_conv_key is null and c.phone like '%' || v_digitos || '%')
  order by coalesce(c.last_message_at, c.created_at) desc
  limit 1;

  if v_conv.conv_key is null then
    return jsonb_build_object('erro', 'conversa não encontrada');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'recebida_em', t.received_at,
           'texto', t.text
         ) order by t.received_at), '[]'::jsonb)
  into v_msgs
  from (
    select m.received_at, m.text
    from public.inbound_messages m
    where m.conv_key = v_conv.conv_key
    order by m.received_at desc
    limit least(greatest(coalesce(p_max_mensagens, 30), 1), 100)
  ) t;

  return jsonb_build_object(
    'conversa', jsonb_build_object(
      'conv_key', v_conv.conv_key,
      'nome', v_conv.nome,
      'telefone', v_conv.phone,
      'cidade', v_conv.cidade,
      'regiao', v_conv.regiao,
      'tipo_cliente', v_conv.tipo_cliente,
      'pais', v_conv.pais,
      'representante', v_conv.representante,
      'telefone_representante', v_conv.telefone_representante,
      'motivo_transferencia', v_conv.motivo_transferencia,
      'resumo', v_conv.resumo,
      'criada_em', v_conv.created_at,
      'ultima_mensagem_em', v_conv.last_message_at
    ),
    'mensagens_recebidas', v_msgs
  );
end;
$$;

-- ── Permissões: nada para anon; só authenticated + service_role ─────────
revoke execute on function public.agente_buscar_conversas(text, date, date, text, text, text, boolean, int) from public, anon;
revoke execute on function public.agente_detalhe_conversa(text, text, int) from public, anon;

grant execute on function public.agente_buscar_conversas(text, date, date, text, text, text, boolean, int) to authenticated, service_role;
grant execute on function public.agente_detalhe_conversa(text, text, int) to authenticated, service_role;
