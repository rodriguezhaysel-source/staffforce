export interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  position: string
  department_id: string
  location_id: string
  hire_date: string
  employment_type: string
  hourly_rate: number
  salary_annual: number
  role: string
  status: string
  geo_exempt: boolean
  language: string
  pin: string
  bank_name: string
  bank_account_type: string
  bank_routing: string
  bank_account: string
  pto_balance: number
  pto_accrual_rate: number
  internal_notes: string
  password_hash: string
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  name: string
  color: string
  manager_id: string
}

export interface Location {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  radius_meters: number
  timezone: string
  currency: string
}

export interface Shift {
  id: string
  employee_id: string
  department_id: string
  location_id: string
  start_time: string
  end_time: string
  position: string
  notes: string
  status: string
  created_by: string
}

export interface TimeEntry {
  id: string
  employee_id: string
  location_id: string
  clock_in: string
  clock_out: string
  break_mins: number
  clock_in_lat: number
  clock_in_lng: number
  clock_out_lat: number
  clock_out_lng: number
  within_geofence: boolean
  notes: string
  status: string
  approved_by: string
}

export interface TimeOff {
  id: string
  employee_id: string
  type: string
  start_date: string
  end_date: string
  days: number
  reason: string
  status: string
  reviewed_by: string
  reviewed_at: string
}

export interface PayrollPeriod {
  id: string
  frequency: string
  start_date: string
  end_date: string
  pay_date: string
  status: string
  paid_at: string
}

export interface PayrollEntry {
  id: string
  period_id: string
  employee_id: string
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
  net_pay: number
  bank_routing: string
  bank_account: string
  bank_account_type: string
  bank_name: string
  status: string
}

export interface Document {
  id: string
  employee_id: string
  name: string
  type: string
  url: string
  expiry_date: string
}

export interface Notification {
  id: string
  employee_id: string
  title: string
  message: string
  type: string
  read: boolean
  created_at: string
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  group_id: string
  content: string
  read: boolean
  created_at: string
}

export interface Availability {
  id: string
  employee_id: string
  day_of_week: number
  available: boolean
  start_time: string
  end_time: string
}

export interface ShiftSwap {
  id: string
  requester_id: string
  target_id: string
  shift_id: string
  target_shift_id: string
  reason: string
  status: string
  approved_by: string
}

export interface JobPosting {
  id: string
  title: string
  department_id: string
  employment_type: string
  location: string
  description: string
  salary_min: number
  salary_max: number
  status: string
  created_by: string
}

export interface Candidate {
  id: string
  job_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  resume_url: string
  rating: number
  stage: string
  notes: string
}

export interface Performance {
  id: string
  employee_id: string
  reviewer_id: string
  period: string
  rating: number
  strengths: string
  improvements: string
  notes: string
}

export interface AppConfig {
  id: number
  company_name: string
  geofencing_enabled: boolean
  payroll_config: any
  theme: any
}

export interface EmployeeBankAccount {
  id: string
  employee_id: string
  nickname: string
  bank_name: string
  account_type: string
  routing_number: string
  account_number: string
  allocation_type: string
  allocation_value: number
  priority: number
  status: string
  approved_by: string
  created_at: string
}

export interface WageAdvance {
  id: string
  employee_id: string
  requested_by: string
  amount: number
  type: string
  reason: string
  status: string
  approved_by: string
  approved_at: string
  paid_at: string
  created_at: string
}

export interface AutomationConfig {
  id: string
  module: string
  enabled: boolean
  rules: any
  created_at: string
  updated_at: string
}

export interface DepartmentBudget {
  id: string
  department_id: string
  week_start: string
  hours_budget: number
  cost_budget: number
  created_at: string
}

export interface OpenShift {
  id: string
  department_id: string
  location_id: string
  start_time: string
  end_time: string
  position: string
  notes: string
  status: string
  claimed_by: string
  claimed_at: string
  created_by: string
  created_at: string
}

export interface Recognition {
  id: string
  from_employee_id: string
  to_employee_id: string
  message: string
  category: string
  created_at: string
}

export interface MoodCheckin {
  id: string
  employee_id: string
  score: number
  note: string
  time_entry_id: string
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  target: string
  created_by: string
  created_at: string
}

export interface OnboardingTask {
  id: string
  employee_id: string
  task: string
  completed: boolean
  completed_at: string
  due_date: string
  created_at: string
}

export interface AuditLog {
  id: string
  employee_id: string
  action: string
  table_name: string
  record_id: string
  old_data: any
  new_data: any
  created_at: string
}

export interface Certification {
  id: string
  employee_id: string
  name: string
  issuer: string
  issued_date: string
  expiry_date: string
  status: string
  created_at: string
}

export interface ExitSurvey {
  id: string
  employee_id: string
  reason: string
  would_return: boolean
  rating: number
  feedback: string
  created_at: string
}
