# StaffForce v3 — Next.js + Supabase + Capacitor

## Stack
- **Frontend:** Next.js 15 + TypeScript
- **Database:** Supabase (PostgreSQL)
- **Mobile:** Capacitor (iOS + Android)
- **Auth:** Supabase Auth (email) + Custom PIN system

---

## 1. Supabase Setup

1. Go to https://supabase.com → New Project
2. Dashboard → SQL Editor → New Query
3. Paste the contents of `supabase-schema.sql` and run it
4. Go to Settings → API → copy `URL` and `anon public` key

---

## 2. Environment Variables

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## 3. Run Web App

```bash
npm install
npm run dev
# Opens at http://localhost:3000
```

**Default login:**
- Create a user in Supabase → Auth → Add User
- Set user metadata: `{ "role": "admin" }`
- Or create employee with PIN and use PIN login

---

## 4. Build for Capacitor (Mobile)

### Prerequisites
- Xcode (iOS) or Android Studio (Android)
- Node.js 18+

### Steps
```bash
# Install dependencies
npm install

# Add platforms (first time only)
npm run cap:add:ios
npm run cap:add:android

# Build and sync
npm run cap:sync

# Open in Xcode
npm run cap:open:ios

# Open in Android Studio
npm run cap:open:android
```

### iOS — Info.plist (required for GPS)
Add to your `ios/App/App/Info.plist`:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>StaffForce needs your location to verify you are within the work area before clocking in or out.</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>StaffForce needs your location to verify you are within the work area.</string>
```

---

## Geofencing Rules

- **Enabled globally** in Settings → Geofencing toggle
- **Per location** in Locations → Edit → Enable Geofencing → set lat/lng/radius
- **Per employee** — "Geo Exempt" toggle to bypass for remote workers
- If employee is **outside the area** → cannot clock in OR out — period
- If employee **denies GPS** → blocked
- Works with **native Capacitor GPS** on mobile (more accurate than browser)
- Also works with **browser geolocation** on web

---

## Languages
- **English** and **Spanish** only
- Toggle in top bar (EN ↔ ES) or login screen
- Employee sets preferred language in their profile
- Payroll deduction names are bilingual (en/es stored in config)

---

## Features
- Dashboard with live stats
- Clock In/Out with geofencing (GPS native on mobile)
- Schedule / shifts per employee
- Timesheets with geo distance log
- Payroll — preview, run, history, paystubs
- Reports — hours, by department, PTO
- Time off — request, approve, reject
- Locations — manage multiple properties
- Documents — with expiry tracking
- Settings — deductions, OT rules, PTO accrual
- Employee profiles + salary history
- Permissions per employee (9 toggleable)
- Notifications

---

## Deploy to Vercel (Web)

```bash
# Push to GitHub
git init && git add . && git commit -m "StaffForce v3"
git remote add origin https://github.com/youruser/staffforce
git push -u origin main

# Vercel → Import → add env vars → Deploy
```
