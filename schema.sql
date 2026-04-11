-- =============================================
-- STAFFFORCE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

create table if not exists app_config (
  id serial primary key,
  company_name text default 'StaffForce',
  geofencing_enabled boolean default true,
  payroll_config jsonb,
  theme jsonb
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat numeric,
  lng numeric,
  radius_meters integer default 100,
  timezone text default 'America/New_York',
  currency text default 'USD',
  created_at timestamptz default now()
);

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text default '#0A6EBD',
  manager_id uuid,
  created_at timestamptz default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text unique not null,
  phone text,
  position text,
  department_id uuid references departments(id),
  location_id uuid references locations(id),
  hire_date date,
  employment_type text default 'fulltime',
  hourly_rate numeric default 0,
  salary_annual numeric default 0,
  role text default 'employee',
  status text default 'active',
  geo_exempt boolean default false,
  language text default 'en',
  pin text,
  bank_name text,
  bank_account_type text,
  bank_routing text,
  bank_account text,
  pto_balance numeric default 0,
  pto_accrual_rate numeric default 0,
  internal_notes text,
  password_hash text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  department_id uuid references departments(id),
  location_id uuid references locations(id),
  start_time timestamptz,
  end_time timestamptz,
  position text,
  notes text,
  status text default 'scheduled',
  created_by uuid references employees(id),
  created_at timestamptz default now()
);

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  location_id uuid references locations(id),
  clock_in timestamptz,
  clock_out timestamptz,
  break_mins integer default 0,
  clock_in_lat numeric,
  clock_in_lng numeric,
  clock_out_lat numeric,
  clock_out_lng numeric,
  within_geofence boolean default true,
  notes text,
  status text default 'pending',
  approved_by uuid references employees(id),
  created_at timestamptz default now()
);

create table if not exists time_off (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  type text default 'vacation',
  start_date date,
  end_date date,
  days integer default 1,
  reason text,
  status text default 'pending',
  reviewed_by uuid references employees(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists payroll_periods (
  id uuid primary key default gen_random_uuid(),
  frequency text default 'biweekly',
  start_date date,
  end_date date,
  pay_date date,
  status text default 'draft',
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists payroll_entries (
  id uuid primary key default gen_random_uuid(),
  period_id uuid references payroll_periods(id),
  employee_id uuid references employees(id),
  regular_hours numeric default 0,
  overtime_hours numeric default 0,
  regular_pay numeric default 0,
  overtime_pay numeric default 0,
  gross_pay numeric default 0,
  federal_tax numeric default 0,
  fica numeric default 0,
  state_tax numeric default 0,
  health_insurance numeric default 0,
  retirement_401k numeric default 0,
  net_pay numeric default 0,
  bank_routing text,
  bank_account text,
  bank_account_type text,
  bank_name text,
  status text default 'pending',
  created_at timestamptz default now(),
  unique(period_id, employee_id)
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  name text,
  type text,
  url text,
  expiry_date date,
  created_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  title text,
  message text,
  type text default 'info',
  read boolean default false,
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references employees(id),
  receiver_id uuid references employees(id),
  group_id uuid,
  content text,
  read boolean default false,
  created_at timestamptz default now()
);

create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  day_of_week integer,
  available boolean default true,
  start_time text,
  end_time text,
  unique(employee_id, day_of_week)
);

create table if not exists shift_swaps (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references employees(id),
  target_id uuid references employees(id),
  shift_id uuid references shifts(id),
  target_shift_id uuid references shifts(id),
  reason text,
  status text default 'pending',
  approved_by uuid references employees(id),
  created_at timestamptz default now()
);

create table if not exists job_postings (
  id uuid primary key default gen_random_uuid(),
  title text,
  department_id uuid references departments(id),
  employment_type text default 'fulltime',
  location text,
  description text,
  salary_min numeric,
  salary_max numeric,
  status text default 'open',
  created_by uuid references employees(id),
  created_at timestamptz default now()
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references job_postings(id),
  first_name text,
  last_name text,
  email text,
  phone text,
  resume_url text,
  rating integer default 3,
  stage text default 'applied',
  notes text,
  created_at timestamptz default now()
);

create table if not exists performance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  reviewer_id uuid references employees(id),
  period text,
  rating integer default 5,
  strengths text,
  improvements text,
  notes text,
  created_at timestamptz default now()
);

-- =============================================
-- RLS: anon_all on every table
-- =============================================
do $$
declare
  tbl text;
  tables text[] := array[
    'app_config','locations','departments','employees','shifts',
    'time_entries','time_off','payroll_periods','payroll_entries',
    'documents','notifications','messages','availability',
    'shift_swaps','job_postings','candidates','performance'
  ];
begin
  foreach tbl in array tables loop
    execute format('alter table %I enable row level security', tbl);
    execute format('drop policy if exists anon_all on %I', tbl);
    execute format(
      'create policy anon_all on %I for all to anon using (true) with check (true)',
      tbl
    );
  end loop;
end $$;

-- =============================================
-- SEED: Admin user
-- =============================================
insert into employees (
  first_name, last_name, email, password_hash, role, status,
  employment_type, hourly_rate, salary_annual,
  pto_balance, pto_accrual_rate, geo_exempt, language
) values (
  'Haysel', 'Rodriguez', 'rodriguezhaysel@gmail.com', 'sovel2026',
  'admin', 'active', 'salary', 0, 60000, 15, 0, true, 'en'
) on conflict (email) do update set
  password_hash = 'sovel2026',
  role = 'admin',
  status = 'active';

-- =============================================
-- Enable Realtime on messages and notifications
-- =============================================
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;

-- =============================================
-- NUEVAS TABLAS v2.0
-- =============================================

-- Cuentas bancarias múltiples por empleado
create table if not exists employee_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  nickname text,
  bank_name text,
  account_type text default 'checking',
  routing_number text,
  account_number text,
  allocation_type text default 'remainder', -- 'fixed', 'percent', 'remainder'
  allocation_value numeric default 0,
  priority integer default 1,
  status text default 'pending', -- 'pending', 'approved', 'rejected'
  approved_by uuid references employees(id),
  created_at timestamptz default now()
);

-- Adelantos / pagos directos
create table if not exists wage_advances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  requested_by uuid references employees(id),
  amount numeric not null,
  type text default 'advance', -- 'advance', 'bonus', 'reimbursement', 'tip'
  reason text,
  status text default 'pending', -- 'pending', 'approved', 'rejected', 'paid'
  approved_by uuid references employees(id),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Configuracion de auto-mode por modulo
create table if not exists automation_config (
  id uuid primary key default gen_random_uuid(),
  module text unique, -- 'scheduling', 'timesheets', 'payroll', 'timeoff'
  enabled boolean default false,
  rules jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Budget por departamento
create table if not exists department_budgets (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references departments(id),
  week_start date,
  hours_budget numeric default 0,
  cost_budget numeric default 0,
  created_at timestamptz default now(),
  unique(department_id, week_start)
);

-- Shift marketplace (turnos abiertos)
create table if not exists open_shifts (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references departments(id),
  location_id uuid references locations(id),
  start_time timestamptz,
  end_time timestamptz,
  position text,
  notes text,
  status text default 'open', -- 'open', 'claimed', 'cancelled'
  claimed_by uuid references employees(id),
  claimed_at timestamptz,
  created_by uuid references employees(id),
  created_at timestamptz default now()
);

-- Recognition board
create table if not exists recognitions (
  id uuid primary key default gen_random_uuid(),
  from_employee_id uuid references employees(id),
  to_employee_id uuid references employees(id),
  message text,
  category text default 'general', -- 'teamwork', 'performance', 'attendance', 'general'
  created_at timestamptz default now()
);

-- Mood check-in
create table if not exists mood_checkins (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  score integer, -- 1-5
  note text,
  time_entry_id uuid references time_entries(id),
  created_at timestamptz default now()
);

-- Anuncios grupales
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text,
  body text,
  target text default 'all', -- 'all', department_id
  created_by uuid references employees(id),
  created_at timestamptz default now()
);

-- Onboarding checklist
create table if not exists onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  task text,
  completed boolean default false,
  completed_at timestamptz,
  due_date date,
  created_at timestamptz default now()
);

-- Audit log
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  action text,
  table_name text,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

-- Certificaciones por puesto
create table if not exists certifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  name text,
  issuer text,
  issued_date date,
  expiry_date date,
  status text default 'valid',
  created_at timestamptz default now()
);

-- Encuesta de salida
create table if not exists exit_surveys (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  reason text,
  would_return boolean,
  rating integer,
  feedback text,
  created_at timestamptz default now()
);

-- RLS para nuevas tablas
do $$
declare
  tbl text;
  tables text[] := array[
    'employee_bank_accounts','wage_advances','automation_config',
    'department_budgets','open_shifts','recognitions','mood_checkins',
    'announcements','onboarding_tasks','audit_log','certifications','exit_surveys'
  ];
begin
  foreach tbl in array tables loop
    execute format('alter table %I enable row level security', tbl);
    execute format('drop policy if exists anon_all on %I', tbl);
    execute format('create policy anon_all on %I for all to anon using (true) with check (true)', tbl);
  end loop;
end $$;

-- Automation defaults
insert into automation_config (module, enabled, rules) values
  ('scheduling', false, '{"min_coverage": 1, "respect_availability": true, "respect_timeoff": true, "draft_first": true}'),
  ('timesheets', false, '{"auto_approve_within_minutes": 15, "flag_over_hours": 10}'),
  ('payroll', false, '{"auto_run_on_period_end": true, "require_admin_approval": true}'),
  ('timeoff', false, '{"min_coverage_percent": 50, "auto_approve_vacation": true, "auto_approve_sick": true}')
on conflict (module) do nothing;

-- Invite tokens
create table if not exists invite_tokens (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  token text unique not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);

-- Add avatar_url and notification_prefs to employees
alter table employees add column if not exists avatar_url text;
alter table employees add column if not exists notification_prefs jsonb;

-- Add smtp and other configs to app_config
alter table app_config add column if not exists smtp_config jsonb;
alter table app_config add column if not exists email_template jsonb;
alter table app_config add column if not exists timeoff_config jsonb;
alter table app_config add column if not exists auto_config jsonb;
alter table app_config add column if not exists auto_rules jsonb;
alter table app_config add column if not exists pay_period_config jsonb;
alter table app_config add column if not exists employee_modules jsonb;

-- RLS for invite_tokens
alter table invite_tokens enable row level security;
drop policy if exists anon_all on invite_tokens;
create policy anon_all on invite_tokens for all to anon using (true) with check (true);

-- Supabase Storage bucket (run manually in Storage tab)
-- Create bucket named: staffforce (public)
