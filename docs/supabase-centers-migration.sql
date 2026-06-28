-- Bảng cơ sở / trung tâm + cài đặt công ty
-- Chạy trên Supabase SQL Editor

create table if not exists public.centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  address text,
  phone text,
  email text,
  manager text,
  working_hours text,
  signature_url text,
  is_main boolean not null default false,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_centers_updated_at on public.centers;
create trigger trg_centers_updated_at
before update on public.centers
for each row execute function public.set_updated_at();

create index if not exists idx_centers_name on public.centers (name);
create index if not exists idx_centers_status on public.centers (status);

create table if not exists public.app_settings (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

alter table public.centers enable row level security;
alter table public.app_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'centers_anon_dev' and tablename = 'centers'
  ) then
    create policy centers_anon_dev on public.centers for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where policyname = 'app_settings_anon_dev' and tablename = 'app_settings'
  ) then
    create policy app_settings_anon_dev on public.app_settings for all to anon using (true) with check (true);
  end if;
end $$;
