import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtMoney, empName, downloadBlob } from '../../lib/utils'
import { calculateHours, calculatePay, generateNACHA, DEFAULT_PAYROLL_CONFIG } from '../../lib/payroll'
import { ACard, ABtn, AModal, AInp, ASel, APageHeader, AStatusBadge, AKpi, AEmpty, AC } from './ui'
import type { Employee, PayrollPeriod, PayrollEntry } from '../../types'

interface Props { user: Employee; employees: Employee[] }

export default function AdminPayroll({ user, employees }: Props) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [selected, setSelected] = useState<PayrollPeriod | null>(null)
  const [periodModal, setPeriodModal] = useState(false)
  const [paystubEntry, setPaystubEntry] = useState<PayrollEntry | null>(null)
  const [paystubOpen, setPaystubOpen] = useState(false)
  const [newPeriod, setNewPeriod] = useState({ frequency: 'biweekly', start_date: '', end_date: '', pay_date: '' })
  const [running, setRunning] = useState(false)

  useEffect(() => { loadPeriods() }, [])

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
    setRunning(true)
    const { data: cfgData } = await supabase.from('app_config').select('payroll_config').limit(1)
    const cfg = { ...DEFAULT_PAYROLL_CONFIG, ...(cfgData?.[0]?.payroll_config || {}) }
    const { data: te } = await supabase.from('time_entries').select('*').gte('clock_in', p.start_date).lte('clock_in', p.end_date + 'T23:59:59').eq('status', 'approved')
    for (const emp of employees.filter(e => e.status === 'active')) {
      const empEntries = (te || []).filter((e: any) => e.employee_id === emp.id)
      const { regular, overtime } = calculateHours(empEntries)
      const pay = calculatePay(emp, regular, overtime, cfg)
      const { data: bankAccts } = await supabase.from('employee_bank_accounts').select('*').eq('employee_id', emp.id).eq('status', 'approved').order('priority').limit(1)
      const bank = bankAccts?.[0]
      await supabase.from('payroll_entries').upsert({
        period_id: p.id, employee_id: emp.id, ...pay,
        bank_routing: bank?.routing_number || emp.bank_routing || '',
        bank_account: bank?.account_number || emp.bank_account || '',
        bank_account_type: bank?.account_type || emp.bank_account_type || '',
        bank_name: bank?.bank_name || emp.bank_name || '',
        status: 'pending'
      }, { onConflict: 'period_id,employee_id' })
    }
    await supabase.from('payroll_periods').update({ status: 'processed' }).eq('id', p.id)
    setRunning(false); loadPeriods(); loadEntries(p)
  }

  async function markPaid(p: PayrollPeriod) {
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
    const rows = [['Employee', 'Reg Hrs', 'OT Hrs', 'Regular Pay', 'OT Pay', 'Gross', 'Fed Tax', 'FICA', 'State Tax', 'Health Ins', '401k', 'Net Pay', 'Status']]
    entries.forEach(e => {
      const emp = employees.find(em => em.id === e.employee_id)
      rows.push([empName(emp), e.regular_hours?.toFixed(2), e.overtime_hours?.toFixed(2), e.regular_pay?.toFixed(2), e.overtime_pay?.toFixed(2), e.gross_pay?.toFixed(2), e.federal_tax?.toFixed(2), e.fica?.toFixed(2), e.state_tax?.toFixed(2), e.health_insurance?.toFixed(2), e.retirement_401k?.toFixed(2), e.net_pay?.toFixed(2), e.status].map(String))
    })
    downloadBlob(rows.map(r => r.join(',')).join('\n'), `payroll_${selected?.pay_date}.csv`, 'text/csv')
  }

  const totalGross = entries.reduce((s, e) => s + (e.gross_pay || 0), 0)
  const totalNet = entries.reduce((s, e) => s + (e.net_pay || 0), 0)
  const totalOT = entries.reduce((s, e) => s + (e.overtime_hours || 0), 0)
  const totalDed = entries.reduce((s, e) => s + (e.federal_tax || 0) + (e.fica || 0) + (e.state_tax || 0) + (e.health_insurance || 0) + (e.retirement_401k || 0), 0)
  const paystubEmp = paystubEntry ? employees.find(e => e.id === paystubEntry.employee_id) : null

  return (
    <div>
      <APageHeader title="Payroll" sub="Process and manage employee payroll">
        <ABtn variant="primary" size="sm" onClick={() => setPeriodModal(true)}>+ New Pay Period</ABtn>
      </APageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Periods list */}
        <ACard pad={0}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${AC.border}`, fontSize: 11, fontWeight: 800, color: AC.muted, textTransform: 'uppercase' as any, letterSpacing: '0.5px' }}>Pay Periods</div>
          {periods.map(p => (
            <div key={p.id} onClick={() => loadEntries(p)} style={{ padding: '12px 16px', borderBottom: `1px solid #F3F4F6`, cursor: 'pointer', background: selected?.id === p.id ? '#EFF6FF' : 'transparent', borderLeft: `3px solid ${selected?.id === p.id ? AC.accent : 'transparent'}`, transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{p.start_date} — {p.end_date}</div>
                  <div style={{ fontSize: 11, color: AC.muted, marginTop: 2 }}>Pay: {p.pay_date}</div>
                </div>
                <AStatusBadge status={p.status} />
              </div>
            </div>
          ))}
          {periods.length === 0 && <AEmpty title="No periods" sub="Create first period" />}
        </ACard>

        {/* Entries */}
        <div>
          {selected ? (
            <>
              {entries.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                  <AKpi label="Total Gross" value={fmtMoney(totalGross)} color={AC.accent} accent={AC.accent} />
                  <AKpi label="Deductions" value={fmtMoney(totalDed)} color={AC.danger} accent={AC.danger} />
                  <AKpi label="Total Net" value={fmtMoney(totalNet)} color={AC.success} accent={AC.success} />
                  <AKpi label="OT Hours" value={totalOT.toFixed(1) + 'h'} color={totalOT > 0 ? AC.warning : AC.muted} accent={AC.warning} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as any }}>
                {selected.status === 'draft' && <ABtn variant="primary" onClick={() => runPayroll(selected)} disabled={running}>{running ? 'Processing...' : '▶ Run Payroll'}</ABtn>}
                {selected.status === 'processed' && <>
                  <ABtn variant="success" onClick={() => markPaid(selected)}>✓ Mark as Paid</ABtn>
                  <ABtn variant="secondary" onClick={exportNACHA}>↓ NACHA File</ABtn>
                </>}
                {entries.length > 0 && <ABtn variant="secondary" onClick={exportCSV}>↓ CSV</ABtn>}
              </div>
              <ACard pad={0}>
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th className="adm-th">Employee</th>
                        <th className="adm-th">Reg Hrs</th><th className="adm-th">OT Hrs</th>
                        <th className="adm-th">Gross</th>
                        <th className="adm-th">Fed</th><th className="adm-th">FICA</th><th className="adm-th">State</th><th className="adm-th">Health</th><th className="adm-th">401k</th>
                        <th className="adm-th">Net</th>
                        <th className="adm-th">Bank</th><th className="adm-th">Status</th>
                        <th className="adm-th">Stub</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(e => {
                        const emp = employees.find(em => em.id === e.employee_id)
                        return (
                          <tr key={e.id} className="adm-tr">
                            <td className="adm-td">
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{empName(emp)}</div>
                              <div style={{ fontSize: 11, color: AC.sub }}>{emp?.position}</div>
                            </td>
                            <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{e.regular_hours?.toFixed(1)}</td>
                            <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: (e.overtime_hours || 0) > 0 ? AC.warning : undefined, fontWeight: (e.overtime_hours || 0) > 0 ? 700 : 400 }}>{e.overtime_hours?.toFixed(1)}</td>
                            <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700 }}>{fmtMoney(e.gross_pay)}</td>
                            <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: AC.danger }}>{fmtMoney(e.federal_tax)}</td>
                            <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: AC.danger }}>{fmtMoney(e.fica)}</td>
                            <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: AC.danger }}>{fmtMoney(e.state_tax)}</td>
                            <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: AC.danger }}>{fmtMoney(e.health_insurance)}</td>
                            <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: AC.danger }}>{fmtMoney(e.retirement_401k)}</td>
                            <td className="adm-td" style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 800, color: AC.success }}>{fmtMoney(e.net_pay)}</td>
                            <td className="adm-td" style={{ fontSize: 11 }}>
                              {e.bank_routing ? <div><div style={{ fontFamily: 'IBM Plex Mono, monospace' }}>****{e.bank_routing.slice(-4)}</div><div style={{ color: AC.sub }}>{e.bank_account_type}</div></div> : <span style={{ color: AC.muted }}>—</span>}
                            </td>
                            <td className="adm-td"><AStatusBadge status={e.status} /></td>
                            <td className="adm-td">
                              <ABtn variant="ghost" size="sm" onClick={() => { setPaystubEntry(e); setPaystubOpen(true) }}>View</ABtn>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {entries.length === 0 && <AEmpty title="No entries" sub={selected.status === 'draft' ? 'Run payroll to generate' : 'No data'} />}
                </div>
              </ACard>
            </>
          ) : (
            <ACard><AEmpty title="Select a pay period" sub="Click a period on the left" /></ACard>
          )}
        </div>
      </div>

      {/* New period modal */}
      <AModal open={periodModal} onClose={() => setPeriodModal(false)} title="New Pay Period">
        <div className="adm-modal-body">
          <ASel label="Frequency" value={newPeriod.frequency} onChange={e => setNewPeriod(p => ({ ...p, frequency: e.target.value }))}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="semimonthly">Semi-monthly</option>
            <option value="monthly">Monthly</option>
          </ASel>
          <div className="adm-input-row">
            <AInp label="Period Start" type="date" value={newPeriod.start_date} onChange={e => setNewPeriod(p => ({ ...p, start_date: e.target.value }))} />
            <AInp label="Period End" type="date" value={newPeriod.end_date} onChange={e => setNewPeriod(p => ({ ...p, end_date: e.target.value }))} />
          </div>
          <AInp label="Pay Date" type="date" value={newPeriod.pay_date} onChange={e => setNewPeriod(p => ({ ...p, pay_date: e.target.value }))} />
        </div>
        <div className="adm-modal-footer">
          <ABtn variant="secondary" onClick={() => setPeriodModal(false)}>Cancel</ABtn>
          <ABtn variant="primary" onClick={createPeriod}>Create</ABtn>
        </div>
      </AModal>

      {/* Paystub modal */}
      {paystubEntry && paystubEmp && (
        <AModal open={paystubOpen} onClose={() => setPaystubOpen(false)} title="Pay Stub">
          <div className="adm-modal-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${AC.border}` }}>
              <div><div style={{ fontSize: 18, fontWeight: 900 }}>StaffForce</div><div style={{ fontSize: 12, color: AC.sub }}>Pay Statement</div></div>
              <div style={{ textAlign: 'right', fontSize: 12, color: AC.sub }}>
                <div>{selected?.start_date} — {selected?.end_date}</div>
                <div>Pay Date: {selected?.pay_date}</div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{empName(paystubEmp)}</div>
              <div style={{ fontSize: 12, color: AC.sub }}>{paystubEmp.position} · {paystubEmp.email}</div>
            </div>
            {[
              { label: `Regular Pay (${paystubEntry.regular_hours?.toFixed(2)} hrs)`, val: paystubEntry.regular_pay, color: AC.text },
              { label: `Overtime Pay (${paystubEntry.overtime_hours?.toFixed(2)} hrs @ 1.5x)`, val: paystubEntry.overtime_pay, color: AC.warning },
            ].filter(r => (r.val || 0) > 0).map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid #F3F4F6` }}>
                <span style={{ fontSize: 13 }}>{r.label}</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: r.color }}>{fmtMoney(r.val || 0)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: `2px solid ${AC.border}`, marginBottom: 16 }}>
              <span style={{ fontWeight: 800 }}>Gross Pay</span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 800 }}>{fmtMoney(paystubEntry.gross_pay)}</span>
            </div>
            {[
              { label: 'Federal Income Tax', val: paystubEntry.federal_tax },
              { label: 'FICA (SS + Medicare)', val: paystubEntry.fica },
              { label: 'State Tax', val: paystubEntry.state_tax },
              { label: 'Health Insurance', val: paystubEntry.health_insurance },
              { label: '401(k) Contribution', val: paystubEntry.retirement_401k },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid #F3F4F6` }}>
                <span style={{ fontSize: 13 }}>{r.label}</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: AC.danger }}>({fmtMoney(r.val || 0)})</span>
              </div>
            ))}
            <div style={{ background: '#EFF6FF', border: `2px solid #BFDBFE`, borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: AC.accent }}>NET PAY</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: AC.accent, fontFamily: 'IBM Plex Mono, monospace' }}>{fmtMoney(paystubEntry.net_pay)}</span>
            </div>
          </div>
          <div className="adm-modal-footer">
            <ABtn variant="secondary" onClick={() => setPaystubOpen(false)}>Close</ABtn>
            <ABtn variant="primary" onClick={() => {
              const txt = `PAY STUB\n\n${empName(paystubEmp)}\n${selected?.start_date} - ${selected?.end_date}\nPay Date: ${selected?.pay_date}\n\nGross: ${fmtMoney(paystubEntry.gross_pay)}\nNet: ${fmtMoney(paystubEntry.net_pay)}`
              downloadBlob(txt, `paystub_${paystubEmp.last_name}_${selected?.pay_date}.txt`)
            }}>↓ Download</ABtn>
          </div>
        </AModal>
      )}
    </div>
  )
}
