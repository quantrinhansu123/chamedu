-- Auth: bảng users + RPC đăng nhập (chạy trong Supabase SQL Editor)

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password text not null,
  full_name text,
  role text,
  status text not null default 'active',
  branch text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_lower_idx on public.users (lower(email));

-- RPC: xác thực email + mật khẩu (plain text — chỉ dùng nội bộ, không lộ bảng users)
create or replace function public.authenticate_user(p_email text, p_password text)
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  status text,
  branch text
)
language sql
security definer
set search_path = public
as $$
  select u.id, u.email, u.full_name, u.role, u.status, u.branch
  from public.users u
  where lower(trim(u.email)) = lower(trim(p_email))
    and u.password = p_password
    and coalesce(u.status, 'active') = 'active'
  limit 1;
$$;

create or replace function public.change_user_password(
  p_user_id uuid,
  p_current_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.users
    where id = p_user_id and password = p_current_password
  ) then
    return false;
  end if;

  update public.users
  set password = p_new_password, updated_at = now()
  where id = p_user_id;

  return true;
end;
$$;

revoke all on function public.authenticate_user(text, text) from public;
grant execute on function public.authenticate_user(text, text) to anon, authenticated;

revoke all on function public.change_user_password(uuid, text, text) from public;
grant execute on function public.change_user_password(uuid, text, text) to anon, authenticated;

alter table public.users enable row level security;

-- Không cho client đọc/ghi trực tiếp bảng users (chỉ qua RPC + service role)
drop policy if exists users_no_anon on public.users;
create policy users_no_anon on public.users
  for all to anon, authenticated
  using (false)
  with check (false);
