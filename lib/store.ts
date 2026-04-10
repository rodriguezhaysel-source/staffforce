import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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

interface AppState {
  user: AuthUser | null
  employee: AuthEmployee | null
  lang: Lang
  config: Record<string, string>
  locations: any[]
  sidebarMini: boolean
  setUser: (u: AuthUser | null) => void
  setEmployee: (e: AuthEmployee | null) => void
  setLang: (l: Lang) => void
  setConfig: (c: Record<string, string>) => void
  setLocations: (l: any[]) => void
  setSidebarMini: (v: boolean) => void
  logout: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      employee: null,
      lang: 'en',
      config: {},
      locations: [],
      sidebarMini: false,
      setUser: (u) => set({ user: u }),
      setEmployee: (e) => set({ employee: e, lang: e?.lang || 'en' }),
      setLang: (l) => set({ lang: l }),
      setConfig: (c) => set({ config: c }),
      setLocations: (l) => set({ locations: l }),
      setSidebarMini: (v) => set({ sidebarMini: v }),
      logout: () => set({ user: null, employee: null }),
    }),
    { name: 'staffforce-store', partialize: (s) => ({ lang: s.lang, sidebarMini: s.sidebarMini }) }
  )
)
