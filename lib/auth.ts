// Simple password hashing using Web Crypto API (no external deps)
// Uses PBKDF2 with SHA-256, 100k iterations

async function deriveKey(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  )
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateSalt(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt()
  const hash = await deriveKey(password, salt)
  return `pbkdf2:${salt}:${hash}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Support legacy plain-text passwords for migration
  if (!stored.startsWith('pbkdf2:')) {
    return password === stored
  }
  const [, salt, expectedHash] = stored.split(':')
  const hash = await deriveKey(password, salt)
  return hash === expectedHash
}
