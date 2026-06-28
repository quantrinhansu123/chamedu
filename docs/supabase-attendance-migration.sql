-- Bảng điểm danh (attendance + student_attendance)
-- Chạy trên Supabase SQL Editor

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  class_name text not null,
  date date not null,
  session_number integer,
  session_id uuid,
  total_students integer not null default 0,
  present integer not null default 0,
  absent integer not null default 0,
  reserved integer not null default 0,
  tutored integer not null default 0,
  status text not null default 'Chưa điểm danh',
  holiday_id text,
  holiday_name text,
  attendance_type text check (attendance_type in ('session', 'makeup', 'manual')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_attendance_updated_at on public.attendance;
create trigger trg_attendance_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();

create index if not exists idx_attendance_class_date on public.attendance (class_id, date desc);
create index if not exists idx_attendance_session_id on public.attendance (session_id);
create index if not exists idx_attendance_date on public.attendance (date desc);

create table if not exists public.student_attendance (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid references public.attendance(id) on delete cascade,
  session_id uuid,
  student_id uuid not null,
  student_name text not null,
  student_code text,
  class_id uuid,
  class_name text,
  date date,
  session_number integer,
  status text not null default '',
  note text,
  attitude_comment text,
  attention_card text,
  homework_completion integer,
  test_name text,
  score numeric,
  bonus_points integer,
  punctuality text,
  is_late boolean,
  attendance_type text check (attendance_type in ('session', 'makeup', 'manual')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_student_attendance_updated_at on public.student_attendance;
create trigger trg_student_attendance_updated_at
before update on public.student_attendance
for each row execute function public.set_updated_at();

create index if not exists idx_student_attendance_attendance_id on public.student_attendance (attendance_id);
create index if not exists idx_student_attendance_session_id on public.student_attendance (session_id);
create index if not exists idx_student_attendance_class_date on public.student_attendance (class_id, date);
create index if not exists idx_student_attendance_student_class on public.student_attendance (student_id, class_id);

create table if not exists public.tutoring (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  student_name text not null,
  class_id uuid,
  class_name text,
  absent_date date,
  type text,
  status text not null default 'Đã hẹn',
  scheduled_date date,
  scheduled_time text,
  tutor text,
  student_attendance_id uuid,
  note text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_tutoring_updated_at on public.tutoring;
create trigger trg_tutoring_updated_at
before update on public.tutoring
for each row execute function public.set_updated_at();

create index if not exists idx_tutoring_student_id on public.tutoring (student_id);
create index if not exists idx_tutoring_class_id on public.tutoring (class_id);

alter table public.attendance enable row level security;
alter table public.student_attendance enable row level security;
alter table public.tutoring enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'attendance_anon_dev' and tablename = 'attendance'
  ) then
    create policy attendance_anon_dev on public.attendance for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where policyname = 'student_attendance_anon_dev' and tablename = 'student_attendance'
  ) then
    create policy student_attendance_anon_dev on public.student_attendance for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where policyname = 'tutoring_anon_dev' and tablename = 'tutoring'
  ) then
    create policy tutoring_anon_dev on public.tutoring for all to anon using (true) with check (true);
  end if;
end $$;

-- Nếu bảng đã tạo trước đó, chạy thêm:
-- alter table public.student_attendance add column if not exists attitude_comment text;
-- alter table public.student_attendance add column if not exists attention_card text;
