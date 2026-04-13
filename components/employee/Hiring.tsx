import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { Card, Btn, Popup, Inp, Sel, Th, Td, C, StatusBadge, Stars, EmptyState, PageHeader, Badge } from '../ui'
import type { Employee, Department, JobPosting, Candidate } from '../../types'

interface Props { user: Employee; lang: string; departments: Department[]; employees: Employee[]; setEmployees: (e: Employee[]) => void }

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']
const STAGE_COLORS: Record<string, 'gray'|'yellow'|'blue'|'purple'|'green'|'red'> = {
  applied: 'gray', screening: 'yellow', interview: 'blue', offer: 'purple', hired: 'green', rejected: 'red'
}

export default function Hiring({ user, lang, departments, employees, setEmployees }: Props) {
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [jobModal, setJobModal] = useState(false)
  const [candidateModal, setCandidateModal] = useState(false)
  const [convertModal, setConvertModal] = useState(false)
  const [inviteStatus, setInviteStatus] = useState('')
  const [jobForm, setJobForm] = useState<Partial<JobPosting>>({ status: 'open', employment_type: 'fulltime' })
  const [candidateForm, setCandidateForm] = useState<Partial<Candidate>>({ rating: 3, stage: 'applied' })
  const [convertForm, setConvertForm] = useState({ department_id: '', location_id: '', hourly_rate: 0, hire_date: format(new Date(), 'yyyy-MM-dd'), role: 'employee', employment_type: 'fulltime' })
  const [filterStage, setFilterStage] = useState('')
  const [tab, setTab] = useState<'jobs'|'candidates'>('jobs')
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [j, c] = await Promise.all([
      supabase.from('job_postings').select('*').order('created_at' as any, { ascending: false }),
      supabase.from('candidates').select('*').order('created_at' as any, { ascending: false }),
    ])
    setJobs(j.data || [])
    setCandidates(c.data || [])
  }

  async function saveJob() {
    if (!jobForm.title) return
    if (selectedJob?.id) {
      await supabase.from('job_postings').update(jobForm).eq('id', selectedJob.id)
    } else {
      await supabase.from('job_postings').insert({ ...jobForm, created_by: user.id })
    }
    setJobModal(false); setJobForm({ status: 'open', employment_type: 'fulltime' }); setSelectedJob(null); load()
  }

  async function saveCandidate() {
    if (!candidateForm.first_name || !candidateForm.email) return
    if (selectedCandidate?.id) {
      await supabase.from('candidates').update(candidateForm).eq('id', selectedCandidate.id)
    } else {
      await supabase.from('candidates').insert({ ...candidateForm, job_id: selectedJob?.id })
    }
    setCandidateModal(false); setCandidateForm({ rating: 3, stage: 'applied' }); setSelectedCandidate(null); load()
  }

  async function updateStage(candidateId: string, stage: string) {
    await supabase.from('candidates').update({ stage }).eq('id', candidateId)
    load()
  }

  async function convertToEmployee() {
    if (!selectedCandidate) return
    setLoading(true)
    setInviteStatus('')
    const tempPassword = Math.random().toString(36).slice(2, 10)
    const { data: empData, error } = await supabase.from('employees').insert({
      first_name: selectedCandidate.first_name,
      last_name: selectedCandidate.last_name,
      email: selectedCandidate.email,
      phone: selectedCandidate.phone || '',
      position: jobs.find(j => j.id === selectedCandidate.job_id)?.title || '',
      department_id: convertForm.department_id,
      location_id: '',
      hire_date: convertForm.hire_date,
      employment_type: convertForm.employment_type,
      hourly_rate: convertForm.hourly_rate,
      role: convertForm.role,
      status: 'pending_activation',
      language: 'en',
      geo_exempt: false,
      pto_balance: 0,
      pto_accrual_rate: 1,
      password_hash: tempPassword,
    }).select('*')

    if (error) { setInviteStatus('Error creating employee: ' + error.message); setLoading(false); return }
    if (empData?.[0]) {
      await supabase.from('candidates').update({ stage: 'hired' }).eq('id', selectedCandidate.id)
      // Send invite
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: empData[0].id, base_url: window.location.origin })
      })
      const result = await res.json()
      setInviteStatus(result.success ? `✓ Employee created and invitation sent to ${selectedCandidate.email}` : `Employee created but invite failed: ${result.error}`)
      const { data: allEmps } = await supabase.from('employees').select('*')
      setEmployees(allEmps || [])
    }
    setLoading(false)
    load()
  }

  const filteredCandidates = (selectedJob ? candidates.filter(c => c.job_id === selectedJob.id) : candidates)
    .filter(c => !filterStage || c.stage === filterStage)

  return (
    <div>
      <PageHeader title="Hiring" sub="Job postings and candidate pipeline">
        <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {(['jobs', 'candidates'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 16px', border: 'none', background: tab === t ? C.accent : 'transparent', color: tab === t ? '#fff' : C.textSub, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <Btn variant="primary" size="sm" onClick={() => { setSelectedJob(null); setJobForm({ status: 'open', employment_type: 'fulltime' }); setJobModal(true) }}>+ New Posting</Btn>
      </PageHeader>

      {tab === 'jobs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {jobs.map(j => {
            const dept = departments.find(d => d.id === j.department_id)
            const candidateCount = candidates.filter(c => c.job_id === j.id).length
            const hiredCount = candidates.filter(c => c.job_id === j.id && c.stage === 'hired').length
            return (
              <div key={j.id} onClick={() => { setSelectedJob(j); setTab('candidates') }} style={{ background: '#fff', border: `1px solid ${C.border}`, borderTop: `3px solid ${dept?.color || C.accent}`, borderRadius: 12, padding: 20, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{j.title}</div>
                  <StatusBadge status={j.status} />
                </div>
                {dept && <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6 }}>{dept.name}</div>}
                <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12 }}>
                  {j.employment_type} {j.salary_min || j.salary_max ? `· $${j.salary_min?.toLocaleString()}–${j.salary_max?.toLocaleString()}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Badge color="blue">{candidateCount} candidates</Badge>
                  {hiredCount > 0 && <Badge color="green">{hiredCount} hired</Badge>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <Btn variant="secondary" size="sm" onClick={() => { setSelectedJob(j); setJobForm({ ...j }); setJobModal(true) }}>Edit</Btn>
                  <Btn variant="primary" size="sm" onClick={() => { setSelectedJob(j); setCandidateForm({ rating: 3, stage: 'applied', job_id: j.id }); setCandidateModal(true) }}>+ Candidate</Btn>
                </div>
              </div>
            )
          })}
          {jobs.length === 0 && <Card><EmptyState title="No job postings" sub="Create your first job posting" /></Card>}
        </div>
      )}

      {tab === 'candidates' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {selectedJob && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Showing:</span>
                <Badge color="blue">{selectedJob.title}</Badge>
                <Btn variant="ghost" size="sm" onClick={() => setSelectedJob(null)}>Clear</Btn>
              </div>
            )}
            <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginLeft: 'auto' }}>
              {['', ...STAGES].map(s => (
                <button key={s} onClick={() => setFilterStage(s)} style={{ padding: '6px 12px', border: 'none', background: filterStage === s ? C.accent : 'transparent', color: filterStage === s ? '#fff' : C.textSub, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  {s || 'All'}
                </button>
              ))}
            </div>
            <Btn variant="primary" size="sm" onClick={() => { setCandidateForm({ rating: 3, stage: 'applied', job_id: selectedJob?.id }); setSelectedCandidate(null); setCandidateModal(true) }}>+ Add Candidate</Btn>
          </div>

          <Card pad={0}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><Th>Candidate</Th><Th>Position</Th><Th>Stage</Th><Th>Rating</Th><Th>Applied</Th><Th>Actions</Th></tr>
              </thead>
              <tbody>
                {filteredCandidates.map(c => {
                  const job = jobs.find(j => j.id === c.job_id)
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid #F8FAFC` }}>
                      <Td>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{c.first_name} {c.last_name}</div>
                        <div style={{ fontSize: 11, color: C.textSub }}>{c.email}</div>
                        {c.phone && <div style={{ fontSize: 11, color: C.textSub }}>{c.phone}</div>}
                      </Td>
                      <Td>{job?.title || '—'}</Td>
                      <Td>
                        <select
                          value={c.stage}
                          onChange={e => updateStage(c.id, e.target.value)}
                          style={{ padding: '4px 8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
                        >
                          {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                        </select>
                      </Td>
                      <Td><Stars value={c.rating || 0} size={12} /></Td>
                      <Td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{(c as any).created_at?.slice(0, 10) || '—'}</Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Btn variant="secondary" size="sm" onClick={() => { setSelectedCandidate(c); setCandidateForm({ ...c }); setCandidateModal(true) }}>Edit</Btn>
                          {c.stage === 'offer' && (
                            <Btn variant="success" size="sm" onClick={() => { setSelectedCandidate(c); setInviteStatus(''); setConvertModal(true) }}>Convert</Btn>
                          )}
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredCandidates.length === 0 && <EmptyState title="No candidates" sub="Add your first candidate or adjust the filter" />}
          </Card>
        </div>
      )}

      {/* Job modal */}
      <Popup open={jobModal} onClose={() => setJobModal(false)} title={selectedJob ? 'Edit Job Posting' : 'New Job Posting'}>
        <div style={{ padding: '20px 24px' }}>
          <Inp label="Job Title" value={jobForm.title || ''} onChange={e => setJobForm(f => ({ ...f, title: e.target.value }))} />
          <Sel label="Department" value={jobForm.department_id || ''} onChange={e => setJobForm(f => ({ ...f, department_id: e.target.value }))}>
            <option value="">Select department...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Sel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Sel label="Employment Type" value={jobForm.employment_type || 'fulltime'} onChange={e => setJobForm(f => ({ ...f, employment_type: e.target.value }))}>
              <option value="fulltime">Full-time</option>
              <option value="parttime">Part-time</option>
              <option value="contract">Contract</option>
            </Sel>
            <Sel label="Status" value={jobForm.status || 'open'} onChange={e => setJobForm(f => ({ ...f, status: e.target.value }))}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="paused">Paused</option>
            </Sel>
            <Inp label="Min Salary ($)" type="number" value={jobForm.salary_min || 0} onChange={e => setJobForm(f => ({ ...f, salary_min: Number(e.target.value) }))} />
            <Inp label="Max Salary ($)" type="number" value={jobForm.salary_max || 0} onChange={e => setJobForm(f => ({ ...f, salary_max: Number(e.target.value) }))} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 5 }}>Description</label>
            <textarea value={jobForm.description || ''} onChange={e => setJobForm(f => ({ ...f, description: e.target.value }))} rows={5} style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as any }} />
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setJobModal(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={saveJob}>Save Posting</Btn>
        </div>
      </Popup>

      {/* Candidate modal */}
      <Popup open={candidateModal} onClose={() => setCandidateModal(false)} title={selectedCandidate ? 'Edit Candidate' : 'Add Candidate'}>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="First Name" value={candidateForm.first_name || ''} onChange={e => setCandidateForm(f => ({ ...f, first_name: e.target.value }))} />
            <Inp label="Last Name" value={candidateForm.last_name || ''} onChange={e => setCandidateForm(f => ({ ...f, last_name: e.target.value }))} />
          </div>
          <Inp label="Email" type="email" value={candidateForm.email || ''} onChange={e => setCandidateForm(f => ({ ...f, email: e.target.value }))} />
          <Inp label="Phone" value={candidateForm.phone || ''} onChange={e => setCandidateForm(f => ({ ...f, phone: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Sel label="Stage" value={candidateForm.stage || 'applied'} onChange={e => setCandidateForm(f => ({ ...f, stage: e.target.value }))}>
              {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </Sel>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 8 }}>Rating</label>
              <Stars value={candidateForm.rating || 0} onChange={v => setCandidateForm(f => ({ ...f, rating: v }))} size={22} />
            </div>
          </div>
          <Inp label="Resume URL" value={candidateForm.resume_url || ''} onChange={e => setCandidateForm(f => ({ ...f, resume_url: e.target.value }))} placeholder="https://..." />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase' as any, letterSpacing: '0.5px', marginBottom: 5 }}>Notes</label>
            <textarea value={candidateForm.notes || ''} onChange={e => setCandidateForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as any }} />
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setCandidateModal(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={saveCandidate}>Save Candidate</Btn>
        </div>
      </Popup>

      {/* Convert to employee modal */}
      {selectedCandidate && (
        <Popup open={convertModal} onClose={() => setConvertModal(false)} title={`Convert ${selectedCandidate.first_name} ${selectedCandidate.last_name} to Employee`}>
          <div style={{ padding: '20px 24px' }}>
            {inviteStatus && (
              <div style={{ padding: '12px', borderRadius: 8, background: inviteStatus.startsWith('✓') ? '#D1FAE5' : '#FEE2E2', color: inviteStatus.startsWith('✓') ? '#065F46' : '#991B1B', marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
                {inviteStatus}
              </div>
            )}
            <Sel label="Department" value={convertForm.department_id} onChange={e => setConvertForm(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">Select department...</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Sel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Sel label="Role" value={convertForm.role} onChange={e => setConvertForm(f => ({ ...f, role: e.target.value }))}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
              </Sel>
              <Sel label="Employment Type" value={convertForm.employment_type} onChange={e => setConvertForm(f => ({ ...f, employment_type: e.target.value }))}>
                <option value="fulltime">Full-time</option>
                <option value="parttime">Part-time</option>
                <option value="contract">Contract</option>
              </Sel>
              <Inp label="Hourly Rate ($)" type="number" value={convertForm.hourly_rate} onChange={e => setConvertForm(f => ({ ...f, hourly_rate: Number(e.target.value) }))} />
              <Inp label="Hire Date" type="date" value={convertForm.hire_date} onChange={e => setConvertForm(f => ({ ...f, hire_date: e.target.value }))} />
            </div>
            <div style={{ padding: '12px', background: '#F0FDF4', borderRadius: 8, fontSize: 13, color: '#065F46' }}>
              📧 An invitation email will be sent to <strong>{selectedCandidate.email}</strong> to set up their password.
            </div>
          </div>
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setConvertModal(false)}>Cancel</Btn>
            <Btn variant="success" onClick={convertToEmployee} disabled={loading}>{loading ? 'Creating...' : 'Create Employee & Send Invite'}</Btn>
          </div>
        </Popup>
      )}
    </div>
  )
}
