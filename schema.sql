-- ─── StaffForce Database Schema ─────────────────────────────────────────────
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New Query)
-- Execute all at once.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── app_config ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  company_name    TEXT DEFAULT 'My Company',
  company_logo    TEXT,
  geofencing_enabled BOOLEAN DEFAULT TRUE,
  payroll_config  JSONB DEFAULT '{}',
  theme           JSONB DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO app_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ─── locations ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  address         TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  radius_meters   INTEGER DEFAULT 100,
  timezone        TEXT DEFAULT 'America/New_York',
  currency        TEXT DEFAULT 'USD',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── departments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  color           TEXT DEFAULT '#6D28D9',
  manager_id      UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── employees ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  email               TEXT UNIQUE,
  phone               TEXT,
  position            TEXT,
  department_id       UUID REFERENCES departments(id) ON DELETE SET NULL,
  location_id         UUID REFERENCES locations(id) ON DELETE SET NULL,
  hire_date           DATE,
  employment_type     TEXT DEFAULT 'hourly' CHECK (employment_type IN ('hourly','salary')),
  hourly_rate         NUMERIC(10,2) DEFAULT 0,
  salary_annual       NUMERIC(12,2) DEFAULT 0,
  role                TEXT DEFAULT 'employee' CHECK (role IN ('admin','manager','employee')),
  status              TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','terminated')),
  geo_exempt          BOOLEAN DEFAULT FALSE,
  language            TEXT DEFAULT 'en',
  pin                 TEXT,
  bank_name           TEXT,
  bank_account_type   TEXT DEFAULT 'checking',
  bank_routing        TEXT,
  bank_account        TEXT,
  pto_balance         NUMERIC(6,2) DEFAULT 0,
  pto_accrual_rate    NUMERIC(8,4) DEFAULT 0,
  internal_notes      TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── shifts ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  position        TEXT,
  notes           TEXT,
  status          TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  created_by      UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shifts_employee_id_idx ON shifts(employee_id);
CREATE INDEX IF NOT EXISTS shifts_start_time_idx ON shifts(start_time);

-- ─── time_entries ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  clock_in        TIMESTAMPTZ NOT NULL,
  clock_out       TIMESTAMPTZ,
  break_mins      INTEGER DEFAULT 0,
  clock_in_lat    DOUBLE PRECISION,
  clock_in_lng    DOUBLE PRECISION,
  clock_out_lat   DOUBLE PRECISION,
  clock_out_lng   DOUBLE PRECISION,
  within_geofence BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by     UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS time_entries_employee_id_idx ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS time_entries_clock_in_idx ON time_entries(clock_in);

-- ─── time_off ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_off (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  type            TEXT DEFAULT 'vacation' CHECK (type IN ('vacation','sick','personal','unpaid')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  days            NUMERIC(4,1),
  reason          TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  reviewed_by     UUID REFERENCES employees(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── payroll_periods ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_periods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frequency       TEXT DEFAULT 'biweekly' CHECK (frequency IN ('weekly','biweekly','monthly')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  pay_date        DATE NOT NULL,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','processing','paid')),
  paid_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── payroll_entries ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id           UUID REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id         UUID REFERENCES employees(id) ON DELETE CASCADE,
  regular_hours       NUMERIC(8,2) DEFAULT 0,
  overtime_hours      NUMERIC(8,2) DEFAULT 0,
  regular_pay         NUMERIC(10,2) DEFAULT 0,
  overtime_pay        NUMERIC(10,2) DEFAULT 0,
  gross_pay           NUMERIC(10,2) DEFAULT 0,
  federal_tax         NUMERIC(10,2) DEFAULT 0,
  fica                NUMERIC(10,2) DEFAULT 0,
  state_tax           NUMERIC(10,2) DEFAULT 0,
  health_insurance    NUMERIC(10,2) DEFAULT 0,
  retirement_401k     NUMERIC(10,2) DEFAULT 0,
  net_pay             NUMERIC(10,2) DEFAULT 0,
  bank_routing        TEXT,
  bank_account        TEXT,
  bank_account_type   TEXT,
  bank_name           TEXT,
  status              TEXT DEFAULT 'draft' CHECK (status IN ('draft','calculated','paid')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, employee_id)
);

-- ─── documents ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT DEFAULT 'other',
  url             TEXT,
  expiry_date     DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  message         TEXT,
  type            TEXT DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
  read            BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_employee_id_idx ON notifications(employee_id);

-- ─── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID REFERENCES employees(id) ON DELETE CASCADE,
  receiver_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  group_id        UUID,
  content         TEXT NOT NULL,
  read            BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_sender_receiver_idx ON messages(sender_id, receiver_id);

-- ─── availability ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  available       BOOLEAN DEFAULT TRUE,
  start_time      TIME,
  end_time        TIME,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, day_of_week)
);

-- ─── shift_swaps ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_swaps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    UUID REFERENCES employees(id) ON DELETE CASCADE,
  target_id       UUID REFERENCES employees(id) ON DELETE CASCADE,
  shift_id        UUID REFERENCES shifts(id) ON DELETE CASCADE,
  target_shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  reason          TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  approved_by     UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── job_postings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_postings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  employment_type TEXT DEFAULT 'fulltime',
  location        TEXT,
  description     TEXT,
  salary_min      NUMERIC(10,2),
  salary_max      NUMERIC(10,2),
  status          TEXT DEFAULT 'open' CHECK (status IN ('open','closed','draft')),
  created_by      UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── candidates ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID REFERENCES job_postings(id) ON DELETE SET NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  resume_url      TEXT,
  rating          INTEGER DEFAULT 3 CHECK (rating BETWEEN 1 AND 5),
  stage           TEXT DEFAULT 'applied' CHECK (stage IN ('applied','screening','interview','offer','hired')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── performance ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS performance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
  period          TEXT,
  rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
  strengths       TEXT,
  improvements    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Storage bucket ──────────────────────────────────────────────────────────
-- Run in Supabase Dashboard → Storage → Create bucket: 'documents' (public)

-- ─── RLS Policies (permissive for development) ────────────────────────────────
-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (use service_role in production for sensitive tables)
CREATE POLICY "anon_all" ON employees FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON shifts FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON time_entries FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON time_off FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON payroll_periods FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON payroll_entries FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON documents FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON notifications FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON messages FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON availability FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON shift_swaps FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON job_postings FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON candidates FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON performance FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON locations FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON departments FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON app_config FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- ─── Realtime ────────────────────────────────────────────────────────────────
-- Enable realtime on notifications and messages
-- In Supabase Dashboard → Database → Replication → Enable for: notifications, messages

-- ─── Seed: First admin employee ───────────────────────────────────────────────
-- After running schema, create one employee manually:
-- INSERT INTO employees (first_name, last_name, email, role, status, employment_type, hourly_rate, salary_annual, pto_balance)
-- VALUES ('Admin', 'User', 'admin@staffforce.com', 'admin', 'active', 'salary', 0, 60000, 15);
--
-- Then create auth user in Supabase Dashboard → Authentication → Users → Add User
-- Use same email: admin@staffforce.com

-- ─── Seed: Admin user Sovel ───────────────────────────────────────────────────
-- STEP 1: Run this SQL to create the employee record:
INSERT INTO employees (
  first_name, last_name, email, role, status,
  employment_type, hourly_rate, salary_annual,
  pto_balance, pto_accrual_rate, geo_exempt, language
) VALUES (
  'Sovel', 'Admin', 'sovel@staffforce.com', 'admin', 'active',
  'salary', 0, 60000, 15, 0, true, 'en'
) ON CONFLICT (email) DO NOTHING;

-- STEP 2: In Supabase Dashboard → Authentication → Users → Add User:
--   Email:    sovel@staffforce.com
--   Password: Sovel1234!
