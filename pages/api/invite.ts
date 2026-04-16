import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
)

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { employee_id, base_url } = req.body
  if (!employee_id) return res.status(400).json({ error: 'employee_id required' })

  const { data: empData } = await supabase.from('employees').select('*').eq('id', employee_id)
  const emp = empData?.[0]
  if (!emp) return res.status(404).json({ error: 'Employee not found' })

  const token = generateToken()
  const expires_at = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  await supabase.from('invite_tokens').insert({ employee_id, token, expires_at, used: false })

  const { data: cfgData } = await supabase.from('app_config').select('*').limit(1)
  const cfg = cfgData?.[0]
  const smtp = cfg?.smtp_config
  const emailCfg = cfg?.email_template || {}

  const companyName = cfg?.company_name || 'StaffForce'
  const accentColor = emailCfg.accent_color || '#0A6EBD'
  const welcomeMsg = emailCfg.welcome_message || `You have been added to ${companyName}. Click the button below to activate your account.`
  const senderName = smtp?.sender_name || companyName
  const logoUrl = emailCfg.logo_url || ''
  const inviteUrl = `${base_url}/invite?token=${token}`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:${accentColor};padding:32px;text-align:center;">
          ${logoUrl ? `<img src="${logoUrl}" height="48" style="margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;" />` : ''}
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">${companyName}</h1>
        </td></tr>
        <tr><td style="padding:40px 36px;">
          <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 12px;">Welcome, ${emp.first_name}!</h2>
          <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 28px;">${welcomeMsg}</p>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${inviteUrl}" style="display:inline-block;background:${accentColor};color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.3px;">Activate My Account</a>
          </div>
          <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0 0 8px;">Or copy this link into your browser:</p>
          <p style="color:#9CA3AF;font-size:11px;text-align:center;word-break:break-all;margin:0 0 28px;">${inviteUrl}</p>
          <div style="border-top:1px solid #E5E7EB;padding-top:20px;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">This link expires in <strong>72 hours</strong>. If you did not expect this email, please ignore it.</p>
          </div>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:20px 36px;text-align:center;border-top:1px solid #E5E7EB;">
          <p style="color:#9CA3AF;font-size:12px;margin:0;">${emailCfg.signature || senderName + ' Team'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const emailRes = await fetch(`${base_url}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: emp.email, subject: `You have been invited to ${companyName}`, html }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.json()
    return res.status(500).json({ error: err.error || 'Failed to send invitation email' })
  }

  return res.status(200).json({ success: true, token })
}
