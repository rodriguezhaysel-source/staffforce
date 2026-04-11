import type { NextApiRequest, NextApiResponse } from 'next'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, subject, html, test } = req.body

  try {
    const { data: cfgData } = await supabase.from('app_config').select('*').limit(1)
    const cfg = cfgData?.[0]
    const smtp = cfg?.smtp_config

    if (!smtp?.host || !smtp?.email || !smtp?.password) {
      return res.status(400).json({ error: 'SMTP not configured. Please configure email settings in Admin Settings.' })
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: smtp.port === 465,
      auth: { user: smtp.email, pass: smtp.password },
      tls: { rejectUnauthorized: false },
    })

    await transporter.verify()

    if (test) {
      await transporter.sendMail({
        from: `"${smtp.sender_name || 'StaffForce'}" <${smtp.email}>`,
        to: smtp.email,
        subject: 'StaffForce — Test Email',
        html: `<p>Your email configuration is working correctly.</p>`,
      })
      return res.status(200).json({ success: true, message: 'Test email sent to ' + smtp.email })
    }

    await transporter.sendMail({
      from: `"${smtp.sender_name || 'StaffForce'}" <${smtp.email}>`,
      to,
      subject,
      html,
    })

    return res.status(200).json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to send email' })
  }
}
