-- =====================================================================
-- Checklist Médico · Hospital Cirúrgico de Camboriú (Phoenix)
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run
-- =====================================================================

-- ---------- Perfis (1:1 com auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text,
  crm text,
  role text not null default 'medico' check (role in ('admin', 'medico')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Cria o perfil automaticamente quando um usuário é criado (sempre como 'medico')
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), new.email, 'medico')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: usuário atual é admin ativo?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and ativo);
$$;

create or replace function public.is_ativo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and ativo);
$$;

-- ---------- Parâmetros (listas de seleção) ----------
create table if not exists public.parametros (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('risco', 'setor', 'especialidade', 'exame', 'medicacao', 'desfecho')),
  nome text not null,
  cor text,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tipo, nome)
);

-- ---------- Configuração geral (linha única) ----------
create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  dados jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Atendimentos (colunas da planilha) ----------
create table if not exists public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  prontuario text,
  iniciais text,
  data_nascimento date,
  data_atendimento date not null default current_date,
  risco text,
  setor text,
  especialidades text[] not null default '{}',
  cid text,
  exames_grupos text[] not null default '{}',
  exames text,
  medicacoes_classes text[] not null default '{}',
  medicacoes text,
  desfecho text,
  observacoes text,
  medico_id uuid not null default auth.uid() references public.profiles(id),
  medico_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists atendimentos_data_idx on public.atendimentos (data_atendimento desc);
create index if not exists atendimentos_medico_idx on public.atendimentos (medico_id, data_atendimento desc);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.parametros enable row level security;
alter table public.config enable row level security;
alter table public.atendimentos enable row level security;

drop policy if exists "perfil: ler o próprio ou admin" on public.profiles;
create policy "perfil: ler o próprio ou admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists "perfil: admin altera" on public.profiles;
create policy "perfil: admin altera" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "parametros: logados leem" on public.parametros;
create policy "parametros: logados leem" on public.parametros
  for select using (public.is_ativo());
drop policy if exists "parametros: admin gerencia" on public.parametros;
create policy "parametros: admin gerencia" on public.parametros
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "config: logados leem" on public.config;
create policy "config: logados leem" on public.config
  for select using (public.is_ativo());
drop policy if exists "config: admin gerencia" on public.config;
create policy "config: admin gerencia" on public.config
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "atd: médico lê os seus, admin lê todos" on public.atendimentos;
create policy "atd: médico lê os seus, admin lê todos" on public.atendimentos
  for select using ((medico_id = auth.uid() and public.is_ativo()) or public.is_admin());
drop policy if exists "atd: médico insere em seu nome" on public.atendimentos;
create policy "atd: médico insere em seu nome" on public.atendimentos
  for insert with check (medico_id = auth.uid() and public.is_ativo());
drop policy if exists "atd: médico edita os seus, admin edita todos" on public.atendimentos;
create policy "atd: médico edita os seus, admin edita todos" on public.atendimentos
  for update using ((medico_id = auth.uid() and public.is_ativo()) or public.is_admin())
  with check ((medico_id = auth.uid() and public.is_ativo()) or public.is_admin());
drop policy if exists "atd: admin exclui" on public.atendimentos;
create policy "atd: admin exclui" on public.atendimentos
  for delete using (public.is_admin());

-- ---------- Dados iniciais (listas da planilha) ----------
insert into public.parametros (tipo, nome, cor, ordem) values
  ('risco', 'Vermelho – Emergência', '#D92D20', 0),
  ('risco', 'Laranja – Muito urgente', '#F2730C', 1),
  ('risco', 'Amarelo – Urgente', '#E3B008', 2),
  ('risco', 'Verde – Pouco urgente', '#16A34A', 3),
  ('risco', 'Azul – Não urgente', '#2563EB', 4),
  ('setor', 'Observação', null, 0),
  ('setor', 'Internação', null, 1),
  ('especialidade', 'Infectologia', null, 0),
  ('especialidade', 'Cardiologia', null, 1),
  ('especialidade', 'Urologia', null, 2),
  ('especialidade', 'Ginecologia e Obstetrícia', null, 3),
  ('especialidade', 'Cirurgia Geral', null, 4),
  ('especialidade', 'Neurologia', null, 5),
  ('especialidade', 'Ortopedia', null, 6),
  ('especialidade', 'Cirurgia Vascular', null, 7),
  ('desfecho', 'Alta a pedido', null, 0),
  ('desfecho', 'Evasão', null, 1),
  ('desfecho', 'Alta médica', null, 2),
  ('desfecho', 'Transferência', null, 3),
  ('desfecho', 'Internação', null, 4),
  ('exame', 'Exames Laboratoriais', null, 0),
  ('exame', 'RX', null, 1),
  ('exame', 'TC', null, 2),
  ('exame', 'USG', null, 3),
  ('exame', 'ECG', null, 4),
  ('medicacao', 'Analgésicos e antitérmicos', null, 0),
  ('medicacao', 'Anti-inflamatórios não esteroides (AINEs)', null, 1),
  ('medicacao', 'Opioides', null, 2),
  ('medicacao', 'Antimicrobianos', null, 3),
  ('medicacao', 'Corticosteroides', null, 4),
  ('medicacao', 'Antialérgicos / anti-histamínicos', null, 5),
  ('medicacao', 'Broncodilatadores', null, 6),
  ('medicacao', 'Antieméticos', null, 7),
  ('medicacao', 'Antiespasmódicos', null, 8),
  ('medicacao', 'Medicamentos para doenças relacionadas à acidez', null, 9),
  ('medicacao', 'Laxantes', null, 10),
  ('medicacao', 'Anti-hipertensivos e vasodilatadores', null, 11),
  ('medicacao', 'Diuréticos', null, 12),
  ('medicacao', 'Antiarrítmicos', null, 13),
  ('medicacao', 'Vasopressores e inotrópicos', null, 14),
  ('medicacao', 'Antiagregantes plaquetários', null, 15),
  ('medicacao', 'Anticoagulantes', null, 16),
  ('medicacao', 'Fibrinolíticos', null, 17),
  ('medicacao', 'Hemostáticos e antifibrinolíticos', null, 18),
  ('medicacao', 'Anticonvulsivantes', null, 19),
  ('medicacao', 'Sedativos e ansiolíticos', null, 20),
  ('medicacao', 'Anestésicos', null, 21),
  ('medicacao', 'Bloqueadores neuromusculares', null, 22),
  ('medicacao', 'Antipsicóticos', null, 23),
  ('medicacao', 'Insulinas e medicamentos para hipoglicemia', null, 24),
  ('medicacao', 'Soluções intravenosas e eletrólitos', null, 25)
on conflict (tipo, nome) do nothing;

insert into public.config (id, dados) values (1, '{"hospital":"Hospital Cirúrgico de Camboriú","empresa":"Phoenix Serviços Médicos"}')
on conflict (id) do nothing;

-- =====================================================================
-- PRIMEIRO ADMINISTRADOR
-- 1) Supabase > Authentication > Users > Add user (marque "Auto Confirm User")
-- 2) Rode o comando abaixo trocando o e-mail:
--    update public.profiles set role = 'admin', nome = 'Coordenação Médica'
--    where email = 'seu.email@empresa.com.br';
-- =====================================================================
