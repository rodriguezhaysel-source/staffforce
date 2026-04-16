import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, subject, html } = req.body
  if (!to || !subject || !html) return res.status(400).json({ error: 'to, subject, and html are required' })

  // Load SMTP config from Supabase app_config
  const { data: cfgData } = await supabase.from('app_config').select('smtp_config,company_name').limit(1)
  const cfg = cfgData?.[0]
  const smtp = cfg?.smtp_config

  if (!smtp?.host || !smtp?.user || !smtp?.pass) {
    return res.status(503).json({ error: 'SMTP not configured. Please set up SMTP in Settings → Email & SMTP.' })
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    })

    await transporter.sendMail({
      from: `"${smtp.sender_name || cfg?.company_name || 'StaffForce'}" <${smtp.sender_email || smtp.user}>`,
      to,
      subject,
      html,
    })

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('SMTP error:', err)
    return res.status(500).json({ error: err.message || 'Failed to send email' })
  }
}
