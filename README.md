# StaffForce v2 — Workforce Management System

Next.js 16 + React 19 + TypeScript + Supabase

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run the schema
Open your Supabase project → SQL Editor → paste and run `schema.sql`

### 4. Create Storage bucket
In Supabase → Storage → New bucket → name it `staffforce` → set to Public

### 5. Configure SMTP (for email invites)
Log in as admin → Settings → Email & SMTP → fill in your SMTP credentials → Save → Test

### 6. Run dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Default Admin Login
```
Email:    rodriguezhaysel@gmail.com
Password: sovel2026
```

---

## Project Structure

```
staffforce-v2/
├── types/index.ts                    # All TypeScript interfaces
├── lib/
│   ├── supabase.ts                   # Supabase client
│   ├── utils.ts                      # Shared utilities
│   ├── payroll.ts                    # Payroll calculations + NACHA
│   └── i18n.ts                       # EN/ES translations
├── components/
│   ├── ui/index.tsx                  # Design system (Avatar, Card, Btn, Badge, ...)
│   └── employee/
│       ├── Login.tsx
│       ├── Dashboard.tsx             # Live stats, coverage chart, late list
│       ├── Schedule.tsx              # Week/2-week/day view, open shifts, labor cost
│       ├── Employees.tsx             # Full profile: certs, onboarding, exit survey
│       ├── Payroll.tsx               # Full deductions, paystub download, NACHA
│       ├── Reports.tsx               # 6 report types with bar chart + CSV export
│       ├── Hiring.tsx                # Job postings + candidate pipeline
│       ├── Settings.tsx              # SMTP, payroll config, automation rules
│       ├── Announcements.tsx         # Company-wide announcements
│       ├── Recognitions.tsx          # Peer recognition board
│       ├── MoodCheckin.tsx           # Daily mood check-in
│       ├── DepartmentBudgets.tsx     # Weekly hour/cost budgets by department
│       ├── Clock.tsx                 # GPS clock in/out with geofencing
│       ├── Timesheets.tsx
│       ├── TimeOff.tsx
│       ├── Availability.tsx
│       ├── ShiftSwap.tsx
│       ├── Locations.tsx
│       ├── Documents.tsx
│       ├── Messaging.tsx             # Real-time direct messages
│       └── Notifications.tsx
├── pages/
│   ├── _app.tsx
│   ├── index.tsx                     # Main app shell with sidebar routing
│   ├── invite.tsx                    # Employee invite acceptance
│   └── api/
│       ├── invite.ts                 # Sends invite email via SMTP
│       └── send-email.ts             # SMTP email sender (reads config from Supabase)
├── styles/globals.css
└── schema.sql                        # Full Supabase schema + seed
```

---

## Key Features vs Original

| Feature | Original | v2 |
|---|---|---|
| Schedule views | Week only | Day / Week / 2-Week |
| Open shifts | None | Full marketplace with claim |
| Labor cost | None | Projected cost header + per-employee week hours |
| Payroll | Basic | Full deduction table, paystub download, NACHA with bank accounts |
| Reports | 4 types, no chart | 6 types, bar chart, department filter, CSV |
| Employees | Basic profile | + Certifications, Onboarding tasks, Exit survey, Photo upload |
| Hiring | Convert uses hardcoded password | Proper invite flow, no hardcoded secrets |
| Settings SMTP | Decorative | Actually sends email, test button, reads config from DB |
| New modules | None | Announcements, Recognitions, Mood Check-in, Department Budgets |
| UI system | Mixed inline/CSS | Unified design system in components/ui/index.tsx |
| Imports | Mixed paths | All normalized to ../../lib/, ../../types |

---

## SMTP Providers

Works with any SMTP provider:
- **SendGrid**: host=`smtp.sendgrid.net`, port=587, user=`apikey`, pass=your_api_key
- **Mailgun**: host=`smtp.mailgun.org`, port=587
- **Resend**: host=`smtp.resend.com`, port=587, user=`resend`, pass=your_api_key
- **Gmail**: host=`smtp.gmail.com`, port=587, user=your@gmail.com, pass=app_password

---

## Roles

| Role | Access |
|---|---|
| `admin` | Full access — all modules, payroll, settings, reports, hiring |
| `manager` | Schedule, timesheets, employees (view/edit), reports |
| `employee` | Clock, own schedule, own timesheets, time off, availability, messaging |
