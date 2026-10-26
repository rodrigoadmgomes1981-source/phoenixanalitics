-- =====================================================================
-- ATUALIZAÇÃO 03 — Paciente fica no sistema até a alta (permanência)
-- Rode UMA vez no Supabase: SQL Editor > New query > cole > Run
-- (pode rodar de novo sem problema)
-- =====================================================================

-- 1) Data da alta e quem registrou
alter table public.atendimentos add column if not exists data_desfecho date;
alter table public.atendimentos add column if not exists alta_por_id uuid references public.profiles(id) on delete set null;
alter table public.atendimentos add column if not exists alta_por_nome text;

-- Registros antigos que já tinham desfecho: alta no mesmo dia da entrada
update public.atendimentos set data_desfecho = data_atendimento
 where desfecho is not null and data_desfecho is null;

alter table public.atendimentos drop constraint if exists atendimentos_alta_valida;
alter table public.atendimentos add constraint atendimentos_alta_valida
  check (data_desfecho is null or data_desfecho >= data_atendimento);

create index if not exists atendimentos_internados_idx on public.atendimentos (data_atendimento) where desfecho is null;
create index if not exists atendimentos_alta_idx on public.atendimentos (data_desfecho);

-- 2) Permissões: o paciente é da unidade, não do médico que incluiu.
--    Todo médico ativo vê e atualiza os pacientes (para dar alta no plantão seguinte).
--    Incluir continua sendo sempre em nome de quem está logado; excluir, só admin.
drop policy if exists "atd: médico lê os seus, admin lê todos" on public.atendimentos;
drop policy if exists "atd: médico edita os seus, admin edita todos" on public.atendimentos;
drop policy if exists "atd: equipe ativa lê" on public.atendimentos;
drop policy if exists "atd: equipe ativa atualiza" on public.atendimentos;
create policy "atd: equipe ativa lê" on public.atendimentos
  for select using (public.is_ativo());
create policy "atd: equipe ativa atualiza" on public.atendimentos
  for update using (public.is_ativo()) with check (public.is_ativo());

-- 3) Link de visualização: devolve quem esteve internado em algum dia do período
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
    'link', jsonb_build_object('nome', v.nome, 'expires_at', v.expires_at),
    'config', coalesce((select c.dados from public.config c where c.id = 1), '{}'::jsonb),
    'parametros', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'tipo', p.tipo, 'nome', p.nome, 'cor', p.cor, 'ordem', p.ordem, 'ativo', p.ativo)
                       order by p.tipo, p.ordem)
      from public.parametros p), '[]'::jsonb),
    'medicos', coalesce((
      select jsonb_agg(jsonb_build_object('id', pr.id, 'nome', pr.nome, 'role', pr.role, 'ativo', pr.ativo) order by pr.nome)
      from public.profiles pr where pr.role = 'medico' and pr.ativo), '[]'::jsonb),
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
        'medico_id', a.medico_id,
        'medico_nome', a.medico_nome,
        'created_at', a.created_at))
      from public.atendimentos a
      where a.data_atendimento <= p_ate
        and (a.data_desfecho is null or a.data_desfecho >= p_de)), '[]'::jsonb)
  ) into r;

  return r;
end $$;

revoke all on function public.view_dados(text, date, date) from public;
grant execute on function public.view_dados(text, date, date) to anon, authenticated;

-- Faz a API do Supabase enxergar as mudanças na hora
notify pgrst, 'reload schema';

-- Conferência: internados agora x registros com alta
select count(*) filter (where desfecho is null) as internados_agora,
       count(*) filter (where desfecho is not null) as com_alta
  from public.atendimentos;
