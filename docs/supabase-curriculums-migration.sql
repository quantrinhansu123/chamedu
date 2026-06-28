-- Bảng gói học / khóa học (curriculums)
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

create table if not exists public.curriculums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  description text,
  level text,
  age_range text,
  duration integer not null default 0,
  total_sessions integer not null default 0,
  session_duration integer not null default 0,
  tuition_fee numeric not null default 0,
  materials text[],
  objectives text[],
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_curriculums_updated_at on public.curriculums;
create trigger trg_curriculums_updated_at
before update on public.curriculums
for each row execute function public.set_updated_at();

create index if not exists idx_curriculums_name on public.curriculums (name);
create index if not exists idx_curriculums_status on public.curriculums (status);

alter table public.curriculums enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'curriculums_anon_dev' and tablename = 'curriculums'
  ) then
    create policy curriculums_anon_dev on public.curriculums for all to anon using (true) with check (true);
  end if;
end $$;

-- Cấu hình loại chương trình (dùng app_settings, bảng có thể đã tồn tại từ centers migration)
insert into public.app_settings (id, value)
values (
  'program_types',
  '{"types":["Tiếng Anh Trẻ Em","Tiếng Anh Giao Tiếp","Tiếng Anh Học Thuật","IELTS","TOEIC","Khác"]}'::jsonb
)
on conflict (id) do nothing;
