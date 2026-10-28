-- =====================================================================
-- ATUALIZAÇÃO 04 — Permissões por link de visualização
--   • Telas liberadas: Painel, Internados, Analytics
--   • Mostrar prontuário e iniciais do paciente (sim/não)
--   • Mostrar nome dos médicos (sim/não)
-- Rode UMA vez no Supabase: SQL Editor > New query > cole > Run
-- (pode rodar de novo sem problema)
-- =====================================================================

-- 1) Colunas de permissão.
--    Links que já existem ficam como eram: todas as telas, SEM prontuário/iniciais.
--    Links novos: tudo liberado (pode ser ajustado na criação ou depois).
alter table public.view_links add column if not exists abas text[] not null default '{painel,internados,analytics}';
alter table public.view_links add column if not exists mostrar_identificacao boolean not null default false;
alter table public.view_links alter column mostrar_identificacao set default true;
alter table public.view_links add column if not exists mostrar_medicos boolean not null default true;

alter table public.view_links drop constraint if exists view_links_abas_validas;
alter table public.view_links add constraint view_links_abas_validas
  check (cardinality(abas) > 0 and abas <@ array['painel','internados','analytics']::text[]);

-- 2) A função do link respeita as permissões: o que estiver desligado não sai do banco.
create or replace function public.view_dados(p_token text, p_de date, p_ate date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.view_links;
  r jsonb;
begin
  select * into v from public.view_links
   where token = p_token and ativo and (expires_at is null or expires_at > now());
  if not found then
    raise exception 'link_invalido';
  end if;
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 800 then
    raise exception 'periodo_invalido';
  end if;

  update public.view_links set ultimo_acesso = now() where id = v.id;

  select jsonb_build_object(
    'link', jsonb_build_object(
      'nome', v.nome, 'expires_at', v.expires_at, 'abas', to_jsonb(v.abas),
      'mostrar_identificacao', v.mostrar_identificacao, 'mostrar_medicos', v.mostrar_medicos),
    'config', coalesce((select c.dados from public.config c where c.id = 1), '{}'::jsonb),
    'parametros', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'tipo', p.tipo, 'nome', p.nome, 'cor', p.cor, 'ordem', p.ordem, 'ativo', p.ativo)
                       order by p.tipo, p.ordem)
      from public.parametros p), '[]'::jsonb),
    'medicos', case when v.mostrar_medicos then coalesce((
      select jsonb_agg(jsonb_build_object('id', pr.id, 'nome', pr.nome, 'role', pr.role, 'ativo', pr.ativo) order by pr.nome)
      from public.profiles pr where pr.role = 'medico' and pr.ativo), '[]'::jsonb) else '[]'::jsonb end,
    'atendimentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'data_atendimento', a.data_atendimento,
        'data_desfecho', a.data_desfecho,
        'risco', a.risco,
        'setor', a.setor,
        'especialidades', a.especialidades,
        'exames_grupos', a.exames_grupos,
        'medicacoes_classes', a.medicacoes_classes,
        'cid', a.cid,
        'desfecho', a.desfecho,
        'idade', case when a.data_nascimento is null then null
                      else extract(year from age(a.data_atendimento, a.data_nascimento))::int end,
        'prontuario', case when v.mostrar_identificacao then a.prontuario end,
        'iniciais',   case when v.mostrar_identificacao then a.iniciais end,
        'medico_id',   case when v.mostrar_medicos then a.medico_id end,
        'medico_nome', case when v.mostrar_medicos then a.medico_nome end,
        'created_at', a.created_at))
      from public.atendimentos a
      where a.data_atendimento <= p_ate
        and (a.data_desfecho is null or a.data_desfecho >= p_de)), '[]'::jsonb)
  ) into r;

  return r;
end $$;

revoke all on function public.view_dados(text, date, date) from public;
grant execute on function public.view_dados(text, date, date) to anon, authenticated;

notify pgrst, 'reload schema';

-- Conferência: permissões de cada link
select nome, abas, mostrar_identificacao, mostrar_medicos, ativo from public.view_links order by created_at desc;
