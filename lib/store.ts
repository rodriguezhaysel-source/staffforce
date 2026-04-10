// ─── Core Types ───────────────────────────────────────────────────────────────

export type Lang = 'en' | 'es'
export type Role = 'admin' | 'manager' | 'employee'
export type EmploymentType = 'hourly' | 'salary'
export type EmployeeStatus = 'active' | 'inactive' | 'terminated'
export type TimeEntryStatus = 'pending' | 'approved' | 'rejected'
export type ShiftStatus = 'scheduled' | 'completed' | 'no_show'
export type TimeOffStatus = 'pending' | 'approved' | 'denied'
export type TimeOffType = 'vacation' | 'sick' | 'personal' | 'unpaid'
export type PayrollFrequency = 'weekly' | 'biweekly' | 'monthly'
export type PayrollStatus = 'open' | 'processing' | 'paid'
export type DocumentType = 'id' | 'license' | 'contract' | 'certification' | 'other'
export type DocumentStatus = 'active' | 'expired' | 'expiring_soon'
export type NotificationType = 'info' | 'warning' | 'success' | 'payroll'
export type CandidateStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
export type JobPostingStatus = 'open' | 'closed' | 'filled'
export type SwapStatus = 'pending' | 'approved' | 'denied'

// ─── Tables ───────────────────────────────────────────────────────────────────

export interface Location {
  id: string
  name: string
  address?: string
  lat?: number
  lng?: number
  radius_meters: number
  timezone: string
  currency: string
  created_at: string
}

export interface Department {
  id: string
  location_id?: string
  name: string
  color: string
  created_at: string
}

export interface Employee {
  id: string
  location_id?: string
  department_id?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  role: Role
  position?: string
  employment_type: EmploymentType
  hourly_rate: number
  salary_annual: number
  hire_date?: string
  status: EmployeeStatus
  geo_exempt: boolean
  language: Lang
  pin?: string
  bank_name?: string
  bank_account_type?: string
  bank_routing?: string
  bank_account?: string
  pto_balance: number
  pto_accrual_rate: number
  internal_notes?: string
  created_at: string
  // joined
  department?: Department
  location?: Location
}

export interface SalaryHistory {
  id: string
  employee_id: string
  old_rate?: number
  new_rate?: number
  change_type?: string
  reason?: string
  changed_by?: string
  changed_at: string
}

export interface Shift {
  id: string
  employee_id?: string
  location_id?: string
  department_id?: string
  start_time: string
  end_time: string
  position?: string
  notes?: string
  status: ShiftStatus
  created_at: string
  // joined
  employee?: Employee
  department?: Department
}

export interface TimeEntry {
  id: string
  employee_id?: string
  location_id?: string
  clock_in: string
  clock_out?: string
  clock_in_lat?: number
  clock_in_lng?: number
  clock_out_lat?: number
  clock_out_lng?: number
  within_geofence?: boolean
  break_mins: number
  notes?: string
  status: TimeEntryStatus
  approved_by?: string
  created_at: string
  // joined
  employee?: Employee
}

export interface TimeOff {
  id: string
  employee_id?: string
  type: TimeOffType
  start_date: string
  end_date: string
  days?: number
  reason?: string
  status: TimeOffStatus
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  // joined
  employee?: Employee
}

export interface PayrollPeriod {
  id: string
  location_id?: string
  start_date: string
  end_date: string
  pay_date: string
  frequency: PayrollFrequency
  status: PayrollStatus
  paid_at?: string
  paid_by?: string
  created_at: string
}

export interface PayrollEntry {
  id: string
  period_id?: string
  employee_id?: string
  regular_hours: number
  overtime_hours: number
  regular_pay: number
  overtime_pay: number
  gross_pay: number
  federal_tax: number
  fica: number
  state_tax: number
  health_insurance: number
  retirement_401k: number
  other_deductions: number
  net_pay: number
  bank_name?: string
  bank_routing?: string
  bank_account?: string
  bank_account_type?: string
  created_at: string
  // joined
  employee?: Employee
  period?: PayrollPeriod
}

export interface Document {
  id: string
  employee_id?: string
  name: string
  type?: DocumentType
  file_url?: string
  expiry_date?: string
  status: DocumentStatus
  notes?: string
  uploaded_by?: string
  created_at: string
  // joined
  employee?: Employee
}

export interface Performance {
  id: string
  employee_id?: string
  reviewer_id?: string
  rating?: number
  period?: string
  strengths?: string
  improvements?: string
  notes?: string
  created_at: string
}

export interface Notification {
  id: string
  employee_id?: string
  title: string
  message?: string
  type: NotificationType
  read: boolean
  created_at: string
}

export interface AppConfig {
  key: string
  value: string
  updated_at: string
}

export interface AuditLog {
  id: string
  employee_id?: string
  action: string
  table_name?: string
  record_id?: string
  old_value?: Record<string, unknown>
  new_value?: Record<string, unknown>
  ip_address?: string
  created_at: string
}

export interface Message {
  id: string
  sender_id?: string
  recipient_id?: string
  group_id?: string
  content: string
  read: boolean
  created_at: string
  // joined
  sender?: Employee
  recipient?: Employee
}

export interface Availability {
  id: string
  employee_id?: string
  day_of_week: number
  available: boolean
  start_time?: string
  end_time?: string
  notes?: string
  updated_at: string
}

export interface ShiftSwap {
  id: string
  requester_id?: string
  target_id?: string
  shift_id?: string
  target_shift_id?: string
  reason?: string
  status: SwapStatus
  approved_by?: string
  created_at: string
  // joined
  requester?: Employee
  target?: Employee
  shift?: Shift
  target_shift?: Shift
}

export interface JobPosting {
  id: string
  location_id?: string
  title: string
  department_id?: string
  description?: string
  requirements?: string
  hourly_rate_min?: number
  hourly_rate_max?: number
  status: JobPostingStatus
  created_at: string
  // joined
  department?: Department
}

export interface Candidate {
  id: string
  job_id?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  resume_url?: string
  stage: CandidateStage
  notes?: string
  rating?: number
  created_at: string
  // joined
  job?: JobPosting
}

// ─── App State Types ───────────────────────────────────────────────────────────

export type Page =
  | 'dashboard'
  | 'clockinout'
  | 'schedule'
  | 'timesheets'
  | 'timeoff'
  | 'availability'
  | 'shiftswap'
  | 'employees'
  | 'hiring'
  | 'messaging'
  | 'payroll'
  | 'reports'
  | 'documents'
  | 'notifications'
  | 'locations'
  | 'settings'

export interface ThemeConfig {
  bg: string
  bg2: string
  bg3: string
  bg4: string
  border: string
  border2: string
  v: string
  v2: string
  v3: string
  v4: string
  text: string
  text2: string
  text3: string
  text4: string
  success: string
  warning: string
  danger: string
  info: string
}

export const defaultTheme: ThemeConfig = {
  bg: '#F4F6F9',
  bg2: '#FFFFFF',
  bg3: '#F0F2F5',
  bg4: '#E8EBF0',
  border: '#E2E6EC',
  border2: '#D0D6DF',
  v: '#0A6EBD',
  v2: '#0860A8',
  v3: '#1A7FD4',
  v4: '#4FA3E3',
  text: '#111827',
  text2: '#374151',
  text3: '#6B7280',
  text4: '#9CA3AF',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
}

export interface PayrollConfig {
  dailyOtThreshold: number
  weeklyOtThreshold: number
  otMultiplier: number
  federalTaxPct: number
  ficaPct: number
  stateTaxPct: number
  healthInsurance: number
  retirement401kPct: number
}

export const defaultPayrollConfig: PayrollConfig = {
  dailyOtThreshold: 8,
  weeklyOtThreshold: 40,
  otMultiplier: 1.5,
  federalTaxPct: 0.12,
  ficaPct: 0.0765,
  stateTaxPct: 0.04,
  healthInsurance: 50,
  retirement401kPct: 0.03,
}
