-- ============================================================
-- StaffForce - Complete Supabase Schema
-- Run this entire script in Supabase SQL Editor (one time)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Departments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Locations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 200,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Employees ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT,
  role TEXT DEFAULT 'employee',         -- admin | manager | supervisor | employee
  status TEXT DEFAULT 'active',         -- active | inactive | terminated
  employment_type TEXT DEFAULT 'hourly',-- hourly | salary | part_time | contractor
  department_id UUID REFERENCES departments(id),
  hourly_rate NUMERIC(10,2) DEFAULT 0,
  salary_annual NUMERIC(12,2) DEFAULT 0,
  pto_balance NUMERIC(6,2) DEFAULT 0,
  pto_accrual_rate NUMERIC(5,2) DEFAULT 0,
  geo_exempt BOOLEAN DEFAULT false,
  hire_date DATE,
  bank_routing TEXT,
  bank_account TEXT,
  bank_type TEXT DEFAULT 'checking',
  notes TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Shifts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Time Entries ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  latitude_in DOUBLE PRECISION,
  longitude_in DOUBLE PRECISION,
  latitude_out DOUBLE PRECISION,
  longitude_out DOUBLE PRECISION,
  notes TEXT,
  status TEXT DEFAULT 'pending',        -- pending | approved | rejected
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Time Off Requests ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                   -- pto | sick | personal | unpaid | fmla | bereavement
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'pending',        -- pending | approved | denied
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Availability ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,         -- 0=Mon, 6=Sun
  available BOOLEAN DEFAULT false,
  start_time TEXT DEFAULT '09:00',
  end_time TEXT DEFAULT '17:00',
  UNIQUE(employee_id, day_of_week)
);

-- ── Shift Swaps ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_swaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  target_employee_id UUID REFERENCES employees(id),
  shift_id UUID REFERENCES shifts(id),
  reason TEXT,
  status TEXT DEFAULT 'pending',        -- pending | approved | denied
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Payroll Periods ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  pay_date DATE,
  status TEXT DEFAULT 'draft',          -- draft | calculated | paid
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Payroll Entries ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_period_id UUID REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  regular_hours NUMERIC(8,2) DEFAULT 0,
  ot_hours NUMERIC(8,2) DEFAULT 0,
  regular_pay NUMERIC(10,2) DEFAULT 0,
  ot_pay NUMERIC(10,2) DEFAULT 0,
  gross_pay NUMERIC(10,2) DEFAULT 0,
  fica NUMERIC(10,2) DEFAULT 0,
  fed_tax NUMERIC(10,2) DEFAULT 0,
  state_tax NUMERIC(10,2) DEFAULT 0,
  net_pay NUMERIC(10,2) DEFAULT 0,
  bank_routing TEXT,
  bank_account TEXT,
  status TEXT DEFAULT 'calculated',
  UNIQUE(payroll_period_id, employee_id)
);

-- ── Documents ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'other',            -- contract | id | certification | tax | i9 | other
  expiry_date DATE,
  url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Job Postings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  department TEXT,
  employment_type TEXT DEFAULT 'full_time',
  location TEXT,
  salary_range TEXT,
  description TEXT,
  status TEXT DEFAULT 'open',           -- open | closed | paused
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Candidates ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  job_id UUID REFERENCES job_postings(id),
  stage TEXT DEFAULT 'Applied',         -- Applied | Screening | Interview | Offer | Hired
  rating INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'info',             -- info | success | warning | danger
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── App Config ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS: Disable for all tables (app handles auth) ───────────
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE availability DISABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swaps DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods DISABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings DISABLE ROW LEVEL SECURITY;
ALTER TABLE candidates DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_config DISABLE ROW LEVEL SECURITY;

-- ── Seed: Admin User ─────────────────────────────────────────
INSERT INTO employees (
  first_name, last_name, email, password_hash, role, status,
  employment_type, hourly_rate, salary_annual,
  pto_balance, pto_accrual_rate, geo_exempt, language
) VALUES (
  'Haysel', 'Rodriguez', 'rodriguezhaysel@gmail.com', 'sovel2026',
  'admin', 'active', 'salary', 0, 60000, 15, 15, true, 'en'
) ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  status = EXCLUDED.status;

-- ── Seed: Default Department ─────────────────────────────────
INSERT INTO departments (name, description)
VALUES ('General', 'Default department')
ON CONFLICT DO NOTHING;

-- ── Seed: App Config ─────────────────────────────────────────
INSERT INTO app_config (key, value)
VALUES ('company_name', 'My Company')
ON CONFLICT (key) DO NOTHING;

-- Done! Login: rodriguezhaysel@gmail.com / sovel2026
