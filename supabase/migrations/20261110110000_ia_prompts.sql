-- Prompt do agente WhatsApp (Cris / "AI Agent1" do workflow n8n [5] Agente de IA) versionado no Supabase.
--
-- O n8n lê a versão ATIVA a cada mensagem (node "Buscar prompt ativo" → "Montar prompt").
-- A IA do sistema ([IA plataforma]) altera o prompt só por estas funções:
--   ia_prompt_ler        → lê seções / busca trechos
--   ia_prompt_propor     → aplica trocas (buscar/substituir) ou adiciona regra, valida e guarda como PROPOSTA
--   ia_prompt_publicar   → só depois do "aprovar" do usuário: a proposta vira a versão ativa
--   ia_prompt_descartar, ia_prompt_historico, ia_prompt_restaurar
-- Blocos protegidos (contrato com o n8n/parser) não podem mudar por aqui:
--   <output_contract>, <json_formatting_rules>, <handoff_payload>, <tools>
-- O marcador {{AGORA}} é trocado pela data/hora no n8n.

create table if not exists public.ia_prompts (
  id bigint generated always as identity primary key,
  agente text not null default 'cris_whatsapp',
  versao integer,
  status text not null check (status in ('proposta', 'ativa', 'arquivada', 'descartada')),
  conteudo text not null,
  base_versao integer,
  alteracoes jsonb,
  pedido text,
  motivo text,
  autor text,
  criado_em timestamptz not null default now(),
  publicado_em timestamptz,
  constraint ia_prompts_versao_uk unique (agente, versao)
);

create unique index if not exists ia_prompts_uma_ativa on public.ia_prompts (agente) where status = 'ativa';

alter table public.ia_prompts enable row level security;
revoke all on public.ia_prompts from anon, authenticated;

-- ---------------------------------------------------------------- helpers

-- Trecho completo <tag>...</tag> ou null. O prompt cita blocos pelo nome (ex.: "conforme
-- <handoff_payload>"), então o bloco real é a ÚLTIMA abertura antes do primeiro fechamento.
create or replace function public.ia_prompt_bloco(p_conteudo text, p_tag text)
returns text
language plpgsql
immutable
set search_path to ''
as $$
declare
  abre text := '<' || p_tag || '>';
  fecha text := '</' || p_tag || '>';
  j int;
  k int;
  ini int;
begin
  j := strpos(p_conteudo, fecha);
  if j = 0 then return null; end if;
  k := strpos(reverse(substr(p_conteudo, 1, j - 1)), reverse(abre));
  if k = 0 then return null; end if;
  ini := j - k - length(abre) + 1;
  return substr(p_conteudo, ini, j - ini + length(fecha));
end;
$$;

create or replace function public.ia_prompt_tags_protegidas()
returns text[]
language sql
immutable
set search_path to ''
as $$ select array['output_contract', 'json_formatting_rules', 'handoff_payload', 'tools'] $$;

-- null = ok; senão, o motivo da recusa.
create or replace function public.ia_prompt_validar(p_antigo text, p_novo text)
returns text
language plpgsql
immutable
set search_path to ''
as $$
declare
  t text;
begin
  if p_novo is null or btrim(p_novo) = '' then
    return 'O prompt ficaria vazio.';
  end if;
  if left(btrim(p_novo), 7) <> '<agent>' or right(btrim(p_novo), 8) <> '</agent>' then
    return 'O prompt precisa começar com <agent> e terminar com </agent>.';
  end if;
  if strpos(p_novo, '{{AGORA}}') = 0 then
    return 'O marcador {{AGORA}} (data/hora) não pode ser removido.';
  end if;
  if public.ia_prompt_bloco(p_novo, 'regras_ajustaveis') is null then
    return 'O bloco <regras_ajustaveis> não pode ser removido.';
  end if;
  foreach t in array public.ia_prompt_tags_protegidas() loop
    if public.ia_prompt_bloco(p_novo, t) is null
       or public.ia_prompt_bloco(p_novo, t) is distinct from public.ia_prompt_bloco(p_antigo, t) then
      return format('O bloco <%s> é protegido (contrato técnico com o n8n) e não pode ser alterado por aqui.', t);
    end if;
  end loop;
  if length(p_novo) > 150000 then
    return 'O prompt ficaria grande demais (limite 150 mil caracteres).';
  end if;
  if length(p_novo) < length(p_antigo) * 0.7 then
    return 'A alteração apagaria mais de 30% do prompt. Faça alterações menores.';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------- leitura

create or replace function public.ia_prompt_ler(
  p_secao text default null,
  p_busca text default null,
  p_completo boolean default false,
  p_agente text default 'cris_whatsapp')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  a public.ia_prompts;
  c text;
  i int;
  j int;
  tag text;
  pos int;
  base int := 0;
  achados jsonb := '[]'::jsonb;
  baixo text;
  termo text;
begin
  select * into a from public.ia_prompts where agente = p_agente and status = 'ativa';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Nenhuma versão ativa do prompt.');
  end if;
  c := a.conteudo;

  if p_completo then
    return jsonb_build_object('ok', true, 'versao', a.versao, 'conteudo', c);
  end if;

  if nullif(btrim(p_secao), '') is not null then
    -- <secao>...</secao> ou elemento com id="secao" (ex.: <step id="4_COMPRA_E_HANDOFF">)
    tag := btrim(p_secao, ' <>');
    if public.ia_prompt_bloco(c, tag) is not null then
      return jsonb_build_object('ok', true, 'versao', a.versao, 'secao', tag,
                                'protegida', tag = any (public.ia_prompt_tags_protegidas()),
                                'conteudo', public.ia_prompt_bloco(c, tag));
    end if;
    i := strpos(c, 'id="' || tag || '"');
    if i > 0 then
      j := i;
      while j > 1 and substr(c, j, 1) <> '<' loop j := j - 1; end loop;
      tag := substring(substr(c, j + 1, 60) from '^([A-Za-z_0-9]+)');
      pos := strpos(substr(c, i), '</' || tag || '>');
      if tag is not null and pos > 0 then
        return jsonb_build_object('ok', true, 'versao', a.versao, 'secao', p_secao,
                                  'conteudo', substr(c, j, (i - j) + pos - 1 + length('</' || tag || '>')));
      end if;
    end if;
    return jsonb_build_object('ok', false, 'erro', format('Seção "%s" não encontrada. Chame sem parâmetros para ver a lista.', p_secao));
  end if;

  if nullif(btrim(p_busca), '') is not null then
    baixo := lower(c);
    termo := lower(btrim(p_busca));
    loop
      pos := strpos(substr(baixo, base + 1), termo);
      exit when pos = 0 or jsonb_array_length(achados) >= 6;
      achados := achados || jsonb_build_object(
        'posicao', base + pos,
        'trecho', substr(c, greatest(1, base + pos - 300), length(termo) + 600));
      base := base + pos + length(termo);
    end loop;
    return jsonb_build_object('ok', true, 'versao', a.versao, 'busca', p_busca,
                              'ocorrencias', jsonb_array_length(achados), 'trechos', achados);
  end if;

  -- visão geral: lista de seções
  return jsonb_build_object(
    'ok', true,
    'versao', a.versao,
    'publicado_em', a.publicado_em,
    'tamanho', length(c),
    'protegidas', to_jsonb(public.ia_prompt_tags_protegidas()),
    'regras_ajustaveis', public.ia_prompt_bloco(c, 'regras_ajustaveis'),
    'secoes', (
      select jsonb_agg(distinct coalesce(m[1] || '#' || m[2], m[1]))
      from regexp_matches(c, '<([a-z_0-9]+)(?:\s+id="([^"]+)")?>', 'g') as m
    )
  );
end;
$$;

-- ---------------------------------------------------------------- escrita

create or replace function public.ia_prompt_propor(
  p_alteracoes jsonb,
  p_pedido text default null,
  p_motivo text default null,
  p_autor text default null,
  p_agente text default 'cris_whatsapp')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  a public.ia_prompts;
  novo text;
  e jsonb;
  b text;
  s text;
  n int;
  pos int;
  previews jsonb := '[]'::jsonb;
  erro text;
  pid bigint;
begin
  select * into a from public.ia_prompts where agente = p_agente and status = 'ativa';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Nenhuma versão ativa do prompt.');
  end if;
  if p_alteracoes is null or jsonb_typeof(p_alteracoes) <> 'array' or jsonb_array_length(p_alteracoes) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Envie uma lista de alterações.');
  end if;
  if jsonb_array_length(p_alteracoes) > 10 then
    return jsonb_build_object('ok', false, 'erro', 'No máximo 10 alterações por proposta.');
  end if;

  novo := a.conteudo;

  for e in select * from jsonb_array_elements(p_alteracoes) loop
    if nullif(btrim(e ->> 'adicionar_regra'), '') is not null then
      s := btrim(e ->> 'adicionar_regra');
      if length(s) > 2000 then
        return jsonb_build_object('ok', false, 'erro', 'Regra longa demais (máx. 2000 caracteres).');
      end if;
      novo := replace(novo, E'  (nenhuma regra extra no momento)\n', '');
      novo := replace(novo, '</regras_ajustaveis>', '  - ' || s || E'\n</regras_ajustaveis>');
      previews := previews || jsonb_build_object('tipo', 'nova_regra', 'depois', s);

    elsif e ? 'buscar' then
      b := e ->> 'buscar';
      s := coalesce(e ->> 'substituir', '');
      if b is null or length(btrim(b)) < 8 then
        return jsonb_build_object('ok', false, 'erro', 'O trecho "buscar" precisa ter pelo menos 8 caracteres.');
      end if;
      n := (length(novo) - length(replace(novo, b, ''))) / length(b);
      if n = 0 then
        return jsonb_build_object('ok', false, 'erro',
          format('Trecho não encontrado no prompt (copie exatamente como está, com quebras de linha): "%s"', left(b, 120)));
      elsif n > 1 then
        return jsonb_build_object('ok', false, 'erro',
          format('O trecho aparece %s vezes; inclua mais texto ao redor para ficar único: "%s"', n, left(b, 120)));
      end if;
      pos := strpos(novo, b);
      novo := overlay(novo placing s from pos for length(b));
      previews := previews || jsonb_build_object(
        'tipo', case when s = '' then 'remocao' else 'troca' end,
        'antes', b,
        'depois', s,
        'contexto_depois', substr(novo, greatest(1, pos - 200), length(s) + 400));
    else
      return jsonb_build_object('ok', false, 'erro', 'Cada alteração precisa de "buscar"/"substituir" ou "adicionar_regra".');
    end if;
  end loop;

  if novo = a.conteudo then
    return jsonb_build_object('ok', false, 'erro', 'As alterações não mudam nada no prompt.');
  end if;

  erro := public.ia_prompt_validar(a.conteudo, novo);
  if erro is not null then
    return jsonb_build_object('ok', false, 'erro', erro);
  end if;

  -- uma proposta pendente por vez
  update public.ia_prompts set status = 'descartada'
  where agente = p_agente and status = 'proposta';

  insert into public.ia_prompts (agente, status, conteudo, base_versao, alteracoes, pedido, motivo, autor)
  values (p_agente, 'proposta', novo, a.versao, p_alteracoes, p_pedido, p_motivo, p_autor)
  returning id into pid;

  return jsonb_build_object(
    'ok', true,
    'proposta_id', pid,
    'versao_atual', a.versao,
    'alteracoes', previews,
    'tamanho_antes', length(a.conteudo),
    'tamanho_depois', length(novo),
    'aviso', 'Ainda NÃO publicado. Mostre o antes/depois e só publique após o usuário aprovar.');
end;
$$;

create or replace function public.ia_prompt_publicar(p_proposta_id bigint, p_autor text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  p public.ia_prompts;
  a public.ia_prompts;
  erro text;
  nova int;
begin
  select * into p from public.ia_prompts where id = p_proposta_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Proposta não encontrada.');
  end if;
  if p.status <> 'proposta' then
    return jsonb_build_object('ok', false, 'erro', format('A proposta %s não está pendente (status: %s).', p.id, p.status));
  end if;

  select * into a from public.ia_prompts where agente = p.agente and status = 'ativa' for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Nenhuma versão ativa do prompt.');
  end if;
  if a.versao is distinct from p.base_versao then
    update public.ia_prompts set status = 'descartada' where id = p.id;
    return jsonb_build_object('ok', false, 'erro',
      format('O prompt mudou desde a proposta (agora é a versão %s). Gere uma nova proposta.', a.versao));
  end if;

  erro := public.ia_prompt_validar(a.conteudo, p.conteudo);
  if erro is not null then
    return jsonb_build_object('ok', false, 'erro', erro);
  end if;

  select coalesce(max(versao), 0) + 1 into nova from public.ia_prompts where agente = p.agente;

  update public.ia_prompts set status = 'arquivada' where id = a.id;
  update public.ia_prompts
     set status = 'ativa', versao = nova, publicado_em = now(), autor = coalesce(p_autor, autor)
   where id = p.id;

  return jsonb_build_object('ok', true, 'versao', nova, 'versao_anterior', a.versao,
                            'aviso', 'Publicado. A próxima mensagem no WhatsApp já usa esta versão.');
end;
$$;

create or replace function public.ia_prompt_descartar(p_proposta_id bigint)
returns jsonb
language sql
security definer
set search_path to ''
as $$
  with u as (
    update public.ia_prompts set status = 'descartada'
    where id = p_proposta_id and status = 'proposta'
    returning id
  )
  select case when exists (select 1 from u)
              then jsonb_build_object('ok', true)
              else jsonb_build_object('ok', false, 'erro', 'Proposta não encontrada ou não está pendente.') end;
$$;

create or replace function public.ia_prompt_historico(p_limite int default 15, p_agente text default 'cris_whatsapp')
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(jsonb_agg(x.j order by x.ordem desc), '[]'::jsonb)
  from (
    select coalesce(publicado_em, criado_em) as ordem,
           jsonb_build_object(
             'id', id, 'versao', versao, 'status', status, 'pedido', pedido, 'motivo', motivo,
             'autor', autor, 'criado_em', criado_em, 'publicado_em', publicado_em,
             'base_versao', base_versao, 'alteracoes', alteracoes, 'tamanho', length(conteudo)) as j
    from public.ia_prompts
    where agente = p_agente and status <> 'descartada'
    order by coalesce(publicado_em, criado_em) desc
    limit least(greatest(coalesce(p_limite, 15), 1), 100)
  ) x;
$$;

create or replace function public.ia_prompt_restaurar(
  p_versao int,
  p_autor text default null,
  p_motivo text default null,
  p_agente text default 'cris_whatsapp')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  o public.ia_prompts;
  a public.ia_prompts;
  erro text;
  nova int;
begin
  select * into a from public.ia_prompts where agente = p_agente and status = 'ativa' for update;
  select * into o from public.ia_prompts where agente = p_agente and versao = p_versao;
  if not found then
    return jsonb_build_object('ok', false, 'erro', format('Versão %s não encontrada.', p_versao));
  end if;
  if a.id = o.id then
    return jsonb_build_object('ok', false, 'erro', format('A versão %s já é a ativa.', p_versao));
  end if;

  erro := public.ia_prompt_validar(a.conteudo, o.conteudo);
  if erro is not null then
    return jsonb_build_object('ok', false, 'erro', 'Não dá para restaurar essa versão: ' || erro);
  end if;

  select coalesce(max(versao), 0) + 1 into nova from public.ia_prompts where agente = p_agente;
  update public.ia_prompts set status = 'arquivada' where id = a.id;
  insert into public.ia_prompts (agente, versao, status, conteudo, base_versao, pedido, motivo, autor, publicado_em)
  values (p_agente, nova, 'ativa', o.conteudo, a.versao,
          format('Restaurar versão %s', p_versao), p_motivo, p_autor, now());

  return jsonb_build_object('ok', true, 'versao', nova, 'restaurada_de', p_versao, 'versao_anterior', a.versao);
end;
$$;

-- Só o n8n (service_role) chama estas funções; nada exposto a anon/authenticated.
revoke all on function public.ia_prompt_bloco(text, text) from public, anon, authenticated;
revoke all on function public.ia_prompt_tags_protegidas() from public, anon, authenticated;
revoke all on function public.ia_prompt_validar(text, text) from public, anon, authenticated;
revoke all on function public.ia_prompt_ler(text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.ia_prompt_propor(jsonb, text, text, text, text) from public, anon, authenticated;
revoke all on function public.ia_prompt_publicar(bigint, text) from public, anon, authenticated;
revoke all on function public.ia_prompt_descartar(bigint) from public, anon, authenticated;
revoke all on function public.ia_prompt_historico(int, text) from public, anon, authenticated;
revoke all on function public.ia_prompt_restaurar(int, text, text, text) from public, anon, authenticated;
grant execute on function public.ia_prompt_ler(text, text, boolean, text) to service_role;
grant execute on function public.ia_prompt_propor(jsonb, text, text, text, text) to service_role;
grant execute on function public.ia_prompt_publicar(bigint, text) to service_role;
grant execute on function public.ia_prompt_descartar(bigint) to service_role;
grant execute on function public.ia_prompt_historico(int, text) to service_role;
grant execute on function public.ia_prompt_restaurar(int, text, text, text) to service_role;
