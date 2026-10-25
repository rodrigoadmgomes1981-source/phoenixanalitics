-- =====================================================================
-- ATUALIZAÇÃO 02 — Links de visualização (somente Painel e Analytics)
-- Rode UMA vez no Supabase: SQL Editor > New query > cole > Run
-- (pode rodar de novo sem problema)
-- =====================================================================

-- 1) Tabela de links (só administradores gerenciam)
create table if not exists public.view_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  nome text not null,
  ativo boolean not null default true,
  expires_at timestamptz,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  ultimo_acesso timestamptz
);

alter table public.view_links enable row level security;
drop policy if exists "links: admin gerencia" on public.view_links;
create policy "links: admin gerencia" on public.view_links
  for all using (public.is_admin()) with check (public.is_admin());

-- 2) Função pública que devolve SOMENTE os dados agregáveis do painel.
--    Não expõe prontuário, iniciais, data de nascimento (só a idade) nem observações.
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
      where a.data_atendimento between p_de and p_ate), '[]'::jsonb)
  ) into r;

  return r;
end $$;

revoke all on function public.view_dados(text, date, date) from public;
grant execute on function public.view_dados(text, date, date) to anon, authenticated;

-- Conferência: deve listar a tabela view_links e a função view_dados
select 'view_links' as objeto, count(*) from public.view_links
union all
select 'view_dados', count(*) from pg_proc where proname = 'view_dados';
