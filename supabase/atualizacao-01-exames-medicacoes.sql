-- =====================================================================
-- ATUALIZAÇÃO 01 — Famílias de exames e classes de medicação
-- Rode UMA vez no Supabase: SQL Editor > New query > cole > Run
-- (pode rodar de novo sem problema: não duplica nada)
-- =====================================================================

-- 1) Novas colunas nos atendimentos (listas de seleção múltipla)
alter table public.atendimentos add column if not exists exames_grupos text[] not null default '{}';
alter table public.atendimentos add column if not exists medicacoes_classes text[] not null default '{}';

-- 2) Permitir os novos tipos de parâmetro
alter table public.parametros drop constraint if exists parametros_tipo_check;
alter table public.parametros add constraint parametros_tipo_check
  check (tipo in ('risco', 'setor', 'especialidade', 'exame', 'medicacao', 'desfecho'));

-- 3) Listas iniciais (editáveis depois em Parâmetros)
insert into public.parametros (tipo, nome, cor, ordem) values
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

-- Conferência: deve mostrar exame = 5 e medicacao = 26
select tipo, count(*) from public.parametros group by tipo order by tipo;
