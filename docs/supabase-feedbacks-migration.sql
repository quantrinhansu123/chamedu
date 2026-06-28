-- Bảng phản hồi phụ huynh (gọi điện + form khảo sát)
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

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  type text not null check (type in ('Call', 'Form')),
  student_id uuid,
  student_name text not null,
  class_id uuid,
  class_name text not null default '',
  teacher text,
  teacher_score numeric,
  curriculum_score numeric,
  care_score numeric,
  facilities_score numeric,
  average_score numeric,
  caller text,
  content text,
  status text not null default 'Cần gọi',
  parent_id uuid,
  parent_name text,
  parent_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_feedbacks_updated_at on public.feedbacks;
create trigger trg_feedbacks_updated_at
before update on public.feedbacks
for each row execute function public.set_updated_at();

create index if not exists idx_feedbacks_date on public.feedbacks (date desc);
create index if not exists idx_feedbacks_type on public.feedbacks (type);
create index if not exists idx_feedbacks_status on public.feedbacks (status);
create index if not exists idx_feedbacks_student_id on public.feedbacks (student_id);

alter table public.feedbacks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'feedbacks_anon_dev' and tablename = 'feedbacks'
  ) then
    create policy feedbacks_anon_dev on public.feedbacks for all to anon using (true) with check (true);
  end if;
end $$;
