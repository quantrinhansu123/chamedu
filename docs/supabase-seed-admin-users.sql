-- Đổ admin vào bảng users (có cột password)
-- Chạy SAU: supabase-init-schema.sql HOẶC supabase-users-auth-migration.sql

insert into public.users (
  id,
  email,
  password,
  full_name,
  role,
  status,
  branch
) values (
  '2823f0f1-c6a6-4560-95da-93d849830a83',
  'admin@chamedu.vn',
  'Chamedu@2026',
  'Quản trị viên',
  'Quản trị viên',
  'active',
  'Trung tâm'
)
on conflict (id) do update set
  email = excluded.email,
  password = excluded.password,
  full_name = excluded.full_name,
  role = excluded.role,
  status = excluded.status,
  branch = excluded.branch,
  updated_at = now();

select id, email, full_name, role, status, branch
from public.users
where email = 'admin@chamedu.vn';
