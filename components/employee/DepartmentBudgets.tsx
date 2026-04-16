import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns'
import { fmtMoney, entryHours } from '../../lib/utils'
import { Card, Btn, Popup, Inp, Sel, C, EmptyState, PageHeader } from '../ui'
import type { Employee, Department, DepartmentBudget, TimeEntry } from '../../types'

interface Props { user: Employee; lang: string; departments: Department[]; employees: Employee[] }

export default function DepartmentBudgets({ user, lang, departments, employees }: Props) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [budgets, setBudgets] = useState<DepartmentBudget[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ department_id: '', hours_budget: 0, cost_budget: 0 })
  const [saving, setSaving] = useState(false)
  const canEdit = user.role === 'admin' || user.role === 'manager'

  useEffect(() => { load() }, [weekStart])

  async function load() {
    const ws = format(weekStart, 'yyyy-MM-dd')
    const we = format(addWeeks(weekStart, 1), 'yyyy-MM-dd')
    const [b, e] = await Promise.all([
      supabase.from('department_budgets').select('*').eq('week_start', ws),
      supabase.from('time_entries').select('*').gte('clock_in', ws).lte('clock_in', we + 'T23:59:59').not('clock_out', 'is', null),
    ])
    setBudgets(b.data || [])
    setEntries(e.data || [])
  }

  async function save() {
    if (!form.department_id) return
    setSaving(true)
    const ws = format(weekStart, 'yyyy-MM-dd')
    await supabase.from('department_budgets').upsert({
      department_id: form.department_id,
      week_start: ws,
      hours_budget: form.hours_budget,
      cost_budget: form.cost_budget,
    }, { onConflict: 'department_id,week_start' })
    setSaving(false)
    setOpen(false)
    setForm({ department_id: '', hours_budget: 0, cost_budget: 0 })
    load()
  }

  function getDeptActuals(deptId: string): { hours: number; cost: number } {
    const deptEmps = employees.filter(e => e.department_id === deptId)
    let hours = 0, cost = 0
    deptEmps.forEach(emp => {
      const empEntries = entries.filter(e => e.employee_id === emp.id)
      const h = empEntries.reduce((s, e) => s + entryHours(e), 0)
      const rate = emp.hourly_rate || (emp.salary_annual ? emp.salary_annual / 52 / 40 : 0)
      hours += h
      cost += h * rate
    })
    return { hours: Math.round(hours * 10) / 10, cost: Math.round(cost * 100) / 100 }
  }

  return (
    <div>
      <PageHeader title="Department Budgets" sub="Weekly labor hour and cost budgets by department">
        {canEdit && <Btn variant="primary" size="sm" onClick={() => setOpen(true)}>Set Budget</Btn>}
      </PageHeader>

      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Btn variant="secondary" size="sm" onClick={() => setWeekStart(w => subWeeks(w, 1))}>‹ Prev</Btn>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Week of {format(weekStart, 'MMM d, yyyy')}</span>
        <Btn variant="secondary" size="sm" onClick={() => setWeekStart(w => addWeeks(w, 1))}>Next ›</Btn>
        <Btn variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>This Week</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {departments.map(dept => {
          const budget = budgets.find(b => b.department_id === dept.id)
          const actuals = getDeptActuals(dept.id)
          const hoursPct = budget?.hours_budget ? Math.min(100, Math.round(actuals.hours / budget.hours_budget * 100)) : null
          const costPct = budget?.cost_budget ? Math.min(100, Math.round(actuals.cost / budget.cost_budget * 100)) : null
          const hoursOver = budget?.hours_budget ? actuals.hours > budget.hours_budget : false
          const costOver = budget?.cost_budget ? actuals.cost > budget.cost_budget : false

          return (
            <Card key={dept.id} style={{ borderTop: `3px solid ${dept.color || C.accent}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{dept.name}</div>
                <div style={{ fontSize: 12, color: C.textSub }}>{employees.filter(e => e.department_id === dept.id && e.status === 'active').length} staff</div>
              </div>

              {/* Hours */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>Hours</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: hoursOver ? C.danger : C.text }}>
                    {actuals.hours}h {budget?.hours_budget ? `/ ${budget.hours_budget}h` : '(no budget)'}
                  </span>
                </div>
                {budget?.hours_budget ? (
                  <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${hoursPct}%`, background: hoursOver ? C.danger : dept.color || C.accent, borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                ) : (
                  <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: '0%', background: C.accent, borderRadius: 4 }} />
                  </div>
                )}
                {hoursPct !== null && <div style={{ fontSize: 10, color: hoursOver ? C.danger : C.textMuted, marginTop: 3, fontWeight: hoursOver ? 700 : 400 }}>{hoursPct}% used{hoursOver ? ' — OVER BUDGET' : ''}</div>}
              </div>

              {/* Cost */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>Labor Cost</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: costOver ? C.danger : C.text }}>
                    {fmtMoney(actuals.cost)} {budget?.cost_budget ? `/ ${fmtMoney(budget.cost_budget)}` : '(no budget)'}
                  </span>
                </div>
                {budget?.cost_budget ? (
                  <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${costPct}%`, background: costOver ? C.danger : dept.color || C.accent, borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                ) : (
                  <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4 }} />
                )}
                {costPct !== null && <div style={{ fontSize: 10, color: costOver ? C.danger : C.textMuted, marginTop: 3, fontWeight: costOver ? 700 : 400 }}>{costPct}% used{costOver ? ' — OVER BUDGET' : ''}</div>}
              </div>

              {!budget && canEdit && (
                <Btn variant="ghost" size="sm" style={{ marginTop: 12, width: '100%', justifyContent: 'center' } as any} onClick={() => { setForm(f => ({ ...f, department_id: dept.id })); setOpen(true) }}>
                  + Set Budget
                </Btn>
              )}
            </Card>
          )
        })}
      </div>

      {departments.length === 0 && <Card><EmptyState title="No departments" sub="Create departments to track budgets" /></Card>}

      <Popup open={open} onClose={() => setOpen(false)} title="Set Weekly Budget">
        <div style={{ padding: '20px 24px' }}>
          <Sel label="Department" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
            <option value="">Select department...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Sel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Hours Budget" type="number" value={form.hours_budget} onChange={e => setForm(f => ({ ...f, hours_budget: Number(e.target.value) }))} placeholder="e.g. 200" />
            <Inp label="Cost Budget ($)" type="number" value={form.cost_budget} onChange={e => setForm(f => ({ ...f, cost_budget: Number(e.target.value) }))} placeholder="e.g. 4000" />
          </div>
          <div style={{ fontSize: 12, color: C.textSub, background: '#F8FAFC', padding: '10px 12px', borderRadius: 8 }}>
            Setting budget for week of <strong>{format(weekStart, 'MMM d, yyyy')}</strong>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Budget'}</Btn>
        </div>
      </Popup>
    </div>
  )
}
