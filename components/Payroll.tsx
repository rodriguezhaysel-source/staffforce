import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { Modal } from './shared/Modal'
import { fmtMoney, empName, downloadBlob } from './shared/utils'
import { calculateHours, calculatePay, generateNACHA } from '../lib/payroll'
import { Icon } from './shared/Icons'
import type { Employee, PayrollPeriod, PayrollEntry } from '../lib/store'

interface Props { user: Employee; lang: string; employees: Employee[] }

export default function Payroll({ user, lang, employees }: Props) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [selected, setSelected] = useState<PayrollPeriod | null>(null)
  const [periodModal, setPeriodModal] = useState(false)
  const [paystubOpen, setPaystubOpen] = useState(false)
  const [paystubEntry, setPaystubEntry] = useState<PayrollEntry | null>(null)
  const [newPeriod, setNewPeriod] = useState({ frequency: 'biweekly', start_date: '', end_date: '', pay_date: '' })

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
    await supabase.from('payroll_periods').insert({ ...newPeriod, status: 'draft' })
    setPeriodModal(false); setNewPeriod({ frequency: 'biweekly', start_date: '', end_date: '', pay_date: '' }); loadPeriods()
  }

  async function runPayroll(p: PayrollPeriod) {
    const { data: te } = await supabase.from('time_entries').select('*').gte('clock_in', p.start_date).lte('clock_in', p.end_date + 'T23:59:59').eq('status', 'approved')
    for (const emp of employees.filter(e => e.status === 'active')) {
      const empEntries = (te || []).filter(e => e.employee_id === emp.id)
      const { regular, overtime } = calculateHours(empEntries)
      const pay = calculatePay(emp, regular, overtime)
      const { id: _id, ...rest } = { id: '', period_id: p.id, employee_id: emp.id, ...pay, bank_routing: emp.bank_routing || '', bank_account: emp.bank_account || '', bank_account_type: emp.bank_account_type || '', bank_name: emp.bank_name || '', status: 'pending' }
      await supabase.from('payroll_entries').upsert({ period_id: p.id, employee_id: emp.id, ...pay, bank_routing: emp.bank_routing || '', bank_account: emp.bank_account || '', bank_account_type: emp.bank_account_type || '', bank_name: emp.bank_name || '', status: 'pending' }, { onConflict: 'period_id,employee_id' })
    }
    await supabase.from('payroll_periods').update({ status: 'processed' }).eq('id', p.id)
    loadPeriods(); loadEntries(p)
  }

  async function markPaid(p: PayrollPeriod) {
    await supabase.from('payroll_periods').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', p.id)
    await supabase.from('payroll_entries').update({ status: 'paid' }).eq('period_id', p.id)
    loadPeriods(); if (selected?.id === p.id) loadEntries(p)
  }

  function exportNACHA() {
    if (!selected) return
    downloadBlob(generateNACHA(entries, employees, selected.id), 'payroll_' + selected.pay_date + '.ach')
  }

  function exportCSV() {
    if (!selected) return
    const rows = [['Employee','Reg Hrs','OT Hrs','Gross','Federal','FICA','State','Health','401k','Net','Status']]
    entries.forEach(e => { const emp = employees.find(em => em.id === e.employee_id); rows.push([empName(emp), String(e.regular_hours), String(e.overtime_hours), String(e.gross_pay), String(e.federal_tax), String(e.fica), String(e.state_tax), String(e.health_insurance), String(e.retirement_401k), String(e.net_pay), e.status]) })
    downloadBlob(rows.map(r => r.join(',')).join('\n'), 'payroll.csv', 'text/csv')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setPeriodModal(true)}>{t(lang, 'createPeriod')}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 0 }}>
          {periods.map(p => (
            <div key={p.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: selected?.id === p.id ? '#EFF6FF' : undefined }} onClick={() => loadEntries(p)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{p.start_date} - {p.end_date}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>Pay: {p.pay_date} | {p.frequency}</div>
                </div>
                <span className={`badge ${p.status === 'paid' ? 'badge-success' : p.status === 'processed' ? 'badge-blue' : 'badge-neutral'}`}>{p.status}</span>
              </div>
            </div>
          ))}
          {periods.length === 0 && <div className="empty-state"><div className="empty-state-sub">No periods</div></div>}
        </div>

        <div>
          {selected ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => runPayroll(selected)}><Icon name="refresh" size={13} />{t(lang, 'runPayroll')}</button>
                <button className="btn btn-success btn-sm" onClick={() => markPaid(selected)}>{t(lang, 'markAsPaid')}</button>
                <button className="btn btn-secondary btn-sm" onClick={exportNACHA}><Icon name="download" size={13} />{t(lang, 'downloadNACHA')}</button>
                <button className="btn btn-secondary btn-sm" onClick={exportCSV}><Icon name="download" size={13} />{t(lang, 'downloadCSV')}</button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead><tr>
                      <th>{t(lang, 'employee')}</th><th>Reg H</th><th>OT H</th><th>Gross</th>
                      <th>Fed</th><th>FICA</th><th>State</th><th>Health</th><th>401k</th>
                      <th>Net</th><th>Status</th><th></th>
                    </tr></thead>
                    <tbody>
                      {entries.map(e => (
                        <tr key={e.id}>
                          <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{empName(employees.find(em => em.id === e.employee_id))}</td>
                          <td className="mono">{e.regular_hours}</td>
                          <td className="mono" style={{ color: e.overtime_hours > 0 ? 'var(--color-warning)' : undefined }}>{e.overtime_hours}</td>
                          <td className="mono">{fmtMoney(e.gross_pay)}</td>
                          <td className="mono" style={{ color: 'var(--color-text-secondary)' }}>{fmtMoney(e.federal_tax)}</td>
                          <td className="mono" style={{ color: 'var(--color-text-secondary)' }}>{fmtMoney(e.fica)}</td>
                          <td className="mono" style={{ color: 'var(--color-text-secondary)' }}>{fmtMoney(e.state_tax)}</td>
                          <td className="mono" style={{ color: 'var(--color-text-secondary)' }}>{fmtMoney(e.health_insurance)}</td>
                          <td className="mono" style={{ color: 'var(--color-text-secondary)' }}>{fmtMoney(e.retirement_401k)}</td>
                          <td className="mono" style={{ fontWeight: 700, color: 'var(--color-success)' }}>{fmtMoney(e.net_pay)}</td>
                          <td><span className={`badge ${e.status === 'paid' ? 'badge-success' : 'badge-neutral'}`}>{e.status}</span></td>
                          <td><button className="btn btn-secondary btn-sm" onClick={() => { setPaystubEntry(e); setPaystubOpen(true) }}>Stub</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {entries.length === 0 && <div className="empty-state"><div className="empty-state-title">Run payroll to generate entries</div></div>}
                </div>
                {entries.length > 0 && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 24, fontSize: 13 }}>
                    <div>Total Gross: <strong className="mono">{fmtMoney(entries.reduce((s, e) => s + e.gross_pay, 0))}</strong></div>
                    <div>Total Net: <strong className="mono" style={{ color: 'var(--color-success)' }}>{fmtMoney(entries.reduce((s, e) => s + e.net_pay, 0))}</strong></div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card"><div className="empty-state"><div className="empty-state-title">Select a payroll period</div></div></div>
          )}
        </div>
      </div>

      <Modal open={periodModal} onClose={() => setPeriodModal(false)} title={t(lang, 'createPeriod')}>
        <div className="modal-body">
          <div className="form-group"><label>{t(lang, 'frequency')}</label>
            <select value={newPeriod.frequency} onChange={e => setNewPeriod(p => ({ ...p, frequency: e.target.value }))}>
              <option value="weekly">{t(lang, 'weekly')}</option><option value="biweekly">{t(lang, 'biweekly')}</option><option value="monthly">{t(lang, 'monthly')}</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group"><label>{t(lang, 'startDate')}</label><input type="date" value={newPeriod.start_date} onChange={e => setNewPeriod(p => ({ ...p, start_date: e.target.value }))} /></div>
            <div className="form-group"><label>{t(lang, 'endDate')}</label><input type="date" value={newPeriod.end_date} onChange={e => setNewPeriod(p => ({ ...p, end_date: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label>{t(lang, 'payDate')}</label><input type="date" value={newPeriod.pay_date} onChange={e => setNewPeriod(p => ({ ...p, pay_date: e.target.value }))} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setPeriodModal(false)}>{t(lang, 'cancel')}</button>
          <button className="btn btn-primary" onClick={createPeriod}>{t(lang, 'save')}</button>
        </div>
      </Modal>

      {paystubEntry && (
        <Modal open={paystubOpen} onClose={() => setPaystubOpen(false)} title="Paystub">
          <div className="modal-body">
            {(() => {
              const emp = employees.find(e => e.id === paystubEntry.employee_id)
              const period = periods.find(p => p.id === paystubEntry.period_id)
              return (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 20, borderBottom: '2px solid var(--color-border)', paddingBottom: 16 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 800 }}>StaffForce</h2>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Pay Statement</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    <div><div style={{ fontWeight: 700, marginBottom: 4 }}>Employee</div><div>{empName(emp)}</div><div style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{emp?.position}</div></div>
                    <div><div style={{ fontWeight: 700, marginBottom: 4 }}>Pay Period</div><div style={{ fontSize: 13 }}>{period?.start_date} to {period?.end_date}</div><div style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>Pay Date: {period?.pay_date}</div></div>
                  </div>
                  <table style={{ marginBottom: 12 }}>
                    <thead><tr><th>Description</th><th style={{ textAlign: 'right' }}>Hours</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                    <tbody>
                      <tr><td>Regular Pay</td><td style={{ textAlign: 'right' }} className="mono">{paystubEntry.regular_hours}</td><td style={{ textAlign: 'right' }} className="mono">{fmtMoney(paystubEntry.regular_pay)}</td></tr>
                      {paystubEntry.overtime_hours > 0 && <tr><td>Overtime (1.5x)</td><td style={{ textAlign: 'right' }} className="mono">{paystubEntry.overtime_hours}</td><td style={{ textAlign: 'right' }} className="mono">{fmtMoney(paystubEntry.overtime_pay)}</td></tr>}
                      <tr><td colSpan={2}><strong>Gross Pay</strong></td><td style={{ textAlign: 'right' }} className="mono"><strong>{fmtMoney(paystubEntry.gross_pay)}</strong></td></tr>
                    </tbody>
                  </table>
                  <table style={{ marginBottom: 12 }}>
                    <thead><tr><th>Deductions</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                    <tbody>
                      <tr><td>Federal (12%)</td><td style={{ textAlign: 'right' }} className="mono">-{fmtMoney(paystubEntry.federal_tax)}</td></tr>
                      <tr><td>FICA (7.65%)</td><td style={{ textAlign: 'right' }} className="mono">-{fmtMoney(paystubEntry.fica)}</td></tr>
                      <tr><td>State (4%)</td><td style={{ textAlign: 'right' }} className="mono">-{fmtMoney(paystubEntry.state_tax)}</td></tr>
                      <tr><td>Health Insurance</td><td style={{ textAlign: 'right' }} className="mono">-{fmtMoney(paystubEntry.health_insurance)}</td></tr>
                      <tr><td>401(k) (3%)</td><td style={{ textAlign: 'right' }} className="mono">-{fmtMoney(paystubEntry.retirement_401k)}</td></tr>
                    </tbody>
                  </table>
                  <div style={{ background: 'var(--color-success-bg)', padding: '14px 16px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 16 }}>Net Pay</strong>
                    <strong style={{ fontSize: 22, fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>{fmtMoney(paystubEntry.net_pay)}</strong>
                  </div>
                  {paystubEntry.bank_name && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center' }}>Direct Deposit to {paystubEntry.bank_name} ****{paystubEntry.bank_account?.slice(-4)}</div>}
                </div>
              )
            })()}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setPaystubOpen(false)}>{t(lang, 'close')}</button>
            <button className="btn btn-primary" onClick={() => window.print()}>Print</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
