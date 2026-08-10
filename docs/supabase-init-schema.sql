  -- Supabase bootstrap schema for EduManager Pro
  -- Run in Supabase SQL Editor (new project) in order.

  create extension if not exists pgcrypto;

  -- =========================
  -- Common trigger: updated_at
  -- =========================
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
  -- Enums
  -- =========================
  do $$
  begin
    if not exists (select 1 from pg_type where typname = 'class_status') then
      create type public.class_status as enum ('Đang học', 'Tạm dừng', 'Kết thúc', 'Chờ mở');
    end if;

    if not exists (select 1 from pg_type where typname = 'contract_status') then
      create type public.contract_status as enum ('Lưu nháp', 'Chờ thanh toán', 'Đã thanh toán', 'Nợ hợp đồng', 'Đã hủy');
    end if;

    if not exists (select 1 from pg_type where typname = 'contract_type') then
      create type public.contract_type as enum ('Học viên', 'Học liệu');
    end if;

    if not exists (select 1 from pg_type where typname = 'payment_method') then
      create type public.payment_method as enum ('Toàn bộ', 'Trả góp', 'Chuyển khoản', 'Tiền mặt');
    end if;
  end $$;

  -- =========================
  -- staff
  -- =========================
  create table if not exists public.staff (
    id uuid primary key default gen_random_uuid(),
    code text unique,
    name text not null,
    phone text,
    email text,
    dob date,
    address text,
    department text,
    position text,
    role text,
    roles text[] default '{}',
    branch text,
    status text default 'Đang làm việc',
    start_date date,
    uid text,
    plain_password text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  drop trigger if exists trg_staff_updated_at on public.staff;
  create trigger trg_staff_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

  create index if not exists idx_staff_name on public.staff (name);
  create index if not exists idx_staff_branch on public.staff (branch);
  create index if not exists idx_staff_status on public.staff (status);

  -- =========================
  -- students
  -- =========================
  create table if not exists public.students (
    id uuid primary key default gen_random_uuid(),
    code text unique,
    full_name text not null,
    dob date,
    gender text,
    phone text,
    email text,
    parent_name text,
    parent_phone text,
    parent_phone_2 text,
    address text,
    branch text,
    class_id uuid,
    class_name text,
    class_ids uuid[] default '{}',
    status text default 'Đang học',
    registered_sessions integer default 0,
    attended_sessions integer default 0,
    remaining_sessions integer default 0,
    debt_sessions integer default 0,
    has_debt boolean default false,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  drop trigger if exists trg_students_updated_at on public.students;
  create trigger trg_students_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

  create index if not exists idx_students_name on public.students (full_name);
  create index if not exists idx_students_status on public.students (status);
  create index if not exists idx_students_class_id on public.students (class_id);

  -- =========================
  -- classes
  -- =========================
  create table if not exists public.classes (
    id uuid primary key default gen_random_uuid(),
    code text unique,
    name text not null,
    branch text,
    age_group text,
    curriculum text,
    schedule text,
    schedule_details jsonb,
    room text,
    start_date date,
    end_date date,
    progress text,
    status public.class_status not null default 'Đang học',
    total_sessions integer default 0,
    max_students integer default 20,
    teacher text,
    teacher_id uuid references public.staff(id) on delete set null,
    foreign_teacher text,
    foreign_teacher_id uuid references public.staff(id) on delete set null,
    assistant text,
    assistant_id uuid references public.staff(id) on delete set null,
    color integer,
    student_ids uuid[] default '{}',
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  drop trigger if exists trg_classes_updated_at on public.classes;
  create trigger trg_classes_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

  create index if not exists idx_classes_name on public.classes (name);
  create index if not exists idx_classes_status on public.classes (status);
  create index if not exists idx_classes_branch on public.classes (branch);
  create index if not exists idx_classes_teacher_id on public.classes (teacher_id);

  -- FK students.class_id -> classes.id
  alter table public.students
    drop constraint if exists fk_students_class_id;

  alter table public.students
    add constraint fk_students_class_id
    foreign key (class_id) references public.classes(id) on delete set null;

  -- =========================
  -- class_sessions
  -- =========================
  create table if not exists public.class_sessions (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    class_name text,
    session_number integer not null,
    date date not null,
    day_of_week integer,
    start_time text,
    end_time text,
    teacher text,
    assistant text,
    room text,
    status text default 'Chưa học',
    attendance_id uuid,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (class_id, session_number)
  );

  drop trigger if exists trg_class_sessions_updated_at on public.class_sessions;
  create trigger trg_class_sessions_updated_at
  before update on public.class_sessions
  for each row execute function public.set_updated_at();

  create index if not exists idx_class_sessions_class_id on public.class_sessions (class_id);
  create index if not exists idx_class_sessions_date on public.class_sessions (date);

  -- =========================
  -- contracts
  -- =========================
  create table if not exists public.contracts (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    type public.contract_type not null default 'Học viên',
    student_id uuid references public.students(id) on delete set null,
    student_name text,
    student_dob date,
    parent_name text,
    parent_phone text,
    class_id uuid references public.classes(id) on delete set null,
    class_name text,
    branch text,
    subtotal numeric(14,2) not null default 0,
    total_discount numeric(14,2) not null default 0,
    total_amount numeric(14,2) not null default 0,
    total_amount_in_words text,
    payment_method public.payment_method not null default 'Tiền mặt',
    paid_amount numeric(14,2) not null default 0,
    remaining_amount numeric(14,2) not null default 0,
    contract_date date not null default current_date,
    start_date date,
    end_date date,
    payment_date date,
    next_payment_date date,
    total_sessions integer default 0,
    price_per_session numeric(14,2) default 0,
    status public.contract_status not null default 'Lưu nháp',
    notes text,
    created_by text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  drop trigger if exists trg_contracts_updated_at on public.contracts;
  create trigger trg_contracts_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

  create index if not exists idx_contracts_code on public.contracts (code);
  create index if not exists idx_contracts_student_id on public.contracts (student_id);
  create index if not exists idx_contracts_status on public.contracts (status);
  create index if not exists idx_contracts_contract_date on public.contracts (contract_date);

  -- =========================
  -- contract_items
  -- =========================
  create table if not exists public.contract_items (
    id uuid primary key default gen_random_uuid(),
    contract_id uuid not null references public.contracts(id) on delete cascade,
    type text not null default 'course',
    item_ref_id text,
    name text not null,
    class_id uuid references public.classes(id) on delete set null,
    class_name text,
    unit_price numeric(14,2) not null default 0,
    quantity integer not null default 0,
    subtotal numeric(14,2) not null default 0,
    discount numeric(6,4) not null default 0,
    final_price numeric(14,2) not null default 0,
    debt_sessions integer default 0,
    start_date date,
    end_date date,
    applied_discounts jsonb default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  drop trigger if exists trg_contract_items_updated_at on public.contract_items;
  create trigger trg_contract_items_updated_at
  before update on public.contract_items
  for each row execute function public.set_updated_at();

  create index if not exists idx_contract_items_contract_id on public.contract_items (contract_id);
  create index if not exists idx_contract_items_class_id on public.contract_items (class_id);

  -- =========================
  -- enrollments
  -- =========================
  create table if not exists public.enrollments (
    id uuid primary key default gen_random_uuid(),
    student_name text not null,
    student_id uuid references public.students(id) on delete set null,
    class_id uuid references public.classes(id) on delete set null,
    class_name text,
    sessions integer not null default 0,
    type text not null,
    contract_code text,
    contract_id uuid references public.contracts(id) on delete set null,
    original_amount numeric(14,2) default 0,
    final_amount numeric(14,2) default 0,
    created_date text,
    created_by text not null,
    staff text,
    note text,
    reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  drop trigger if exists trg_enrollments_updated_at on public.enrollments;
  create trigger trg_enrollments_updated_at
  before update on public.enrollments
  for each row execute function public.set_updated_at();

  create index if not exists idx_enrollments_student_id on public.enrollments (student_id);
  create index if not exists idx_enrollments_contract_id on public.enrollments (contract_id);
  create index if not exists idx_enrollments_contract_code on public.enrollments (contract_code);

  -- =========================
  -- hoc_phi_da_thu
  -- =========================
  create table if not exists public.hoc_phi_da_thu (
    id uuid primary key default gen_random_uuid(),
    thang date not null,
    lop_id uuid references public.classes(id) on delete set null,
    lop text not null,
    hoc_sinh_id uuid references public.students(id) on delete set null,
    hoc_sinh text not null,
    hoc_phi numeric(14,2) not null default 0 check (hoc_phi >= 0),
    ngay_tao timestamptz not null default now(),
    ngay_thanh_toan timestamptz,
    trang_thai text not null default 'Chờ thanh toán'
      check (trang_thai in ('Chờ thanh toán', 'Đã thanh toán', 'Đã hủy')),
    ghi_chu text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint hoc_phi_da_thu_thang_first_day check (date_trunc('month', thang)::date = thang),
    constraint hoc_phi_da_thu_unique_month_student_class unique (thang, lop_id, hoc_sinh_id)
  );

  drop trigger if exists trg_hoc_phi_da_thu_updated_at on public.hoc_phi_da_thu;
  create trigger trg_hoc_phi_da_thu_updated_at
  before update on public.hoc_phi_da_thu
  for each row execute function public.set_updated_at();

  create index if not exists idx_hoc_phi_da_thu_thang on public.hoc_phi_da_thu (thang desc);
  create index if not exists idx_hoc_phi_da_thu_lop_id on public.hoc_phi_da_thu (lop_id);
  create index if not exists idx_hoc_phi_da_thu_hoc_sinh_id on public.hoc_phi_da_thu (hoc_sinh_id);
  create index if not exists idx_hoc_phi_da_thu_trang_thai on public.hoc_phi_da_thu (trang_thai);
  create index if not exists idx_hoc_phi_da_thu_ngay_thanh_toan on public.hoc_phi_da_thu (ngay_thanh_toan desc);

  -- =========================
  -- users (app profile table)
  -- =========================
  create table if not exists public.users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    password text,
    full_name text,
    avatar_url text,
    role text not null default 'Nhân viên',
    status text not null default 'active',
    phone text,
    branch text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  drop trigger if exists trg_users_updated_at on public.users;
  create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

  create index if not exists idx_users_email on public.users (email);
  create index if not exists idx_users_role on public.users (role);
  create index if not exists idx_users_status on public.users (status);

  -- Optional compatibility alias for typo/prior usage: "useer"
  drop view if exists public.useer;
  create view public.useer as
  select *
  from public.users;

  -- =========================
  -- centers (cơ sở / chi nhánh)
  -- =========================
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

  -- =========================
  -- app_settings (cài đặt công ty, v.v.)
  -- =========================
  create table if not exists public.app_settings (
    id text primary key,
    value jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
  );

  drop trigger if exists trg_app_settings_updated_at on public.app_settings;
  create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

  -- =========================
  -- Auth RPC (đăng nhập qua bảng users)
  -- =========================
  create or replace function public.authenticate_user(p_email text, p_password text)
  returns table (
    id uuid,
    email text,
    full_name text,
    role text,
    status text,
    branch text
  )
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    return query
    select u.id, u.email, u.full_name, u.role, u.status, u.branch
    from public.users u
    where lower(trim(u.email)) = lower(trim(p_email))
      and u.password is not null
      and u.password = p_password
      and u.status = 'active';
  end;
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
  declare
    ok boolean;
  begin
    update public.users
    set password = p_new_password, updated_at = now()
    where id = p_user_id
      and password = p_current_password
      and status = 'active';
    ok := found;
    return ok;
  end;
  $$;

  grant execute on function public.authenticate_user(text, text) to anon, authenticated;
  grant execute on function public.change_user_password(uuid, text, text) to anon, authenticated;

  -- =========================
  -- Optional RLS (quick start)
  -- =========================
  alter table public.staff enable row level security;
  alter table public.students enable row level security;
  alter table public.classes enable row level security;
  alter table public.class_sessions enable row level security;
  alter table public.contracts enable row level security;
  alter table public.contract_items enable row level security;
  alter table public.enrollments enable row level security;
  alter table public.hoc_phi_da_thu enable row level security;
  alter table public.users enable row level security;
  alter table public.centers enable row level security;
  alter table public.app_settings enable row level security;

  -- WARNING: permissive policies for initial migration/dev only.
  do $$
  begin
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'staff' and policyname = 'staff_all_authenticated'
    ) then
      create policy staff_all_authenticated on public.staff for all to authenticated using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'students' and policyname = 'students_all_authenticated'
    ) then
      create policy students_all_authenticated on public.students for all to authenticated using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'classes' and policyname = 'classes_all_authenticated'
    ) then
      create policy classes_all_authenticated on public.classes for all to authenticated using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'class_sessions' and policyname = 'class_sessions_all_authenticated'
    ) then
      create policy class_sessions_all_authenticated on public.class_sessions for all to authenticated using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'contracts' and policyname = 'contracts_all_authenticated'
    ) then
      create policy contracts_all_authenticated on public.contracts for all to authenticated using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'contract_items' and policyname = 'contract_items_all_authenticated'
    ) then
      create policy contract_items_all_authenticated on public.contract_items for all to authenticated using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'enrollments' and policyname = 'enrollments_all_authenticated'
    ) then
      create policy enrollments_all_authenticated on public.enrollments for all to authenticated using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'hoc_phi_da_thu' and policyname = 'hoc_phi_da_thu_all_authenticated'
    ) then
      create policy hoc_phi_da_thu_all_authenticated on public.hoc_phi_da_thu for all to authenticated using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'staff' and policyname = 'staff_anon_dev'
    ) then
      create policy staff_anon_dev on public.staff for all to anon using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'students' and policyname = 'students_anon_dev'
    ) then
      create policy students_anon_dev on public.students for all to anon using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'classes' and policyname = 'classes_anon_dev'
    ) then
      create policy classes_anon_dev on public.classes for all to anon using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'class_sessions' and policyname = 'class_sessions_anon_dev'
    ) then
      create policy class_sessions_anon_dev on public.class_sessions for all to anon using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'contracts' and policyname = 'contracts_anon_dev'
    ) then
      create policy contracts_anon_dev on public.contracts for all to anon using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'contract_items' and policyname = 'contract_items_anon_dev'
    ) then
      create policy contract_items_anon_dev on public.contract_items for all to anon using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'enrollments' and policyname = 'enrollments_anon_dev'
    ) then
      create policy enrollments_anon_dev on public.enrollments for all to anon using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'hoc_phi_da_thu' and policyname = 'hoc_phi_da_thu_anon_dev'
    ) then
      create policy hoc_phi_da_thu_anon_dev on public.hoc_phi_da_thu for all to anon using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'centers' and policyname = 'centers_anon_dev'
    ) then
      create policy centers_anon_dev on public.centers for all to anon using (true) with check (true);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'app_settings' and policyname = 'app_settings_anon_dev'
    ) then
      create policy app_settings_anon_dev on public.app_settings for all to anon using (true) with check (true);
    end if;
  end $$;

  -- End of bootstrap schema
