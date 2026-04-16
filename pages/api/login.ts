import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
)

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false
  // Support hashed passwords (pbkdf2:salt:hash)
  if (stored.startsWith('pbkdf2:')) {
    const [, salt, expectedHash] = stored.split(':')
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    )
    const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
    return hash === expectedHash
  }
  // Legacy plain-text comparison (for migration)
  return password === stored
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, requiredRole } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .in('status', ['active', 'pending_activation'])

  if (error || !data || data.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const emp = data[0]

  // Verify password
  const valid = await verifyPassword(password.trim(), emp.password_hash || '')
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  // Check role if required
  if (requiredRole && !requiredRole.includes(emp.role)) {
    return res.status(403).json({ error: 'Access denied. Insufficient role.' })
  }

  // Activate pending employees on first login
  if (emp.status === 'pending_activation') {
    await supabase.from('employees').update({ status: 'active' }).eq('id', emp.id)
    emp.status = 'active'
  }

  // Strip sensitive fields before sending to client
  const { password_hash, bank_account, bank_routing, internal_notes, ...safeEmp } = emp

  return res.status(200).json({ employee: safeEmp })
}
