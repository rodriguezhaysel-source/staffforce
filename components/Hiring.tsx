import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { Modal } from './shared/Modal'
import { Stars } from './shared/Stars'
import { fmtMoney } from './shared/utils'
import type { Employee, Department, JobPosting, Candidate } from '../lib/store'

interface Props { user: Employee; lang: string; departments: Department[]; employees: Employee[]; setEmployees: (e: Employee[]) => void }

const STAGES = ['applied','screening','interview','offer','hired']

export default function Hiring({ user, lang, departments, employees, setEmployees }: Props) {
  const [postings, setPostings] = useState<JobPosting[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [view, setView] = useState<'postings' | 'pipeline'>('postings')
  const [postModal, setPostModal] = useState(false)
  const [candModal, setCandModal] = useState(false)
  const [newPost, setNewPost] = useState<Partial<JobPosting>>({ status: 'open', employment_type: 'fulltime' })
  const [newCand, setNewCand] = useState<Partial<Candidate>>({ rating: 3, stage: 'applied' })

  useEffect(() => { load() }, [])

  async function load() {
    const [p, c] = await Promise.all([
      supabase.from('job_postings').select('*').order('created_at' as any, { ascending: false }),
      supabase.from('candidates').select('*').order('created_at' as any, { ascending: false }),
    ])
    setPostings(p.data || []); setCandidates(c.data || [])
  }

  async function savePosting() {
    await supabase.from('job_postings').insert({ ...newPost, created_by: user.id })
    setPostModal(false); setNewPost({ status: 'open', employment_type: 'fulltime' }); load()
  }

  async function saveCandidate() {
    await supabase.from('candidates').insert(newCand)
    setCandModal(false); setNewCand({ rating: 3, stage: 'applied' }); load()
  }

  async function move(id: string, stage: string) {
    await supabase.from('candidates').update({ stage }).eq('id', id); load()
  }

  async function updateRating(id: string, rating: number) {
    await supabase.from('candidates').update({ rating }).eq('id', id); load()
  }

  async function convert(cand: Candidate) {
    const post = postings.find(p => p.id === cand.job_id)
    await supabase.from('employees').insert({ first_name: cand.first_name, last_name: cand.last_name, email: cand.email, phone: cand.phone, department_id: post?.department_id || null, employment_type: post?.employment_type || 'fulltime', role: 'employee', status: 'active', language: 'en', password_hash: 'changeme', pto_balance: 0, geo_exempt: false })
    await supabase.from('candidates').update({ stage: 'hired' }).eq('id', cand.id)
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || []); load()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab ${view === 'postings' ? 'active' : ''}`} onClick={() => setView('postings')}>{t(lang, 'jobPostings')}</button>
          <button className={`tab ${view === 'pipeline' ? 'active' : ''}`} onClick={() => setView('pipeline')}>{t(lang, 'pipeline')}</button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {view === 'postings' && <button className="btn btn-primary btn-sm" onClick={() => setPostModal(true)}>{t(lang, 'addPosting')}</button>}
          {view === 'pipeline' && <button className="btn btn-primary btn-sm" onClick={() => setCandModal(true)}>Add Candidate</button>}
        </div>
      </div>

      {view === 'postings' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>{t(lang, 'department')}</th><th>Type</th><th>Location</th><th>Salary</th><th>Status</th><th>Candidates</th></tr></thead>
              <tbody>
                {postings.map(p => {
                  const dept = departments.find(d => d.id === p.department_id)
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.title}</td>
                      <td>{dept?.name || '-'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{p.employment_type}</td>
                      <td>{p.location}</td>
                      <td className="mono">{p.salary_min ? fmtMoney(p.salary_min) + ' - ' + fmtMoney(p.salary_max) : '-'}</td>
                      <td><span className={`badge ${p.status === 'open' ? 'badge-success' : 'badge-neutral'}`}>{p.status}</span></td>
                      <td>{candidates.filter(c => c.job_id === p.id).length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {postings.length === 0 && <div className="empty-state"><div className="empty-state-title">{t(lang, 'noData')}</div></div>}
          </div>
        </div>
      )}

      {view === 'pipeline' && (
        <div className="kanban">
          {STAGES.map(stage => (
            <div key={stage} className="kanban-col">
              <div className="kanban-col-header">
                <span style={{ textTransform: 'capitalize' }}>{t(lang, stage as any)}</span>
                <span className="badge badge-neutral">{candidates.filter(c => c.stage === stage).length}</span>
              </div>
              <div className="kanban-cards">
                {candidates.filter(c => c.stage === stage).map(c => {
                  const post = postings.find(p => p.id === c.job_id)
                  return (
                    <div key={c.id} className="kanban-card">
                      <div className="kanban-card-name">{c.first_name} {c.last_name}</div>
                      <div className="kanban-card-email">{c.email}</div>
                      {post && <div style={{ fontSize: 10, color: 'var(--color-accent)', marginTop: 4 }}>{post.title}</div>}
                      <div style={{ marginTop: 6 }}><Stars value={c.rating} onChange={v => updateRating(c.id, v)} /></div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        {STAGES.filter(s => s !== stage).map(s => (
                          <button key={s} className="btn btn-secondary btn-sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => move(c.id, s)}>{t(lang, s as any)}</button>
                        ))}
                        <button className="btn btn-success btn-sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => convert(c)}>{t(lang, 'convertToEmployee')}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={postModal} onClose={() => setPostModal(false)} title={t(lang, 'addPosting')}>
        <div className="modal-body">
          <div className="form-group"><label>Title</label><input value={newPost.title || ''} onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group"><label>{t(lang, 'department')}</label>
              <select value={newPost.department_id || ''} onChange={e => setNewPost(p => ({ ...p, department_id: e.target.value }))}>
                <option value="">None</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Type</label>
              <select value={newPost.employment_type || ''} onChange={e => setNewPost(p => ({ ...p, employment_type: e.target.value }))}>
                <option value="fulltime">Full Time</option><option value="parttime">Part Time</option><option value="contract">Contract</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Location</label><input value={newPost.location || ''} onChange={e => setNewPost(p => ({ ...p, location: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group"><label>Min Salary</label><input type="number" value={newPost.salary_min || ''} onChange={e => setNewPost(p => ({ ...p, salary_min: Number(e.target.value) }))} /></div>
            <div className="form-group"><label>Max Salary</label><input type="number" value={newPost.salary_max || ''} onChange={e => setNewPost(p => ({ ...p, salary_max: Number(e.target.value) }))} /></div>
          </div>
          <div className="form-group"><label>Description</label><textarea value={newPost.description || ''} onChange={e => setNewPost(p => ({ ...p, description: e.target.value }))} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setPostModal(false)}>{t(lang, 'cancel')}</button>
          <button className="btn btn-primary" onClick={savePosting}>{t(lang, 'save')}</button>
        </div>
      </Modal>

      <Modal open={candModal} onClose={() => setCandModal(false)} title="Add Candidate">
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group"><label>{t(lang, 'firstName')}</label><input value={newCand.first_name || ''} onChange={e => setNewCand(c => ({ ...c, first_name: e.target.value }))} /></div>
            <div className="form-group"><label>{t(lang, 'lastName')}</label><input value={newCand.last_name || ''} onChange={e => setNewCand(c => ({ ...c, last_name: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Email</label><input type="email" value={newCand.email || ''} onChange={e => setNewCand(c => ({ ...c, email: e.target.value }))} /></div>
            <div className="form-group"><label>Phone</label><input value={newCand.phone || ''} onChange={e => setNewCand(c => ({ ...c, phone: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label>Job Posting</label>
            <select value={newCand.job_id || ''} onChange={e => setNewCand(c => ({ ...c, job_id: e.target.value }))}>
              <option value="">None</option>{postings.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="form-group"><label>{t(lang, 'rating')}</label><Stars value={newCand.rating || 3} onChange={v => setNewCand(c => ({ ...c, rating: v }))} /></div>
          <div className="form-group"><label>Notes</label><textarea value={newCand.notes || ''} onChange={e => setNewCand(c => ({ ...c, notes: e.target.value }))} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setCandModal(false)}>{t(lang, 'cancel')}</button>
          <button className="btn btn-primary" onClick={saveCandidate}>{t(lang, 'save')}</button>
        </div>
      </Modal>
    </div>
  )
}
