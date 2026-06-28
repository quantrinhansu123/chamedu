-- ============================================================
-- Chăm edu — Gắn tài khoản Admin vào bảng staff + users
-- Chạy SAU docs/supabase-init-schema.sql
-- ============================================================
--
-- Tài khoản Auth (đã tạo bằng npm run setup:admin):
--   Email:    admin@chamedu.vn
--   Mật khẩu: Chamedu@2026
--   UID:      2823f0f1-c6a6-4560-95da-93d849830a83
--
-- Supabase Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

-- 1) Bảng staff (quyền đăng nhập app)
insert into public.staff (
  code,
  name,
  email,
  department,
  position,
  role,
  roles,
  branch,
  status,
  uid
) values (
  'ADMIN001',
  'Quản trị viên',
  'admin@chamedu.vn',
  'Văn phòng',
  'Quản trị viên',
  'Quản trị viên',
  array['Quản trị viên'],
  'Trung tâm',
  'Đang làm việc',
  '2823f0f1-c6a6-4560-95da-93d849830a83'
)
on conflict (code) do update set
  name = excluded.name,
  email = excluded.email,
  department = excluded.department,
  position = excluded.position,
  role = excluded.role,
  roles = excluded.roles,
  branch = excluded.branch,
  status = excluded.status,
  uid = excluded.uid,
  updated_at = now();

-- 2) Bảng users (profile app)
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

-- 3) Kiểm tra (tùy chọn)
select id, code, name, email, position, role, uid, status
from public.staff
where email = 'admin@chamedu.vn';

select id, email, full_name, role, status
from public.users
where email = 'admin@chamedu.vn';
