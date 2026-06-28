-- Homework materials / assignment schema for EduManager Pro
-- Run this file in Supabase SQL Editor.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- learning_grade_bands
-- Khối: Tiểu học / THCS / THPT
-- =========================
create table if not exists public.learning_grade_bands (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_learning_grade_bands_updated_at on public.learning_grade_bands;
create trigger trg_learning_grade_bands_updated_at
before update on public.learning_grade_bands
for each row execute function public.set_updated_at();

-- =========================
-- learning_grades
-- Lớp 1..12
-- =========================
create table if not exists public.learning_grades (
  id uuid primary key default gen_random_uuid(),
  grade_band_id uuid not null references public.learning_grade_bands(id) on delete cascade,
  grade_number integer not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grade_band_id, grade_number)
);

drop trigger if exists trg_learning_grades_updated_at on public.learning_grades;
create trigger trg_learning_grades_updated_at
before update on public.learning_grades
for each row execute function public.set_updated_at();

create index if not exists idx_learning_grades_band on public.learning_grades(grade_band_id);

-- =========================
-- learning_class_groups
-- Lớp học mẫu trong cây học liệu: A/B/C...
-- Có thể map sang classes thật bằng class_id khi cần.
-- =========================
create table if not exists public.learning_class_groups (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.learning_grades(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  code text not null,
  name text not null,
  teacher_name text,
  student_count integer not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grade_id, code)
);

drop trigger if exists trg_learning_class_groups_updated_at on public.learning_class_groups;
create trigger trg_learning_class_groups_updated_at
before update on public.learning_class_groups
for each row execute function public.set_updated_at();

create index if not exists idx_learning_class_groups_grade on public.learning_class_groups(grade_id);
create index if not exists idx_learning_class_groups_class on public.learning_class_groups(class_id);

-- =========================
-- learning_exercise_types
-- Dạng bài / học liệu có thể giao
-- =========================
create table if not exists public.learning_exercise_types (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.learning_grades(id) on delete cascade,
  code text not null,
  title text not null,
  subject text,
  difficulty text not null default 'Cơ bản',
  exercise_count integer not null default 0,
  description text,
  tags text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grade_id, code)
);

drop trigger if exists trg_learning_exercise_types_updated_at on public.learning_exercise_types;
create trigger trg_learning_exercise_types_updated_at
before update on public.learning_exercise_types
for each row execute function public.set_updated_at();

create index if not exists idx_learning_exercise_types_grade on public.learning_exercise_types(grade_id);
create index if not exists idx_learning_exercise_types_subject on public.learning_exercise_types(subject);
create index if not exists idx_learning_exercise_types_tags on public.learning_exercise_types using gin(tags);

-- =========================
-- learning_materials
-- File/link/nội dung cụ thể thuộc một dạng bài
-- =========================
create table if not exists public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  exercise_type_id uuid not null references public.learning_exercise_types(id) on delete cascade,
  title text not null,
  content_type text not null default 'worksheet',
  file_url text,
  external_url text,
  thumbnail_url text,
  estimated_minutes integer,
  question_count integer,
  answer_key jsonb,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_learning_materials_updated_at on public.learning_materials;
create trigger trg_learning_materials_updated_at
before update on public.learning_materials
for each row execute function public.set_updated_at();

create index if not exists idx_learning_materials_exercise_type on public.learning_materials(exercise_type_id);
create index if not exists idx_learning_materials_active on public.learning_materials(is_active);

-- =========================
-- learning_assignments
-- Lịch sử giao học liệu/bài tập
-- =========================
create table if not exists public.learning_assignments (
  id uuid primary key default gen_random_uuid(),
  exercise_type_id uuid references public.learning_exercise_types(id) on delete set null,
  material_id uuid references public.learning_materials(id) on delete set null,
  class_group_id uuid references public.learning_class_groups(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  class_name text,
  target_name text,
  assigned_count integer,
  due_date date,
  status text not null default 'Đã giao',
  assigned_by uuid references public.staff(id) on delete set null,
  assigned_by_name text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_learning_assignments_updated_at on public.learning_assignments;
create trigger trg_learning_assignments_updated_at
before update on public.learning_assignments
for each row execute function public.set_updated_at();

create index if not exists idx_learning_assignments_class on public.learning_assignments(class_id);
create index if not exists idx_learning_assignments_class_group on public.learning_assignments(class_group_id);
create index if not exists idx_learning_assignments_due_date on public.learning_assignments(due_date);
create index if not exists idx_learning_assignments_created_at on public.learning_assignments(created_at desc);

-- =========================
-- Seed default tree from current Học liệu prototype
-- =========================
insert into public.learning_grade_bands (code, name, description, sort_order)
values
  ('th', 'Khối Tiểu học', 'Lớp 1 - 5', 1),
  ('thcs', 'Khối THCS', 'Lớp 6 - 9', 2),
  ('thpt', 'Khối THPT', 'Lớp 10 - 12', 3)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.learning_grades (grade_band_id, grade_number, name, sort_order)
select b.id, g.grade_number, 'Lớp ' || g.grade_number, g.grade_number
from public.learning_grade_bands b
join (
  values
    ('th', 1), ('th', 2), ('th', 3), ('th', 4), ('th', 5),
    ('thcs', 6), ('thcs', 7), ('thcs', 8), ('thcs', 9),
    ('thpt', 10), ('thpt', 11), ('thpt', 12)
) as g(band_code, grade_number) on g.band_code = b.code
on conflict (grade_band_id, grade_number) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into public.learning_class_groups (grade_id, code, name, teacher_name, student_count, sort_order)
select g.id, section.code, 'Lớp ' || g.grade_number || section.code, section.teacher_name, section.student_count, section.sort_order
from public.learning_grades g
cross join (
  values
    ('A', 'Cô Nguyễn Thu Hà', 18, 1),
    ('B', 'Thầy Trần Văn Bình', 20, 2),
    ('C', 'Cô Lê Minh Châu', 16, 3)
) as section(code, teacher_name, student_count, sort_order)
on conflict (grade_id, code) do update set
  name = excluded.name,
  teacher_name = excluded.teacher_name,
  student_count = excluded.student_count,
  sort_order = excluded.sort_order;

with exercise_seed(band_code, title, difficulty, exercise_count, sort_order) as (
  values
    ('th', 'Phép cộng trong phạm vi 10', 'Cơ bản', 12, 1),
    ('th', 'Phép trừ trong phạm vi 10', 'Cơ bản', 8, 2),
    ('th', 'So sánh số', 'Vận dụng', 15, 3),
    ('th', 'Nhận biết hình học', 'Cơ bản', 6, 4),
    ('th', 'Bài toán có lời văn', 'Nâng cao', 10, 5),
    ('th', 'Đếm và viết số', 'Cơ bản', 9, 6),
    ('thcs', 'Số nguyên & phân số', 'Cơ bản', 12, 1),
    ('thcs', 'Phương trình bậc nhất', 'Vận dụng', 8, 2),
    ('thcs', 'Hình học phẳng', 'Vận dụng', 15, 3),
    ('thcs', 'Tỉ lệ thức', 'Cơ bản', 6, 4),
    ('thcs', 'Biểu thức đại số', 'Nâng cao', 10, 5),
    ('thcs', 'Thống kê & xác suất', 'Cơ bản', 9, 6),
    ('thpt', 'Hàm số & đồ thị', 'Cơ bản', 12, 1),
    ('thpt', 'Đạo hàm & ứng dụng', 'Vận dụng', 8, 2),
    ('thpt', 'Nguyên hàm - Tích phân', 'Nâng cao', 15, 3),
    ('thpt', 'Hình học không gian', 'Vận dụng', 6, 4),
    ('thpt', 'Tổ hợp - Xác suất', 'Cơ bản', 10, 5),
    ('thpt', 'Lượng giác', 'Cơ bản', 9, 6)
)
insert into public.learning_exercise_types (grade_id, code, title, subject, difficulty, exercise_count, sort_order)
select
  g.id,
  lower(regexp_replace(unaccent(es.title), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || g.grade_number,
  es.title,
  'Toán',
  es.difficulty,
  es.exercise_count,
  es.sort_order
from public.learning_grades g
join public.learning_grade_bands b on b.id = g.grade_band_id
join exercise_seed es on es.band_code = b.code
on conflict (grade_id, code) do update set
  title = excluded.title,
  subject = excluded.subject,
  difficulty = excluded.difficulty,
  exercise_count = excluded.exercise_count,
  sort_order = excluded.sort_order;

-- Public anon access for the current client-side app.
-- Tighten these policies later when Supabase Auth is fully wired.
alter table public.learning_grade_bands enable row level security;
alter table public.learning_grades enable row level security;
alter table public.learning_class_groups enable row level security;
alter table public.learning_exercise_types enable row level security;
alter table public.learning_materials enable row level security;
alter table public.learning_assignments enable row level security;

drop policy if exists "learning_grade_bands_select_all" on public.learning_grade_bands;
create policy "learning_grade_bands_select_all" on public.learning_grade_bands for select using (true);
drop policy if exists "learning_grade_bands_insert_all" on public.learning_grade_bands;
create policy "learning_grade_bands_insert_all" on public.learning_grade_bands for insert with check (true);
drop policy if exists "learning_grade_bands_update_all" on public.learning_grade_bands;
create policy "learning_grade_bands_update_all" on public.learning_grade_bands for update using (true) with check (true);
drop policy if exists "learning_grade_bands_delete_all" on public.learning_grade_bands;
create policy "learning_grade_bands_delete_all" on public.learning_grade_bands for delete using (true);

drop policy if exists "learning_grades_select_all" on public.learning_grades;
create policy "learning_grades_select_all" on public.learning_grades for select using (true);
drop policy if exists "learning_grades_insert_all" on public.learning_grades;
create policy "learning_grades_insert_all" on public.learning_grades for insert with check (true);
drop policy if exists "learning_grades_update_all" on public.learning_grades;
create policy "learning_grades_update_all" on public.learning_grades for update using (true) with check (true);
drop policy if exists "learning_grades_delete_all" on public.learning_grades;
create policy "learning_grades_delete_all" on public.learning_grades for delete using (true);

drop policy if exists "learning_class_groups_select_all" on public.learning_class_groups;
create policy "learning_class_groups_select_all" on public.learning_class_groups for select using (true);
drop policy if exists "learning_class_groups_insert_all" on public.learning_class_groups;
create policy "learning_class_groups_insert_all" on public.learning_class_groups for insert with check (true);
drop policy if exists "learning_class_groups_update_all" on public.learning_class_groups;
create policy "learning_class_groups_update_all" on public.learning_class_groups for update using (true) with check (true);
drop policy if exists "learning_class_groups_delete_all" on public.learning_class_groups;
create policy "learning_class_groups_delete_all" on public.learning_class_groups for delete using (true);

drop policy if exists "learning_exercise_types_select_all" on public.learning_exercise_types;
create policy "learning_exercise_types_select_all" on public.learning_exercise_types for select using (true);
drop policy if exists "learning_exercise_types_insert_all" on public.learning_exercise_types;
create policy "learning_exercise_types_insert_all" on public.learning_exercise_types for insert with check (true);
drop policy if exists "learning_exercise_types_update_all" on public.learning_exercise_types;
create policy "learning_exercise_types_update_all" on public.learning_exercise_types for update using (true) with check (true);
drop policy if exists "learning_exercise_types_delete_all" on public.learning_exercise_types;
create policy "learning_exercise_types_delete_all" on public.learning_exercise_types for delete using (true);

drop policy if exists "learning_materials_select_all" on public.learning_materials;
create policy "learning_materials_select_all" on public.learning_materials for select using (true);
drop policy if exists "learning_materials_insert_all" on public.learning_materials;
create policy "learning_materials_insert_all" on public.learning_materials for insert with check (true);
drop policy if exists "learning_materials_update_all" on public.learning_materials;
create policy "learning_materials_update_all" on public.learning_materials for update using (true) with check (true);
drop policy if exists "learning_materials_delete_all" on public.learning_materials;
create policy "learning_materials_delete_all" on public.learning_materials for delete using (true);

drop policy if exists "learning_assignments_select_all" on public.learning_assignments;
create policy "learning_assignments_select_all" on public.learning_assignments for select using (true);

drop policy if exists "learning_assignments_insert_all" on public.learning_assignments;
create policy "learning_assignments_insert_all" on public.learning_assignments for insert with check (true);

drop policy if exists "learning_assignments_update_all" on public.learning_assignments;
create policy "learning_assignments_update_all" on public.learning_assignments for update using (true) with check (true);
drop policy if exists "learning_assignments_delete_all" on public.learning_assignments;
create policy "learning_assignments_delete_all" on public.learning_assignments for delete using (true);
