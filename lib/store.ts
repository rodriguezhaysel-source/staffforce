import { Lang } from './i18n'

export interface AuthUser {
  id: string
  email?: string
  role: 'admin' | 'manager' | 'employee'
}

export interface AuthEmployee {
  id: string
  first: string
  last: string
  dept?: string
  title?: string
  avatar_color?: string
  lang: Lang
  location_id?: string
  permissions: Record<string, boolean>
  geo_exempt?: boolean
  hourly_rate?: number
  wage_type?: string
}

export function saveLang(lang: Lang) {
  if (typeof window !== 'undefined') localStorage.setItem('sf-lang', lang)
}

export function loadLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  return (localStorage.getItem('sf-lang') as Lang) || 'en'
}
