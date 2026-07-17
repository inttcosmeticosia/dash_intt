-- Dicionário de produtos INTT (extraído do catálogo 2025 ingerido no RAG, collection 'produtos')
-- + RPC que conta menções de produto nas MENSAGENS dos clientes e nos resumos.
-- Não depende do resumo do agente: varre inbound_messages direto.
-- Termos armazenados sem acento/pontuação de regex (só A-Z, 0-9, espaço, hífen) — o match
-- usa fronteira de palavra (~ '\m...\M') sobre texto unaccent+upper.

create table if not exists public.analytics_produtos (
  id bigint generated always as identity primary key,
  nome text not null unique,
  aliases text[] not null default '{}',
  categoria boolean not null default false -- true = termo genérico (ex.: LUBRIFICANTE), não um SKU
);

alter table public.analytics_produtos enable row level security; -- sem policies: acesso só via RPC SECURITY DEFINER

insert into public.analytics_produtos (nome, aliases, categoria) values
  ('ORAL ME', '{}', false),
  ('SEXY LIPS', '{}', false),
  ('VELAS BEIJAVEIS', '{"VELA BEIJAVEL"}', false),
  ('VELAS ALLUMER', '{"ALLUMER"}', false),
  ('PEROLAS IN LOVE', '{"COLAR DE PEROLAS"}', false),
  ('ATRACAO FATAL', '{}', false),
  ('OLEO TANTRIC APPLE', '{"TANTRIC APPLE"}', false),
  ('ANIMALS', '{}', false),
  ('SELVAGEM', '{}', false),
  ('INTT RU', '{}', false),
  ('MELTESAO', '{}', false),
  ('POWER HONEY', '{}', false),
  ('INTT PEPPER', '{}', false),
  ('HALLS VIBER', '{}', false),
  ('SUCTION', '{}', false),
  ('GARGANTA PROFUNDA', '{"SPRAY GARGANTA"}', false),
  ('CLIMAX', '{"CLIMAX BY INTT"}', false),
  ('PERMITA-SE', '{"PERMITA SE"}', false),
  ('AMOR EM PETALAS', '{"PETALAS"}', false),
  ('SOMOS 2', '{"SOMOS DOIS"}', false),
  ('OOH DELICIA', '{"CALDA PICANTE"}', false),
  ('ORIENT SEXY', '{}', false),
  ('ORIENT TONS', '{}', false),
  ('IN HEAVEN', '{"LINHA IN HEAVEN"}', false),
  ('BABALUB', '{}', false),
  ('K-INTT', '{"KINTT","K INTT"}', false),
  ('K-INTT ICE', '{}', false),
  ('HIDRANAL', '{}', false),
  ('VAGISEX', '{}', false),
  ('TOUCH ME', '{}', false),
  ('LUB-IN', '{"LUB IN","LUBIN"}', false),
  ('LUBVIBES', '{"LUB VIBES"}', false),
  ('ELIXIR SEDUCAO', '{"ELIXIR"}', false),
  ('LUMIER INTTIMUS', '{"LUMIER"}', false),
  ('PERFUME EURO', '{}', false),
  ('PERFUME PER AMORE', '{"PER AMORE"}', false),
  ('CHEIRO DELA', '{}', false),
  ('INTT EROS', '{}', false),
  ('CHICLETEIRA', '{}', false),
  ('EROS MEN', '{}', false),
  ('ODOR FREE', '{}', false),
  ('INTTCARE', '{"INTT CARE"}', false),
  ('IN-CLEAN', '{"INCLEAN","IN CLEAN"}', false),
  ('TOALHAS COMPACTAS', '{}', false),
  ('SABONETE INTIMO', '{}', true),
  ('LIMPA TOYS', '{}', false),
  ('SWEET ROSE', '{"MAKEUP TINT"}', false),
  ('ILUMINE', '{}', false),
  ('PROVOCA-ME', '{"PROVOCA ME"}', false),
  ('ANAIS', '{}', false),
  ('BEIJO GREGO', '{}', false),
  ('BRUMA PELVICA', '{}', false),
  ('CALCINHA VIBRATION', '{}', false),
  ('CALDEIRAO DA VIBRACAO', '{}', false),
  ('CLIV BLACK', '{}', false),
  ('CLIV INTT', '{"CLIV"}', false),
  ('CLIV INTT GOLD', '{"CLIV GOLD"}', false),
  ('CLIV INTT SOFT', '{"CLIV SOFT"}', false),
  ('CLIV INTT TONS', '{"CLIV TONS"}', false),
  ('COCONUT CREAM', '{}', false),
  ('CREME PARA VIRILHA CLAREADOR', '{"CREME VIRILHA"}', false),
  ('CRISTAL TOUCH', '{}', false),
  ('ERUPTION', '{}', false),
  ('EXCITANTE PULSE', '{}', false),
  ('EXCITATION', '{}', false),
  ('EXCITATION CHICLETEIRA', '{}', false),
  ('FEEL FRESH', '{}', false),
  ('FETISH PRANK', '{}', false),
  ('FOR LADY', '{}', false),
  ('FRUIT COCONUT', '{}', false),
  ('FRUIT SEXY', '{}', false),
  ('FRUIT SEXY TONS', '{}', false),
  ('GOLDEN BUTTON', '{}', false),
  ('GOLDEN CHUPS', '{}', false),
  ('GOZO MAGICO', '{}', false),
  ('INFLATE', '{}', false),
  ('LADY GOOZA', '{}', false),
  ('LAMBIDA DOS DEUSES', '{}', false),
  ('LUBES COCONUT', '{}', false),
  ('OLEO VELVET SKIN', '{"VELVET SKIN"}', false),
  ('ORGASTIC', '{}', false),
  ('ORGASTIC TONS', '{}', false),
  ('PIROCAO MAGICO', '{}', false),
  ('POCAO DA VIRGEM', '{}', false),
  ('POCAO VO-DA-KU', '{"VO-DA-KU","VODAKU"}', false),
  ('PPK LOUCA', '{}', false),
  ('PRANAL', '{}', false),
  ('PROLONG', '{}', false),
  ('SECRET', '{}', false),
  ('SWEET GLOW', '{}', false),
  ('TARADINHA', '{}', false),
  ('TOQUE DA VIRGEM', '{}', false),
  ('VELUDAO', '{}', false),
  ('VIBE DROPS COCONUT', '{"VIBE DROPS"}', false),
  ('VIBE SENSATION', '{}', false),
  ('VIBRATION', '{}', false),
  ('VIBRATION TONS', '{}', false),
  ('VIRGIN', '{}', false),
  ('BUBBLE VIBES', '{"BUBBLES"}', false),
  ('LINHA SUCULENTA', '{"SUCULENTA"}', false),
  ('LUBRIFICANTE', '{"LUBRIFICANTES"}', true),
  ('GEL DESLIZANTE', '{"GEL COMESTIVEL","GEIS COMESTIVEIS"}', true),
  ('DESODORANTE INTIMO', '{}', true),
  ('GEL CLITORIANO', '{}', true),
  ('CALDA', '{"CALDAS","CALDAS BEIJAVEIS"}', true),
  ('VELA', '{"VELAS"}', true),
  ('VIBRADOR', '{"VIBRADORES","BULLET"}', true),
  ('EXCITANTE', '{"EXCITANTES"}', true)
on conflict (nome) do nothing;

-- ── RPC: menções de produto por conversa (mensagens + resumo) ───────────
create or replace function public.agente_produtos_mencionados(
  p_inicio date default null,
  p_fim date default null,
  p_incluir_categorias boolean default true,
  p_limite int default 30
)
returns table (
  produto text,
  conversas bigint,
  em_mensagens bigint,
  em_resumos bigint,
  eh_categoria boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.analytics_check_acesso();

  return query
  with docs as (
    select c.conv_key,
           upper(public.unaccent(coalesce(c."Resumo", ''))) as resumo_doc,
           upper(public.unaccent(coalesce(string_agg(m.text, ' '), ''))) as msg_doc
    from public.conversations c
    left join public.inbound_messages m
      on m.conv_key = c.conv_key
     and (p_inicio is null or (m.received_at at time zone 'America/Sao_Paulo')::date >= p_inicio)
     and (p_fim is null or (m.received_at at time zone 'America/Sao_Paulo')::date <= p_fim)
    where c.phone is not null and length(c.phone) > 5
      and (p_inicio is null
           or (coalesce(c.last_message_at, c.created_at) at time zone 'America/Sao_Paulo')::date >= p_inicio)
      and (p_fim is null
           or (c.created_at at time zone 'America/Sao_Paulo')::date <= p_fim)
    group by c.conv_key, c."Resumo"
  ),
  termos as (
    select p.nome, p.categoria, '\m' || upper(public.unaccent(t.termo)) || '\M' as rx
    from public.analytics_produtos p
    cross join lateral unnest(array[p.nome] || p.aliases) as t(termo)
    where p_incluir_categorias or not p.categoria
  )
  select t.nome,
         count(distinct d.conv_key),
         count(distinct d.conv_key) filter (where d.msg_doc ~ t.rx),
         count(distinct d.conv_key) filter (where d.resumo_doc ~ t.rx),
         t.categoria
  from termos t
  join docs d on d.msg_doc ~ t.rx or d.resumo_doc ~ t.rx
  group by t.nome, t.categoria
  order by 2 desc, 1
  limit least(greatest(coalesce(p_limite, 30), 1), 200);
end;
$$;

revoke execute on function public.agente_produtos_mencionados(date, date, boolean, int) from public, anon;
grant execute on function public.agente_produtos_mencionados(date, date, boolean, int) to authenticated, service_role;
