-- ============================================================
-- STAFFFORCE — Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── LOCATIONS ──────────────────────────────────────────────
create table locations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text default 'office',          -- hotel | restaurant | office | retail
  address text,
  phone text,
  email text,
  manager text,
  timezone text default 'UTC',
  currency text default 'USD',
  currency_symbol text default '$',
  -- Geofencing
  geo_lat double precision,
  geo_lng double precision,
  geo_radius integer default 100,       -- meters
  geo_enabled boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

-- ── DEPARTMENTS ─────────────────────────────────────────────
create table departments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location_id uuid references locations(id) on delete cascade,
  color text default '#7C3AED',
  created_at timestamptz default now()
);

-- ── EMPLOYEES ───────────────────────────────────────────────
create table employees (
  id uuid primary key default uuid_generate_v4(),
  -- Identity
  first text not null,
  last text not null,
  email text,
  phone text,
  dob date,
  gender text,
  address text,
  photo_url text,
  avatar_color text default '#7C3AED',
  -- Job
  dept text,
  title text,
  location_id uuid references locations(id),
  type text default 'Full-time',        -- Full-time | Part-time | Contract | Seasonal
  status text default 'active',         -- active | inactive | terminated
  start_date date,
  end_date date,
  -- Compensation
  wage_type text default 'hourly',      -- hourly | salary
  hourly_rate numeric(10,2) default 12.00,
  annual_salary numeric(12,2),
  -- Auth
  pin text,                             -- 4-6 digit PIN for kiosk clock
  auth_user_id uuid,                    -- links to Supabase auth.users
  -- PTO
  pto_balance numeric(8,2) default 80,
  pto_used numeric(8,2) default 0,
  pto_accrual_rate numeric(8,4) default 0.0385, -- hrs PTO per hr worked
  -- Emergency
  emergency_contact text,
  emergency_phone text,
  -- App
  lang text default 'en',              -- en | es
  geo_exempt boolean default false,
  permissions jsonb default '{"schedule":true,"timeoff":true,"hours":true,"payroll":false,"team":false,"documents":true,"clockin":true,"profile":true,"reports":false}',
  notes text,
  certifications text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── SALARY HISTORY ──────────────────────────────────────────
create table salary_history (
  id uuid primary key default uuid_generate_v4(),
  emp_id uuid not null references employees(id) on delete cascade,
  wage_type text,
  hourly_rate numeric(10,2),
  annual_salary numeric(12,2),
  effective_date date not null,
  reason text,
  changed_by text,
  created_at timestamptz default now()
);

-- ── SHIFTS ──────────────────────────────────────────────────
create table shifts (
  id uuid primary key default uuid_generate_v4(),
  emp_id uuid not null references employees(id) on delete cascade,
  location_id uuid references locations(id),
  date date not null,
  start_time time,
  end_time time,
  dept text,
  position text,
  notes text,
  published boolean default false,
  created_by uuid,
  created_at timestamptz default now()
);

-- ── TIME ENTRIES ─────────────────────────────────────────────
create table time_entries (
  id uuid primary key default uuid_generate_v4(),
  emp_id uuid not null references employees(id) on delete cascade,
  location_id uuid references locations(id),
  date date not null,
  clock_in time,
  clock_out time,
  -- Geofencing data
  clock_in_lat double precision,
  clock_in_lng double precision,
  clock_in_distance numeric(10,2),      -- meters from location center
  clock_out_lat double precision,
  clock_out_lng double precision,
  clock_out_distance numeric(10,2),
  within_geofence boolean default true,
  -- Hours
  break_mins integer default 0,
  total_hours numeric(6,2),             -- computed: (clock_out - clock_in - break) in hours
  overtime_hours numeric(6,2) default 0,
  -- Extras
  dept text,
  tips numeric(10,2) default 0,
  sales numeric(10,2) default 0,
  -- Status
  status text default 'open',          -- open | complete | approved | rejected
  notes text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- ── TIME OFF ─────────────────────────────────────────────────
create table time_off (
  id uuid primary key default uuid_generate_v4(),
  emp_id uuid not null references employees(id) on delete cascade,
  type text default 'vacation',        -- vacation | sick | personal | unpaid | bereavement
  date_from date not null,
  date_to date not null,
  hours numeric(6,2) default 8,
  reason text,
  status text default 'pending',       -- pending | approved | rejected
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- ── PAYROLL PERIODS ──────────────────────────────────────────
create table payroll_periods (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id),
  date_from date not null,
  date_to date not null,
  frequency text default 'biweekly',
  status text default 'draft',         -- draft | processed | paid
  total_gross numeric(14,2) default 0,
  total_deductions numeric(14,2) default 0,
  total_net numeric(14,2) default 0,
  total_tips numeric(14,2) default 0,
  total_employees integer default 0,
  processed_by text,
  processed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- ── PAYROLL ENTRIES ──────────────────────────────────────────
create table payroll_entries (
  id uuid primary key default uuid_generate_v4(),
  period_id uuid not null references payroll_periods(id) on delete cascade,
  emp_id uuid not null references employees(id) on delete cascade,
  -- Hours
  regular_hours numeric(8,2) default 0,
  overtime_hours numeric(8,2) default 0,
  overtime_daily_hours numeric(8,2) default 0,
  -- Pay
  hourly_rate numeric(10,2) default 0,
  gross numeric(12,2) default 0,
  tips numeric(10,2) default 0,
  bonuses numeric(10,2) default 0,
  -- Deductions (stored as JSONB array)
  deductions jsonb default '[]',
  total_deductions numeric(12,2) default 0,
  net numeric(12,2) default 0,
  -- Status
  status text default 'pending',       -- pending | paid
  paystub_sent boolean default false,
  created_at timestamptz default now()
);

-- ── DOCUMENTS ───────────────────────────────────────────────
create table documents (
  id uuid primary key default uuid_generate_v4(),
  emp_id uuid references employees(id) on delete cascade,
  name text not null,
  category text,                       -- contract | id | certification | health | tax | other
  file_url text,
  required_by text,
  expiry_date date,
  status text default 'active',        -- active | expired | pending
  created_at timestamptz default now()
);

-- ── PERFORMANCE ─────────────────────────────────────────────
create table performance (
  id uuid primary key default uuid_generate_v4(),
  emp_id uuid not null references employees(id) on delete cascade,
  period text,
  rating integer check (rating between 1 and 5),
  reviewer text,
  strengths text,
  improvements text,
  notes text,
  created_at timestamptz default now()
);

-- ── NOTIFICATIONS ────────────────────────────────────────────
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  emp_id uuid references employees(id) on delete cascade,
  type text,
  title text,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- ── APP CONFIG ───────────────────────────────────────────────
create table app_config (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  value text,
  updated_at timestamptz default now()
);

-- ── AUDIT LOG ────────────────────────────────────────────────
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid,
  action text not null,
  table_name text,
  record_id uuid,
  details text,
  ip_address text,
  created_at timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- INDEXES — for performance
-- ══════════════════════════════════════════════════════════════
create index idx_time_entries_emp_id on time_entries(emp_id);
create index idx_time_entries_date on time_entries(date);
create index idx_time_entries_status on time_entries(status);
create index idx_shifts_emp_id on shifts(emp_id);
create index idx_shifts_date on shifts(date);
create index idx_payroll_entries_period on payroll_entries(period_id);
create index idx_payroll_entries_emp on payroll_entries(emp_id);
create index idx_salary_history_emp on salary_history(emp_id);
create index idx_time_off_emp on time_off(emp_id);
create index idx_time_off_status on time_off(status);
create index idx_notifications_emp on notifications(emp_id);
create index idx_notifications_read on notifications(read);

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════
alter table locations enable row level security;
alter table departments enable row level security;
alter table employees enable row level security;
alter table salary_history enable row level security;
alter table shifts enable row level security;
alter table time_entries enable row level security;
alter table time_off enable row level security;
alter table payroll_periods enable row level security;
alter table payroll_entries enable row level security;
alter table documents enable row level security;
alter table performance enable row level security;
alter table notifications enable row level security;
alter table app_config enable row level security;
alter table audit_log enable row level security;

-- Public read policy (adjust as needed — tighten per use case)
create policy "public_all" on locations for all using (true) with check (true);
create policy "public_all" on departments for all using (true) with check (true);
create policy "public_all" on employees for all using (true) with check (true);
create policy "public_all" on salary_history for all using (true) with check (true);
create policy "public_all" on shifts for all using (true) with check (true);
create policy "public_all" on time_entries for all using (true) with check (true);
create policy "public_all" on time_off for all using (true) with check (true);
create policy "public_all" on payroll_periods for all using (true) with check (true);
create policy "public_all" on payroll_entries for all using (true) with check (true);
create policy "public_all" on documents for all using (true) with check (true);
create policy "public_all" on performance for all using (true) with check (true);
create policy "public_all" on notifications for all using (true) with check (true);
create policy "public_all" on app_config for all using (true) with check (true);
create policy "public_all" on audit_log for all using (true) with check (true);

-- ══════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ══════════════════════════════════════════════════════════════

-- Auto-update updated_at on employees
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger employees_updated_at
  before update on employees
  for each row execute function update_updated_at();

-- Auto-compute total_hours on time_entries insert/update
create or replace function compute_total_hours()
returns trigger as $$
begin
  if new.clock_in is not null and new.clock_out is not null then
    new.total_hours = greatest(0,
      extract(epoch from (new.clock_out - new.clock_in)) / 3600
      - (coalesce(new.break_mins, 0) / 60.0)
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger time_entries_compute_hours
  before insert or update on time_entries
  for each row execute function compute_total_hours();

-- ══════════════════════════════════════════════════════════════
-- DEFAULT SEED DATA
-- ══════════════════════════════════════════════════════════════

-- Default location
insert into locations (name, type, address, currency, currency_symbol, geo_enabled)
values ('Main Property', 'hotel', '123 Main St', 'USD', '$', false);

-- Default config
insert into app_config (key, value) values
  ('company_name', 'My Company'),
  ('lang', 'en'),
  ('payroll_frequency', 'biweekly'),
  ('ot_threshold_weekly', '40'),
  ('ot_threshold_daily', '8'),
  ('ot_multiplier', '1.5'),
  ('pto_accrual_enabled', 'true'),
  ('pto_accrual_rate', '0.0385'),
  ('geo_enabled', 'false'),
  ('currency_symbol', '$'),
  ('deductions', '[{"id":1,"name":"Federal Tax","name_es":"Impuesto Federal","type":"percent","value":12,"active":true},{"id":2,"name":"FICA","name_es":"FICA","type":"percent","value":7.65,"active":true},{"id":3,"name":"State Tax","name_es":"Impuesto Estatal","type":"percent","value":4,"active":true},{"id":4,"name":"Health Insurance","name_es":"Seguro Médico","type":"fixed","value":50,"active":false},{"id":5,"name":"401k","name_es":"401k","type":"percent","value":3,"active":false}]');
