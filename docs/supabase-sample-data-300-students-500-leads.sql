-- Sample data for EduManager Pro
-- Scale: 12 grade classes, 300 students with varied class sizes, 500 leads.
-- Run after docs/supabase-init-schema.sql and the optional module migrations.

begin;

create extension if not exists pgcrypto;

create or replace function public.sample_uuid(p_seed text)
returns uuid
language sql
immutable
as $$
  select (
    substr(md5(p_seed), 1, 8) || '-' ||
    substr(md5(p_seed), 9, 4) || '-' ||
    substr(md5(p_seed), 13, 4) || '-' ||
    substr(md5(p_seed), 17, 4) || '-' ||
    substr(md5(p_seed), 21, 12)
  )::uuid;
$$;

alter table public.classes add column if not exists tuition_fee numeric(14,2) not null default 0;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  child_name text,
  child_age integer,
  source text not null default 'Khác',
  status text not null default 'Mới',
  assigned_to text,
  assigned_to_name text,
  campaign_ids text[] not null default '{}',
  campaign_names text[] not null default '{}',
  note text,
  last_contact_date date,
  next_follow_up date,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads add column if not exists email text;
alter table public.leads add column if not exists child_name text;
alter table public.leads add column if not exists child_age integer;
alter table public.leads add column if not exists source text not null default 'Khác';
alter table public.leads add column if not exists status text not null default 'Mới';
alter table public.leads add column if not exists assigned_to text;
alter table public.leads add column if not exists assigned_to_name text;
alter table public.leads add column if not exists campaign_ids text[] not null default '{}';
alter table public.leads add column if not exists campaign_names text[] not null default '{}';
alter table public.leads add column if not exists note text;
alter table public.leads add column if not exists last_contact_date date;
alter table public.leads add column if not exists next_follow_up date;
alter table public.leads add column if not exists metadata jsonb not null default '{}';
alter table public.leads add column if not exists created_at timestamptz not null default now();
alter table public.leads add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_source on public.leads(source);
create index if not exists idx_leads_created_at on public.leads(created_at desc);

alter table public.leads enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_anon_dev'
  ) then
    create policy leads_anon_dev on public.leads for all to anon using (true) with check (true);
  end if;
end $$;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_code text unique not null,
  customer_name text not null,
  customer_phone text,
  student_id uuid references public.students(id) on delete set null,
  student_name text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  status text not null default 'Chờ thanh toán',
  payment_method text,
  note text,
  created_by text,
  paid_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices add column if not exists customer_phone text;
alter table public.invoices add column if not exists student_id uuid;
alter table public.invoices add column if not exists student_name text;
alter table public.invoices add column if not exists items jsonb not null default '[]'::jsonb;
alter table public.invoices add column if not exists subtotal numeric(14,2) not null default 0;
alter table public.invoices add column if not exists discount numeric(14,2) not null default 0;
alter table public.invoices add column if not exists total numeric(14,2) not null default 0;
alter table public.invoices add column if not exists status text not null default 'Chờ thanh toán';
alter table public.invoices add column if not exists payment_method text;
alter table public.invoices add column if not exists note text;
alter table public.invoices add column if not exists created_by text;
alter table public.invoices add column if not exists paid_at timestamptz;
alter table public.invoices add column if not exists metadata jsonb not null default '{}';
alter table public.invoices add column if not exists created_at timestamptz not null default now();
alter table public.invoices add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_student_id on public.invoices(student_id);
create index if not exists idx_invoices_created_at on public.invoices(created_at desc);

alter table public.invoices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_anon_dev'
  ) then
    create policy invoices_anon_dev on public.invoices for all to anon using (true) with check (true);
  end if;
end $$;

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

create index if not exists idx_attendance_class_date on public.attendance(class_id, date desc);
create index if not exists idx_attendance_session_id on public.attendance(session_id);
create index if not exists idx_attendance_date on public.attendance(date desc);

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

create index if not exists idx_student_attendance_attendance_id on public.student_attendance(attendance_id);
create index if not exists idx_student_attendance_session_id on public.student_attendance(session_id);
create index if not exists idx_student_attendance_class_date on public.student_attendance(class_id, date);
create index if not exists idx_student_attendance_student_class on public.student_attendance(student_id, class_id);

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

create index if not exists idx_tutoring_student_id on public.tutoring(student_id);
create index if not exists idx_tutoring_class_id on public.tutoring(class_id);

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

create index if not exists idx_feedbacks_date on public.feedbacks(date desc);
create index if not exists idx_feedbacks_type on public.feedbacks(type);
create index if not exists idx_feedbacks_status on public.feedbacks(status);
create index if not exists idx_feedbacks_student_id on public.feedbacks(student_id);

alter table public.attendance enable row level security;
alter table public.student_attendance enable row level security;
alter table public.tutoring enable row level security;
alter table public.feedbacks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance' and policyname = 'attendance_anon_dev') then
    create policy attendance_anon_dev on public.attendance for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'student_attendance' and policyname = 'student_attendance_anon_dev') then
    create policy student_attendance_anon_dev on public.student_attendance for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tutoring' and policyname = 'tutoring_anon_dev') then
    create policy tutoring_anon_dev on public.tutoring for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'feedbacks' and policyname = 'feedbacks_anon_dev') then
    create policy feedbacks_anon_dev on public.feedbacks for all to anon using (true) with check (true);
  end if;
end $$;

delete from public.student_attendance where metadata->>'seed' = 'sample_300_500';
delete from public.attendance where created_by = 'Sample seed';
delete from public.tutoring where metadata->>'seed' = 'sample_300_500';
delete from public.feedbacks where content like '[Sample seed]%' or status = 'Sample seed';
delete from public.invoices where metadata->>'seed' = 'sample_300_500';
delete from public.enrollments where contract_code like 'SAMPLE-CT-%' or contract_code like ('DE' || 'MO-CT-%');
delete from public.contract_items
where contract_id in (select id from public.contracts where metadata->>'seed' = 'sample_300_500');
delete from public.contracts where metadata->>'seed' = 'sample_300_500';
delete from public.students where metadata->>'seed' = 'sample_300_500';
delete from public.class_sessions where metadata->>'seed' = 'sample_300_500';
delete from public.classes where metadata->>'seed' = 'sample_300_500';
delete from public.leads where metadata->>'seed' = 'sample_300_500';
delete from public.curriculums where code like 'SAMPLE-CUR-%' or code like ('DE' || 'MO-CUR-%');
delete from public.staff where code like 'SAMPLE-STF-%' or code like ('DE' || 'MO-STF-%');
delete from public.centers where code like 'SAMPLE-CEN-%' or code like ('DE' || 'MO-CEN-%');

insert into public.centers (id, name, code, address, phone, email, manager, working_hours, is_main, status)
values
  (public.sample_uuid('center-main'), 'Center Quận 1', 'SAMPLE-CEN-Q1', '12 Nguyễn Huệ, Quận 1, TP.HCM', '02839000001', 'q1@sample.edu.vn', 'Nguyễn Minh Anh', '08:00 - 21:00', true, 'Active'),
  (public.sample_uuid('center-q7'), 'Center Quận 7', 'SAMPLE-CEN-Q7', '88 Nguyễn Thị Thập, Quận 7, TP.HCM', '02839000007', 'q7@sample.edu.vn', 'Trần Hoài Nam', '08:00 - 21:00', false, 'Active'),
  (public.sample_uuid('center-td'), 'Center Thủ Đức', 'SAMPLE-CEN-TD', '25 Võ Văn Ngân, Thủ Đức, TP.HCM', '02839000009', 'td@sample.edu.vn', 'Lê Thu Hà', '08:00 - 21:00', false, 'Active')
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  address = excluded.address,
  phone = excluded.phone,
  email = excluded.email,
  manager = excluded.manager,
  working_hours = excluded.working_hours,
  is_main = excluded.is_main,
  status = excluded.status;

insert into public.staff (id, code, name, phone, email, department, position, role, roles, branch, status, start_date, metadata)
select
  public.sample_uuid('staff-' || s.n),
  'SAMPLE-STF-' || lpad(s.n::text, 2, '0'),
  s.name,
  '0908' || lpad((100000 + s.n)::text, 6, '0'),
  'staff' || lpad(s.n::text, 2, '0') || '@sample.edu.vn',
  s.department,
  s.position,
  s.role,
  s.roles,
  s.branch,
  'Đang làm việc',
  current_date - (s.n * 45),
  '{"seed":"sample_300_500"}'::jsonb
from (
  values
    (1, 'Nguyễn Minh Anh', 'Quản lý', 'Giám đốc trung tâm', 'Admin', array['Admin','Quản lý'], 'Center Quận 1'),
    (2, 'Trần Hoài Nam', 'Đào tạo', 'Giáo viên', 'Giáo viên', array['Giáo viên'], 'Center Quận 1'),
    (3, 'Lê Thu Hà', 'Đào tạo', 'Giáo viên', 'Giáo viên', array['Giáo viên'], 'Center Quận 7'),
    (4, 'Phạm Đức Huy', 'Đào tạo', 'Giáo viên', 'Giáo viên', array['Giáo viên'], 'Center Thủ Đức'),
    (5, 'Vũ Ngọc Mai', 'CSKH', 'Tư vấn viên', 'CSKH', array['CSKH','Sales'], 'Center Quận 1'),
    (6, 'Đỗ Khánh Linh', 'CSKH', 'Tư vấn viên', 'CSKH', array['CSKH','Sales'], 'Center Quận 7'),
    (7, 'Bùi Gia Bảo', 'Đào tạo', 'Trợ giảng', 'Trợ giảng', array['Trợ giảng'], 'Center Quận 1'),
    (8, 'Hoàng Phương Vy', 'Đào tạo', 'Trợ giảng', 'Trợ giảng', array['Trợ giảng'], 'Center Thủ Đức'),
    (9, 'Ngô Quốc Việt', 'Kế toán', 'Kế toán', 'Kế toán', array['Kế toán'], 'Center Quận 1'),
    (10, 'Phan Thảo My', 'CSKH', 'Chăm sóc học viên', 'CSKH', array['CSKH'], 'Center Thủ Đức')
) as s(n, name, department, position, role, roles, branch)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  phone = excluded.phone,
  email = excluded.email,
  department = excluded.department,
  position = excluded.position,
  role = excluded.role,
  roles = excluded.roles,
  branch = excluded.branch,
  status = excluded.status,
  metadata = excluded.metadata;

insert into public.curriculums (
  id, name, code, description, level, age_range, duration, total_sessions,
  session_duration, tuition_fee, materials, objectives, status
)
select
  public.sample_uuid('curriculum-grade-' || g),
  'Toán tư duy lớp ' || g,
  'SAMPLE-CUR-G' || lpad(g::text, 2, '0'),
  'Chương trình mẫu cho học sinh lớp ' || g,
  'Lớp ' || g,
  (g + 5)::text || ' - ' || (g + 6)::text || ' tuổi',
  6,
  48,
  90,
  case when g <= 5 then 6800000 when g <= 9 then 7800000 else 9200000 end,
  array['Sách bài tập', 'Phiếu luyện tập', 'Đề kiểm tra định kỳ'],
  array['Nắm kiến thức nền tảng', 'Tăng tốc độ xử lý bài', 'Theo dõi tiến bộ theo buổi'],
  'Active'
from generate_series(1, 12) as g
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  description = excluded.description,
  level = excluded.level,
  age_range = excluded.age_range,
  duration = excluded.duration,
  total_sessions = excluded.total_sessions,
  session_duration = excluded.session_duration,
  tuition_fee = excluded.tuition_fee,
  materials = excluded.materials,
  objectives = excluded.objectives,
  status = excluded.status;

insert into public.classes (
  id, code, name, branch, age_group, curriculum, schedule, schedule_details,
  room, start_date, end_date, progress, status, total_sessions, tuition_fee,
  max_students, teacher, teacher_id, assistant, assistant_id, color, metadata
)
select
  public.sample_uuid('class-grade-' || g),
  'SAMPLE-CL-G' || lpad(g::text, 2, '0'),
  'Lớp ' || lpad(g::text, 2, '0') || 'A',
  case (g - 1) % 3 when 0 then 'Center Quận 1' when 1 then 'Center Quận 7' else 'Center Thủ Đức' end,
  'Lớp ' || g,
  'Toán tư duy lớp ' || g,
  case (g - 1) % 3 when 0 then 'Thứ 2, Thứ 4 17:30-19:00' when 1 then 'Thứ 3, Thứ 5 18:00-19:30' else 'Thứ 7, Chủ nhật 09:00-10:30' end,
  jsonb_build_object(
    'days', case (g - 1) % 3 when 0 then jsonb_build_array(1,3) when 1 then jsonb_build_array(2,4) else jsonb_build_array(6,0) end,
    'startTime', case (g - 1) % 3 when 2 then '09:00' when 1 then '18:00' else '17:30' end,
    'endTime', case (g - 1) % 3 when 2 then '10:30' when 1 then '19:30' else '19:00' end
  ),
  'Phòng ' || (101 + g),
  current_date - ((13 - g) * 7),
  current_date + 180,
  'Buổi ' || (4 + (g % 8)) || '/48',
  'Đang học'::public.class_status,
  48,
  case when g <= 5 then 6800000 when g <= 9 then 7800000 else 9200000 end,
  40,
  t.name,
  t.id,
  a.name,
  a.id,
  1 + (g % 8),
  jsonb_build_object('seed', 'sample_300_500', 'grade', g)
from generate_series(1, 12) as g
join public.staff t on t.id = public.sample_uuid('staff-' || (2 + ((g - 1) % 3)))
join public.staff a on a.id = public.sample_uuid('staff-' || (7 + ((g - 1) % 2)))
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  branch = excluded.branch,
  age_group = excluded.age_group,
  curriculum = excluded.curriculum,
  schedule = excluded.schedule,
  schedule_details = excluded.schedule_details,
  room = excluded.room,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  progress = excluded.progress,
  status = excluded.status,
  total_sessions = excluded.total_sessions,
  tuition_fee = excluded.tuition_fee,
  max_students = excluded.max_students,
  teacher = excluded.teacher,
  teacher_id = excluded.teacher_id,
  assistant = excluded.assistant,
  assistant_id = excluded.assistant_id,
  color = excluded.color,
  metadata = excluded.metadata;

insert into public.class_sessions (
  id, class_id, class_name, session_number, date, day_of_week, start_time,
  end_time, teacher, assistant, room, status, metadata
)
select
  public.sample_uuid('session-' || c.code || '-' || s.session_number),
  c.id,
  c.name,
  s.session_number,
  c.start_date + ((s.session_number - 1) * 3),
  extract(dow from c.start_date + ((s.session_number - 1) * 3))::integer,
  coalesce(c.schedule_details->>'startTime', '17:30'),
  coalesce(c.schedule_details->>'endTime', '19:00'),
  c.teacher,
  c.assistant,
  c.room,
  case when s.session_number <= 4 then 'Đã học' else 'Chưa học' end,
  '{"seed":"sample_300_500"}'::jsonb
from public.classes c
cross join generate_series(1, 24) as s(session_number)
where c.metadata->>'seed' = 'sample_300_500'
on conflict (class_id, session_number) do update set
  class_name = excluded.class_name,
  date = excluded.date,
  day_of_week = excluded.day_of_week,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  teacher = excluded.teacher,
  assistant = excluded.assistant,
  room = excluded.room,
  status = excluded.status,
  metadata = excluded.metadata;

with names as (
  select
    array['Nguyễn','Trần','Lê','Phạm','Hoàng','Phan','Vũ','Võ','Đặng','Bùi','Đỗ','Hồ','Ngô','Dương','Lý'] as last_names,
    array['Minh','Anh','Gia','Khánh','Bảo','Ngọc','Quỳnh','Tuấn','Hà','Nam','Linh','Vy','Khoa','Huy','Mai','Thảo','Đức','Phúc','Thiên','Nhật'] as middle_names,
    array['An','Bình','Chi','Duy','Giang','Hân','Khang','Lan','Long','My','Nhi','Phát','Quân','Sơn','Trang','Uyên','Việt','Yến','Tâm','Tú'] as first_names
),
student_seed as (
  select
    ns.n,
    ns.grade,
    ns.class_index,
    names.last_names[((ns.n - 1) % array_length(names.last_names, 1)) + 1] || ' ' ||
      names.middle_names[((ns.n * 3 - 1) % array_length(names.middle_names, 1)) + 1] || ' ' ||
      names.first_names[((ns.n * 5 - 1) % array_length(names.first_names, 1)) + 1] as full_name
  from (
    select
      (sum(d.student_count) over (order by d.grade) - d.student_count + gs.class_index)::integer as n,
      d.grade,
      gs.class_index
    from (
      values
        (1, 18),
        (2, 22),
        (3, 27),
        (4, 31),
        (5, 24),
        (6, 29),
        (7, 17),
        (8, 35),
        (9, 26),
        (10, 21),
        (11, 33),
        (12, 17)
    ) as d(grade, student_count)
    cross join lateral generate_series(1, d.student_count) as gs(class_index)
  ) ns
  cross join names
)
insert into public.students (
  id, code, full_name, dob, gender, phone, email, parent_name, parent_phone,
  parent_phone_2, address, branch, class_id, class_name, class_ids, status,
  registered_sessions, attended_sessions, remaining_sessions, debt_sessions,
  has_debt, metadata
)
select
  public.sample_uuid('student-' || s.n),
  'SAMPLE-STU-' || lpad(s.n::text, 4, '0'),
  s.full_name,
  make_date(extract(year from current_date)::integer - (s.grade + 6), 1 + (s.n % 12), 1 + (s.n % 27)),
  case when s.n % 2 = 0 then 'Nữ' else 'Nam' end,
  '091' || lpad((2000000 + s.n)::text, 7, '0'),
  'student' || lpad(s.n::text, 4, '0') || '@sample.edu.vn',
  case when s.n % 2 = 0 then 'Chị ' else 'Anh ' end || split_part(s.full_name, ' ', 1) || ' Phụ huynh',
  '098' || lpad((3000000 + ((s.n - 1) / 2)::integer)::text, 7, '0'),
  '097' || lpad((4000000 + s.n)::text, 7, '0'),
  (10 + (s.n % 90)) || ' Đường , TP.HCM',
  c.branch,
  c.id,
  c.name,
  array[c.id],
  case
    when s.n % 37 = 0 then 'Bảo lưu'
    when s.n % 29 = 0 then 'Nợ phí'
    when s.n % 23 = 0 then 'Sắp hết phí'
    else 'Đang học'
  end,
  48,
  6 + (s.n % 24),
  greatest(0, 48 - (6 + (s.n % 24))),
  case when s.n % 29 = 0 then 2 + (s.n % 5) else 0 end,
  s.n % 29 = 0,
  jsonb_build_object(
    'seed', 'sample_300_500',
    'grade', s.grade,
    'careHistory', jsonb_build_array(
      jsonb_build_object('id', 'sample-care-' || s.n, 'date', current_date - (s.n % 20), 'type', 'call', 'content', 'chăm sóc định kỳ')
    )
  )
from student_seed s
join public.classes c on c.id = public.sample_uuid('class-grade-' || s.grade)
on conflict (id) do update set
  code = excluded.code,
  full_name = excluded.full_name,
  dob = excluded.dob,
  gender = excluded.gender,
  phone = excluded.phone,
  email = excluded.email,
  parent_name = excluded.parent_name,
  parent_phone = excluded.parent_phone,
  parent_phone_2 = excluded.parent_phone_2,
  address = excluded.address,
  branch = excluded.branch,
  class_id = excluded.class_id,
  class_name = excluded.class_name,
  class_ids = excluded.class_ids,
  status = excluded.status,
  registered_sessions = excluded.registered_sessions,
  attended_sessions = excluded.attended_sessions,
  remaining_sessions = excluded.remaining_sessions,
  debt_sessions = excluded.debt_sessions,
  has_debt = excluded.has_debt,
  metadata = excluded.metadata;

update public.classes c
set student_ids = coalesce(s.student_ids, '{}')
from (
  select class_id, array_agg(id order by code) as student_ids
  from public.students
  where metadata->>'seed' = 'sample_300_500'
  group by class_id
) s
where c.id = s.class_id;

insert into public.contracts (
  id, code, type, student_id, student_name, student_dob, parent_name, parent_phone,
  class_id, class_name, branch, subtotal, total_discount, total_amount,
  total_amount_in_words, payment_method, paid_amount, remaining_amount,
  contract_date, start_date, end_date, payment_date, total_sessions,
  price_per_session, status, notes, created_by, metadata
)
select
  public.sample_uuid('contract-' || s.code),
  'SAMPLE-CT-' || right(s.code, 4),
  'Học viên'::public.contract_type,
  s.id,
  s.full_name,
  s.dob,
  s.parent_name,
  s.parent_phone,
  c.id,
  c.name,
  c.branch,
  c.tuition_fee,
  case when right(s.code, 2)::integer % 5 = 0 then 300000 else 0 end,
  c.tuition_fee - case when right(s.code, 2)::integer % 5 = 0 then 300000 else 0 end,
  'Bằng chữ: số tiền theo hợp đồng mẫu',
  (case when right(s.code, 2)::integer % 3 = 0 then 'Chuyển khoản' else 'Tiền mặt' end)::public.payment_method,
  case when s.has_debt then c.tuition_fee * 0.7 else c.tuition_fee end,
  case when s.has_debt then c.tuition_fee * 0.3 else 0 end,
  current_date - (right(s.code, 3)::integer % 90),
  c.start_date,
  c.end_date,
  current_date - (right(s.code, 3)::integer % 60),
  48,
  round(c.tuition_fee / 48, 2),
  (case when s.has_debt then 'Nợ hợp đồng' else 'Đã thanh toán' end)::public.contract_status,
  'Hợp đồng mẫu tự sinh',
  'Sample seed',
  '{"seed":"sample_300_500"}'::jsonb
from public.students s
join public.classes c on c.id = s.class_id
where s.metadata->>'seed' = 'sample_300_500'
on conflict (code) do update set
  student_id = excluded.student_id,
  student_name = excluded.student_name,
  class_id = excluded.class_id,
  class_name = excluded.class_name,
  subtotal = excluded.subtotal,
  total_discount = excluded.total_discount,
  total_amount = excluded.total_amount,
  paid_amount = excluded.paid_amount,
  remaining_amount = excluded.remaining_amount,
  status = excluded.status,
  metadata = excluded.metadata;

insert into public.contract_items (
  id, contract_id, type, item_ref_id, name, class_id, class_name,
  unit_price, quantity, subtotal, discount, final_price, start_date, end_date
)
select
  public.sample_uuid('contract-item-' || ct.code),
  ct.id,
  'course',
  c.code,
  c.curriculum,
  c.id,
  c.name,
  c.tuition_fee,
  1,
  c.tuition_fee,
  case when ct.total_discount > 0 then round(ct.total_discount / c.tuition_fee, 4) else 0 end,
  ct.total_amount,
  c.start_date,
  c.end_date
from public.contracts ct
join public.classes c on c.id = ct.class_id
where ct.metadata->>'seed' = 'sample_300_500'
on conflict (id) do update set
  contract_id = excluded.contract_id,
  name = excluded.name,
  class_id = excluded.class_id,
  class_name = excluded.class_name,
  unit_price = excluded.unit_price,
  subtotal = excluded.subtotal,
  discount = excluded.discount,
  final_price = excluded.final_price;

insert into public.enrollments (
  id, student_name, student_id, class_id, class_name, sessions, type,
  contract_code, contract_id, original_amount, final_amount, created_date,
  created_by, staff, note
)
select
  public.sample_uuid('enrollment-' || ct.code),
  ct.student_name,
  ct.student_id,
  ct.class_id,
  ct.class_name,
  48,
  'Đăng ký mới',
  ct.code,
  ct.id,
  ct.subtotal,
  ct.total_amount,
  ct.contract_date::text,
  'Sample seed',
  'Vũ Ngọc Mai',
  'Ghi danh mẫu'
from public.contracts ct
where ct.metadata->>'seed' = 'sample_300_500'
on conflict (id) do update set
  student_name = excluded.student_name,
  student_id = excluded.student_id,
  class_id = excluded.class_id,
  class_name = excluded.class_name,
  sessions = excluded.sessions,
  contract_code = excluded.contract_code,
  contract_id = excluded.contract_id,
  original_amount = excluded.original_amount,
  final_amount = excluded.final_amount;

insert into public.attendance (
  id, class_id, class_name, date, session_number, session_id, total_students,
  present, absent, reserved, tutored, status, attendance_type, created_by
)
select
  public.sample_uuid('attendance-' || c.code || '-' || cs.session_number),
  c.id,
  c.name,
  cs.date,
  cs.session_number,
  cs.id,
  count(s.id),
  count(s.id) filter (where right(s.code, 2)::integer % 11 <> 0),
  count(s.id) filter (where right(s.code, 2)::integer % 11 = 0),
  count(s.id) filter (where right(s.code, 2)::integer % 17 = 0),
  0,
  'Đã điểm danh',
  'session',
  'Sample seed'
from public.classes c
join public.class_sessions cs on cs.class_id = c.id and cs.session_number <= 4
left join public.students s on s.class_id = c.id and s.metadata->>'seed' = 'sample_300_500'
where c.metadata->>'seed' = 'sample_300_500'
group by c.id, c.code, c.name, cs.id, cs.date, cs.session_number
on conflict (id) do update set
  total_students = excluded.total_students,
  present = excluded.present,
  absent = excluded.absent,
  reserved = excluded.reserved,
  status = excluded.status;

insert into public.student_attendance (
  id, attendance_id, session_id, student_id, student_name, student_code,
  class_id, class_name, date, session_number, status, note, homework_completion,
  score, punctuality, is_late, attendance_type, metadata
)
select
  public.sample_uuid('student-attendance-' || a.id || '-' || s.code),
  a.id,
  a.session_id,
  s.id,
  s.full_name,
  s.code,
  a.class_id,
  a.class_name,
  a.date,
  a.session_number,
  case
    when right(s.code, 2)::integer % 17 = 0 then 'Bảo lưu'
    when right(s.code, 2)::integer % 11 = 0 then 'Vắng'
    when right(s.code, 2)::integer % 7 = 0 then 'Trễ giờ'
    else 'Đúng giờ'
  end,
  case when right(s.code, 2)::integer % 11 = 0 then 'vắng có phép' else null end,
  70 + (right(s.code, 2)::integer % 31),
  6 + (right(s.code, 2)::integer % 5),
  case when right(s.code, 2)::integer % 7 = 0 then 'Trễ giờ' else 'Đúng giờ' end,
  right(s.code, 2)::integer % 7 = 0,
  'session',
  '{"seed":"sample_300_500"}'::jsonb
from public.attendance a
join public.students s on s.class_id = a.class_id and s.metadata->>'seed' = 'sample_300_500'
where a.created_by = 'Sample seed'
on conflict (id) do update set
  status = excluded.status,
  note = excluded.note,
  homework_completion = excluded.homework_completion,
  score = excluded.score,
  punctuality = excluded.punctuality,
  is_late = excluded.is_late,
  metadata = excluded.metadata;

insert into public.tutoring (
  id, student_id, student_name, class_id, class_name, absent_date, type,
  status, scheduled_date, scheduled_time, tutor, note, metadata
)
select
  public.sample_uuid('tutoring-' || sa.id),
  sa.student_id,
  sa.student_name,
  sa.class_id,
  sa.class_name,
  sa.date,
  'Học bù',
  'Đã hẹn',
  sa.date + 7,
  '17:30',
  c.teacher,
  'học bù sau buổi vắng',
  '{"seed":"sample_300_500"}'::jsonb
from public.student_attendance sa
join public.classes c on c.id = sa.class_id
where sa.metadata->>'seed' = 'sample_300_500'
  and sa.status = 'Vắng'
limit 24
on conflict (id) do update set
  status = excluded.status,
  scheduled_date = excluded.scheduled_date,
  scheduled_time = excluded.scheduled_time,
  tutor = excluded.tutor,
  metadata = excluded.metadata;

insert into public.feedbacks (
  id, date, type, student_id, student_name, class_id, class_name, teacher,
  teacher_score, curriculum_score, care_score, facilities_score, average_score,
  caller, content, status, parent_name, parent_phone
)
select
  public.sample_uuid('feedback-' || s.code),
  current_date - (right(s.code, 3)::integer % 30),
  case when right(s.code, 2)::integer % 2 = 0 then 'Call' else 'Form' end,
  s.id,
  s.full_name,
  c.id,
  c.name,
  c.teacher,
  7 + (right(s.code, 2)::integer % 4),
  7 + (right(s.code, 2)::integer % 4),
  8 + (right(s.code, 2)::integer % 3),
  7 + (right(s.code, 2)::integer % 4),
  7.8 + ((right(s.code, 2)::integer % 20)::numeric / 10),
  'Phan Thảo My',
  '[seed] Phụ huynh hài lòng, cần gửi thêm bài luyện tập tại nhà.',
  case when right(s.code, 2)::integer % 5 = 0 then 'Cần gọi lại' else 'Hoàn tất' end,
  s.parent_name,
  s.parent_phone
from public.students s
join public.classes c on c.id = s.class_id
where s.metadata->>'seed' = 'sample_300_500'
  and right(s.code, 2)::integer <= 60
on conflict (id) do update set
  date = excluded.date,
  type = excluded.type,
  content = excluded.content,
  status = excluded.status,
  average_score = excluded.average_score;

insert into public.invoices (
  id, invoice_code, customer_name, customer_phone, student_id, student_name,
  items, subtotal, discount, total, status, payment_method, note, created_by,
  paid_at, metadata
)
select
  public.sample_uuid('invoice-' || s.code),
  'SAMPLE-INV-' || right(s.code, 4),
  s.parent_name,
  s.parent_phone,
  s.id,
  s.full_name,
  jsonb_build_array(
    jsonb_build_object('productId', 'SAMPLE-PROD-BOOK', 'productName', 'Sách bài tập mẫu', 'quantity', 1, 'unitPrice', 180000, 'total', 180000),
    jsonb_build_object('productId', 'SAMPLE-PROD-UNIFORM', 'productName', 'Áo đồng phục mẫu', 'quantity', 1, 'unitPrice', 220000, 'total', 220000)
  ),
  400000,
  case when right(s.code, 2)::integer % 4 = 0 then 40000 else 0 end,
  400000 - case when right(s.code, 2)::integer % 4 = 0 then 40000 else 0 end,
  case when right(s.code, 2)::integer % 6 = 0 then 'Chờ thanh toán' else 'Đã thanh toán' end,
  case when right(s.code, 2)::integer % 2 = 0 then 'Chuyển khoản' else 'Tiền mặt' end,
  'Hóa đơn bán học liệu mẫu',
  'Sample seed',
  case when right(s.code, 2)::integer % 6 = 0 then null else now() - ((right(s.code, 3)::integer % 20) || ' days')::interval end,
  '{"seed":"sample_300_500"}'::jsonb
from public.students s
where s.metadata->>'seed' = 'sample_300_500'
  and right(s.code, 2)::integer <= 80
on conflict (id) do update set
  invoice_code = excluded.invoice_code,
  customer_name = excluded.customer_name,
  customer_phone = excluded.customer_phone,
  student_id = excluded.student_id,
  student_name = excluded.student_name,
  items = excluded.items,
  subtotal = excluded.subtotal,
  discount = excluded.discount,
  total = excluded.total,
  status = excluded.status,
  payment_method = excluded.payment_method,
  metadata = excluded.metadata;

with campaign_seed as (
  select jsonb_build_array(
    jsonb_build_object('id','sample-camp-summer','name','Tuyển sinh hè','description','Chiến dịch mẫu cho khóa hè','startDate',current_date - 30,'endDate',current_date + 60,'status','Đang mở','targetCount',300,'registeredCount',72,'assignedTo',jsonb_build_array('Vũ Ngọc Mai','Đỗ Khánh Linh'),'campaignDetails',jsonb_build_array(jsonb_build_object('action','Gọi tư vấn','detail','Liên hệ trong 24h'))),
    jsonb_build_object('id','sample-camp-backtoschool','name','Back to School','description','Ưu đãi đầu năm học','startDate',current_date - 10,'endDate',current_date + 90,'status','Đang mở','targetCount',500,'registeredCount',118,'assignedTo',jsonb_build_array('Vũ Ngọc Mai'),'campaignDetails',jsonb_build_array(jsonb_build_object('action','Test đầu vào','detail','Mời học sinh làm bài đánh giá')))
  ) as items
)
insert into public.app_settings (id, value)
select 'campaigns', jsonb_build_object('items', items) from campaign_seed
on conflict (id) do update set value = excluded.value, updated_at = now();

insert into public.app_settings (id, value)
values
  ('company_info', jsonb_build_object(
    'name', 'EduManager Pro',
    'phone', '02839000001',
    'email', 'hello@sample.edu.vn',
    'address', '12 Nguyễn Huệ, Quận 1, TP.HCM',
    'taxCode', 'SAMPLE-TAX-001'
  )),
  ('products', jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('id','SAMPLE-PROD-BOOK','name','Sách bài tập mẫu','code','SAMPLE-BOOK','category','Sách','price',180000,'stock',420,'minStock',30,'status','Kích hoạt','createdAt',now(),'updatedAt',now()),
    jsonb_build_object('id','SAMPLE-PROD-WORKSHEET','name','Bộ phiếu luyện tập mẫu','code','SAMPLE-WS','category','Học liệu','price',120000,'stock',650,'minStock',50,'status','Kích hoạt','createdAt',now(),'updatedAt',now()),
    jsonb_build_object('id','SAMPLE-PROD-UNIFORM','name','Áo đồng phục mẫu','code','SAMPLE-UNI','category','Đồng phục','price',220000,'stock',180,'minStock',20,'status','Kích hoạt','createdAt',now(),'updatedAt',now())
  ))),
  ('discounts', jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('id','SAMPLE-DISC-SIBLING','name','Ưu đãi anh/chị/em','type','percent','value',10,'status','Kích hoạt','createdAt',now(),'updatedAt',now()),
    jsonb_build_object('id','SAMPLE-DISC-EARLY','name','Đóng phí sớm','type','fixed','value',300000,'status','Kích hoạt','createdAt',now(),'updatedAt',now())
  ))),
  ('homework_statuses', jsonb_build_object('statuses', jsonb_build_array(
    jsonb_build_object('value','done','label','Đã làm','color','bg-green-100','textColor','text-green-700'),
    jsonb_build_object('value','partial','label','Làm một phần','color','bg-yellow-100','textColor','text-yellow-700'),
    jsonb_build_object('value','missing','label','Chưa làm','color','bg-red-100','textColor','text-red-700')
  )))
on conflict (id) do update set value = excluded.value, updated_at = now();

with lead_names as (
  select
    array['Nguyễn','Trần','Lê','Phạm','Hoàng','Phan','Vũ','Võ','Đặng','Bùi','Đỗ','Hồ','Ngô','Dương','Lý'] as last_names,
    array['Minh','Thanh','Hồng','Quốc','Thu','Gia','Kim','Bảo','Ngọc','Khánh','Hoài','Phương','Đức','Tú','Hải'] as middle_names,
    array['Anh','Bình','Châu','Dũng','Hà','Huy','Linh','Mai','Nam','Oanh','Phong','Quỳnh','Sơn','Trang','Vy'] as first_names
),
lead_seed as (
  select
    n,
    lead_names.last_names[((n - 1) % array_length(lead_names.last_names, 1)) + 1] || ' ' ||
      lead_names.middle_names[((n * 2 - 1) % array_length(lead_names.middle_names, 1)) + 1] || ' ' ||
      lead_names.first_names[((n * 4 - 1) % array_length(lead_names.first_names, 1)) + 1] as parent_name,
    lead_names.middle_names[((n * 5 - 1) % array_length(lead_names.middle_names, 1)) + 1] || ' ' ||
      lead_names.first_names[((n * 7 - 1) % array_length(lead_names.first_names, 1)) + 1] as child_name
  from generate_series(1, 500) as n
  cross join lead_names
)
insert into public.leads (
  id, name, phone, email, child_name, child_age, source, status,
  assigned_to, assigned_to_name, campaign_ids, campaign_names, note,
  last_contact_date, next_follow_up, metadata, created_at
)
select
  public.sample_uuid('lead-' || n),
  parent_name,
  '096' || lpad((5000000 + n)::text, 7, '0'),
  'lead' || lpad(n::text, 4, '0') || '@sample.edu.vn',
  child_name,
  6 + (n % 13),
  (array['Facebook','Zalo','Website','Giới thiệu','Walk-in','Khác'])[(n % 6) + 1],
  case
    when n % 20 = 0 then 'Đăng ký'
    when n % 13 = 0 then 'Đã test'
    when n % 11 = 0 then 'Hẹn test'
    when n % 7 = 0 then 'Quan tâm'
    when n % 5 = 0 then 'Đang liên hệ'
    when n % 17 = 0 then 'Từ chối'
    else 'Mới'
  end,
  public.sample_uuid('staff-' || (5 + (n % 2)))::text,
  case when n % 2 = 0 then 'Vũ Ngọc Mai' else 'Đỗ Khánh Linh' end,
  case when n % 2 = 0 then array['sample-camp-summer'] else array['sample-camp-backtoschool'] end,
  case when n % 2 = 0 then array['Tuyển sinh hè'] else array['Back to School'] end,
  'Lead mẫu số ' || n || ' - nhu cầu học lớp ' || (1 + (n % 12)),
  current_date - (n % 45),
  current_date + (1 + (n % 14)),
  jsonb_build_object('seed', 'sample_300_500', 'gradeInterest', 1 + (n % 12)),
  now() - ((n % 120) || ' days')::interval
from lead_seed
on conflict (id) do update set
  name = excluded.name,
  phone = excluded.phone,
  email = excluded.email,
  child_name = excluded.child_name,
  child_age = excluded.child_age,
  source = excluded.source,
  status = excluded.status,
  assigned_to = excluded.assigned_to,
  assigned_to_name = excluded.assigned_to_name,
  campaign_ids = excluded.campaign_ids,
  campaign_names = excluded.campaign_names,
  note = excluded.note,
  last_contact_date = excluded.last_contact_date,
  next_follow_up = excluded.next_follow_up,
  metadata = excluded.metadata,
  created_at = excluded.created_at;

commit;

select
  (select count(*) from public.classes where metadata->>'seed' = 'sample_300_500') as sample_classes,
  (select count(*) from public.students where metadata->>'seed' = 'sample_300_500') as sample_students,
  (select count(*) from public.leads where metadata->>'seed' = 'sample_300_500') as sample_leads,
  (select count(*) from public.contracts where metadata->>'seed' = 'sample_300_500') as sample_contracts,
  (select count(*) from public.attendance where created_by = 'Sample seed') as sample_attendance_records,
  (select count(*) from public.student_attendance where metadata->>'seed' = 'sample_300_500') as sample_student_attendance_records;

select
  c.name as class_name,
  count(s.id) as student_count
from public.classes c
left join public.students s on s.class_id = c.id and s.metadata->>'seed' = 'sample_300_500'
where c.metadata->>'seed' = 'sample_300_500'
group by c.name
order by c.name;



