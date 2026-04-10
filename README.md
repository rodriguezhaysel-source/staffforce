# StaffForce — Workforce Management Platform

## Stack
- Next.js 14 (Pages Router, plain JavaScript — no TypeScript)
- Supabase (direct DB auth, no Supabase Auth)
- CSS custom properties (no Tailwind)

## Deploy to Vercel

### 1. Run schema in Supabase
Go to your Supabase project → SQL Editor → paste `schema.sql` → Run.

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/rodriguezhaysel-source/staffforce
git push -u origin main
```

### 3. Vercel environment variables
Set these in Vercel → Project → Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://dstvfrhyhafxgpauqxbd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Deploy
Vercel will auto-deploy on push.

## Login
- Email: `rodriguezhaysel@gmail.com`
- Password: `sovel2026`

## Modules
1. Dashboard — stats, who's in, today's schedule
2. Clock In/Out — GPS geofencing, live timer
3. Schedule — 7-day grid, add/edit/delete shifts
4. Timesheets — approve/reject, OT highlight, CSV export
5. Time Off — PTO/Sick/Personal/FMLA/Bereavement, balance tracking
6. Availability — per-day toggle + time range
7. Shift Swap — open or targeted, admin approval
8. Employees — full CRUD, 5-tab modal, deactivate
9. Hiring — Kanban pipeline, job postings, convert to employee
10. Messaging — DM conversations
11. Payroll — periods, auto-calc, paystub, NACHA export
12. Reports — hours by employee, labor cost by dept, attendance
13. Documents — expiry tracking, URL links
14. Notifications — mark read/unread/delete
15. Locations — GPS geofence CRUD
16. Settings — company info, password change, departments, CSV export
