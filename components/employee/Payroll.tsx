import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtMoney, empName, downloadBlob } from '../../lib/utils'
import { calculateHours, calculatePay, generateNACHA, DEFAULT_PAYROLL_CONFIG } from '../../lib/payroll'
import { Card, Btn, Popup, Inp, Sel, Th, Td, C, StatusBadge, Badge, EmptyState, PageHeader, Kpi } from '../ui'
import type { Employee, PayrollPeriod, PayrollEntry } from '../../types'

interface Props { user: Employee; lang: string; employees: Employee[] }

export default function Payroll({ user, lang, employees }: Props) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [selected, setSelected] = useState<PayrollPeriod | null>(null)
  const [periodModal, setPeriodModal] = useState(false)
  const [paystubOpen, setPaystubOpen] = useState(false)
  const [paystubEntry, setPaystubEntry] = useState<PayrollEntry | null>(null)
  const [newPeriod, setNewPeriod] = useState({ frequency: 'biweekly', start_date: '', end_date: '', pay_date: '' })
  const [running, setRunning] = useState(false)
  const [config, setConfig] = useState(DEFAULT_PAYROLL_CONFIG)

  const canRun = user.role === 'admin'

  useEffect(() => { loadPeriods(); loadConfig() }, [])

  async function loadConfig() {
    const { data } = await supabase.from('app_config').select('payroll_config').limit(1)
    if (data?.[0]?.payroll_config) setConfig({ ...DEFAULT_PAYROLL_CONFIG, ...data[0].payroll_config })
  }

  async function loadPeriods() {
    const { data } = await supabase.from('payroll_periods').select('*').order('start_date', { ascending: false })
    setPeriods(data || [])
  }

  async function loadEntries(p: PayrollPeriod) {
    setSelected(p)
    const { data } = await supabase.from('payroll_entries').select('*').eq('period_id', p.id)
    setEntries(data || [])
  }

  async function createPeriod() {
    if (!newPeriod.start_date || !newPeriod.end_date || !newPeriod.pay_date) return
    await supabase.from('payroll_periods').insert({ ...newPeriod, status: 'draft' })
    setPeriodModal(false); setNewPeriod({ frequency: 'biweekly', start_date: '', end_date: '', pay_date: '' }); loadPeriods()
  }

  async function runPayroll(p: PayrollPeriod) {
    if (!canRun) return
    setRunning(true)
    const { data: te } = await supabase.from('time_entries').select('*').gte('clock_in', p.start_date).lte('clock_in', p.end_date + 'T23:59:59').eq('status', 'approved')
    for (const emp of employees.filter(e => e.status === 'active')) {
      const empEntries = (te || []).filter((e: any) => e.employee_id === emp.id)
      const { regular, overtime } = calculateHours(empEntries)
      const pay = calculatePay(emp, regular, overtime, config)
      // Use first approved bank account if available
      const { data: bankAccts } = await supabase.from('employee_bank_accounts').select('*').eq('employee_id', emp.id).eq('status', 'approved').order('priority').limit(1)
      const bankAcct = bankAccts?.[0]
      await supabase.from('payroll_entries').upsert({
        period_id: p.id, employee_id: emp.id, ...pay,
        bank_routing: bankAcct?.routing_number || emp.bank_routing || '',
        bank_account: bankAcct?.account_number || emp.bank_account || '',
        bank_account_type: bankAcct?.account_type || emp.bank_account_type || '',
        bank_name: bankAcct?.bank_name || emp.bank_name || '',
        status: 'pending'
      }, { onConflict: 'period_id,employee_id' })
    }
    await supabase.from('payroll_periods').update({ status: 'processed' }).eq('id', p.id)
    setRunning(false); loadPeriods(); loadEntries(p)
  }

  async function markPaid(p: PayrollPeriod) {
    if (!canRun) return
    await supabase.from('payroll_periods').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', p.id)
    await supabase.from('payroll_entries').update({ status: 'paid' }).eq('period_id', p.id)
    loadPeriods(); if (selected?.id === p.id) loadEntries(p)
  }

  function exportNACHA() {
    if (!selected) return
    const file = generateNACHA(entries, employees, selected.id)
    downloadBlob(file, `nacha_${selected.pay_date}.txt`, 'text/plain')
  }

  function exportCSV() {
    if (!entries.length) return
    const rows = [['Employee', 'Reg Hours', 'OT Hours', 'Reg Pay', 'OT Pay', 'Gross', 'Federal Tax', 'FICA', 'State Tax', 'Health Ins', '401k', 'Net Pay', 'Status']]
    entries.forEach(e => {
      const emp = employees.find(em => em.id === e.employee_id)
      rows.push([empName(emp), e.regular_hours?.toFixed(2), e.overtime_hours?.toFixed(2), e.regular_pay?.toFixed(2), e.overtime_pay?.toFixed(2), e.gross_pay?.toFixed(2), e.federal_tax?.toFixed(2), e.fica?.toFixed(2), e.state_tax?.toFixed(2), e.health_insurance?.toFixed(2), e.retirement_401k?.toFixed(2), e.net_pay?.toFixed(2), e.status].map(String))
    })
    downloadBlob(rows.map(r => r.join(',')).join('\n'), `payroll_${selected?.pay_date}.csv`, 'text/csv')
  }

  const totalGross = entries.reduce((s, e) => s + (e.gross_pay || 0), 0)
  const totalNet = entries.reduce((s, e) => s + (e.net_pay || 0), 0)
  const totalOT = entries.reduce((s, e) => s + (e.overtime_hours || 0), 0)
  const totalDeductions = entries.reduce((s, e) => s + (e.federal_tax || 0) + (e.fica || 0) + (e.state_tax || 0) + (e.health_insurance || 0) + (e.retirement_401k || 0), 0)

  const paystubEmp = paystubEntry ? employees.find(e => e.id === paystubEntry.employee_id) : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {canRun && <Btn variant="primary" size="sm" onClick={() => setPeriodModal(true)}>+ New Pay Period</Btn>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Periods list */}
        <Card pad={0}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase' as any, letterSpacing: '0.5px' }}>Pay Periods</div>
          {periods.map(p => (
            <div key={p.id} onClick={() => loadEntries(p)} style={{ padding: '13px 16px', borderBottom: `1px solid #F8FAFC`, cursor: 'pointer', background: selected?.id === p.id ? '#EFF6FF' : 'transparent', borderLeft: `3px solid ${selected?.id === p.id ? C.accent : 'transparent'}`, transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{p.start_date} — {p.end_date}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Pay: {p.pay_date} · {p.frequency}</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
          {periods.length === 0 && <EmptyState title="No pay periods" sub="Create your first period" />}
        </Card>

        {/* Entries panel */}
        <div>
          {selected ? (
            <>
              {/* KPIs */}
              {entries.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                  <Kpi label="Total Gross" value={fmtMoney(totalGross)} color={C.accent} />
                  <Kpi label="Total Deductions" value={fmtMoney(totalDeductions)} color={C.danger} />
                  <Kpi label="Total Net" value={fmtMoney(totalNet)} color={C.success} />
                  <Kpi label="OT Hours" value={totalOT.toFixed(1) + 'h'} color={totalOT > 0 ? C.warning : C.textMuted} />
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {canRun && selected.status === 'draft' && (
                  <Btn variant="primary" onClick={() => runPayroll(selected)} disabled={running}>{running ? 'Processing...' : '▶ Run Payroll'}</Btn>
                )}
                {canRun && selected.status === 'processed' && (
                  <>
                    <Btn variant="success" onClick={() => markPaid(selected)}>✓ Mark as Paid</Btn>
                    <Btn variant="secondary" onClick={exportNACHA}>↓ NACHA File ({entries.filter(e => e.bank_routing).length} accts)</Btn>
                  </>
                )}
                {entries.length > 0 && <Btn variant="secondary" onClick={exportCSV}>↓ Export CSV</Btn>}
              </div>

              {/* Entries table */}
              <Card pad={0}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead>
                      <tr>
                        <Th>Employee</Th>
                        <Th>Reg Hrs</Th><Th>OT Hrs</Th>
                        <Th>Gross</Th>
                        <Th>Fed Tax</Th><Th>FICA</Th><Th>State</Th><Th>Health</Th><Th>401k</Th>
                        <Th>Net Pay</Th>
                        <Th>Bank</Th><Th>Status</Th>
                        <Th>Paystub</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(e => {
                        const emp = employees.find(em => em.id === e.employee_id)
                        const totalDed = (e.federal_tax || 0) + (e.fica || 0) + (e.state_tax || 0) + (e.health_insurance || 0) + (e.retirement_401k || 0)
                        return (
                          <tr key={e.id} style={{ borderBottom: `1px solid #F8FAFC` }}>
                            <Td>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{empName(emp)}</div>
                              <div style={{ fontSize: 11, color: C.textSub }}>{emp?.position}</div>
                            </Td>
                            <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.regular_hours?.toFixed(1)}</Td>
                            <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: (e.overtime_hours || 0) > 0 ? C.warning : undefined, fontWeight: (e.overtime_hours || 0) > 0 ? 700 : 400 }}>{e.overtime_hours?.toFixed(1)}</Td>
                            <Td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmtMoney(e.gross_pay)}</Td>
                            <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: C.danger }}>{fmtMoney(e.federal_tax)}</Td>
                            <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: C.danger }}>{fmtMoney(e.fica)}</Td>
                            <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: C.danger }}>{fmtMoney(e.state_tax)}</Td>
                            <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: C.danger }}>{fmtMoney(e.health_insurance)}</Td>
                            <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: C.danger }}>{fmtMoney(e.retirement_401k)}</Td>
                            <Td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: C.success }}>{fmtMoney(e.net_pay)}</Td>
                            <Td style={{ fontSize: 11 }}>
                              {e.bank_routing ? <div><div style={{ fontFamily: 'var(--font-mono)' }}>****{e.bank_routing.slice(-4)}</div><div style={{ color: C.textSub }}>{e.bank_account_type}</div></div> : <span style={{ color: C.textMuted }}>—</span>}
                            </Td>
                            <Td><StatusBadge status={e.status} /></Td>
                            <Td>
                              <Btn variant="ghost" size="sm" onClick={() => { setPaystubEntry(e); setPaystubOpen(true) }}>View</Btn>
                            </Td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {entries.length === 0 && <EmptyState title="No payroll entries" sub={selected.status === 'draft' ? 'Run payroll to generate entries' : 'No data for this period'} />}
                </div>
              </Card>
            </>
          ) : (
            <Card><EmptyState title="Select a pay period" sub="Click a period on the left to view details" /></Card>
          )}
        </div>
      </div>

      {/* Create period modal */}
      <Popup open={periodModal} onClose={() => setPeriodModal(false)} title="New Pay Period">
        <div style={{ padding: '20px 24px' }}>
          <Sel label="Frequency" value={newPeriod.frequency} onChange={e => setNewPeriod(p => ({ ...p, frequency: e.target.value }))}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="semimonthly">Semi-monthly</option>
            <option value="monthly">Monthly</option>
          </Sel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Period Start" type="date" value={newPeriod.start_date} onChange={e => setNewPeriod(p => ({ ...p, start_date: e.target.value }))} />
            <Inp label="Period End" type="date" value={newPeriod.end_date} onChange={e => setNewPeriod(p => ({ ...p, end_date: e.target.value }))} />
          </div>
          <Inp label="Pay Date" type="date" value={newPeriod.pay_date} onChange={e => setNewPeriod(p => ({ ...p, pay_date: e.target.value }))} />
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setPeriodModal(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={createPeriod}>Create Period</Btn>
        </div>
      </Popup>

      {/* Paystub modal */}
      {paystubEntry && paystubEmp && (
        <Popup open={paystubOpen} onClose={() => setPaystubOpen(false)} title="Pay Stub">
          <div style={{ padding: '24px', fontFamily: 'var(--font-mono)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: `2px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font-body)', color: C.text }}>StaffForce</div>
                <div style={{ fontSize: 12, color: C.textSub, fontFamily: 'var(--font-body)' }}>Pay Statement</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: C.textSub }}>Period: {selected?.start_date} — {selected?.end_date}</div>
                <div style={{ fontSize: 12, color: C.textSub }}>Pay Date: {selected?.pay_date}</div>
              </div>
            </div>

            {/* Employee info */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-body)' }}>{empName(paystubEmp)}</div>
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: 'var(--font-body)' }}>{paystubEmp.position} · {paystubEmp.email}</div>
            </div>

            {/* Earnings */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 8, fontFamily: 'var(--font-body)' }}>Earnings</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid #F1F5F9` }}>
                <span style={{ fontSize: 13 }}>Regular Pay ({paystubEntry.regular_hours?.toFixed(2)} hrs)</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtMoney(paystubEntry.regular_pay)}</span>
              </div>
              {(paystubEntry.overtime_hours || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid #F1F5F9`, color: C.warning }}>
                  <span style={{ fontSize: 13 }}>Overtime Pay ({paystubEntry.overtime_hours?.toFixed(2)} hrs @ 1.5x)</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtMoney(paystubEntry.overtime_pay)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `2px solid ${C.border}`, marginTop: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-body)' }}>Gross Pay</span>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{fmtMoney(paystubEntry.gross_pay)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 8, fontFamily: 'var(--font-body)' }}>Deductions</div>
              {[
                { label: 'Federal Income Tax', value: paystubEntry.federal_tax },
                { label: 'FICA (Social Security + Medicare)', value: paystubEntry.fica },
                { label: 'State Income Tax', value: paystubEntry.state_tax },
                { label: 'Health Insurance', value: paystubEntry.health_insurance },
                { label: '401(k) Contribution', value: paystubEntry.retirement_401k },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid #F1F5F9` }}>
                  <span style={{ fontSize: 13 }}>{item.label}</span>
                  <span style={{ fontSize: 13, color: C.danger }}>({fmtMoney(item.value || 0)})</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `2px solid ${C.border}`, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: C.danger, fontFamily: 'var(--font-body)' }}>Total Deductions</span>
                <span style={{ fontSize: 12, color: C.danger }}>({fmtMoney((paystubEntry.federal_tax || 0) + (paystubEntry.fica || 0) + (paystubEntry.state_tax || 0) + (paystubEntry.health_insurance || 0) + (paystubEntry.retirement_401k || 0))})</span>
              </div>
            </div>

            {/* Net pay */}
            <div style={{ background: C.accentLight, border: `2px solid ${C.accentBorder}`, borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: C.accent, fontFamily: 'var(--font-body)' }}>NET PAY</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: C.accent }}>{fmtMoney(paystubEntry.net_pay)}</span>
            </div>

            {/* Bank info */}
            {paystubEntry.bank_routing && (
              <div style={{ marginTop: 16, fontSize: 12, color: C.textSub, fontFamily: 'var(--font-body)' }}>
                Direct Deposit → {paystubEntry.bank_name || 'Bank'} ****{paystubEntry.bank_account?.slice(-4)} ({paystubEntry.bank_account_type})
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end', fontFamily: 'var(--font-body)' }}>
              <Btn variant="secondary" onClick={() => setPaystubOpen(false)}>Close</Btn>
              <Btn variant="primary" onClick={() => {
                const content = `PAY STUB\n\nEmployee: ${empName(paystubEmp)}\nPeriod: ${selected?.start_date} - ${selected?.end_date}\nPay Date: ${selected?.pay_date}\n\nEARNINGS\nRegular (${paystubEntry.regular_hours?.toFixed(2)} hrs): ${fmtMoney(paystubEntry.regular_pay)}\nOvertime (${paystubEntry.overtime_hours?.toFixed(2)} hrs): ${fmtMoney(paystubEntry.overtime_pay)}\nGross Pay: ${fmtMoney(paystubEntry.gross_pay)}\n\nDEDUCTIONS\nFederal Tax: (${fmtMoney(paystubEntry.federal_tax)})\nFICA: (${fmtMoney(paystubEntry.fica)})\nState Tax: (${fmtMoney(paystubEntry.state_tax)})\nHealth Insurance: (${fmtMoney(paystubEntry.health_insurance)})\n401(k): (${fmtMoney(paystubEntry.retirement_401k)})\n\nNET PAY: ${fmtMoney(paystubEntry.net_pay)}`
                downloadBlob(content, `paystub_${paystubEmp.last_name}_${selected?.pay_date}.txt`, 'text/plain')
              }}>↓ Download</Btn>
            </div>
          </div>
        </Popup>
      )}
    </div>
  )
}
