import { create } from 'zustand'
import type { User } from '@/types/core'

const STORAGE_KEYS = {
  access: 'iu_access',
  refresh: 'iu_refresh',
  user: 'iu_user',
}

interface AuthState {
  user: User | null
  access: string | null
  refresh: string | null
  hydrated: boolean
  setSession: (payload: { access: string; refresh: string; user: User }) => void
  setAccess: (access: string) => void
  clear: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  access: null,
  refresh: null,
  hydrated: false,

  setSession: ({ access, refresh, user }) => {
    localStorage.setItem(STORAGE_KEYS.access, access)
    localStorage.setItem(STORAGE_KEYS.refresh, refresh)
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
    set({ access, refresh, user, hydrated: true })
  },

  setAccess: (access) => {
    localStorage.setItem(STORAGE_KEYS.access, access)
    set({ access })
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEYS.access)
    localStorage.removeItem(STORAGE_KEYS.refresh)
    localStorage.removeItem(STORAGE_KEYS.user)
    set({ access: null, refresh: null, user: null })
  },

  hydrate: () => {
    const access = localStorage.getItem(STORAGE_KEYS.access)
    const refresh = localStorage.getItem(STORAGE_KEYS.refresh)
    const userRaw = localStorage.getItem(STORAGE_KEYS.user)
    const user = userRaw ? (JSON.parse(userRaw) as User) : null
    set({ access, refresh, user, hydrated: true })
  },
}))