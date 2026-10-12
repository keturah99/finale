import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'iu_theme_mode'

interface ThemeState {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
  toggle: () => void
  init: () => void
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  resolved: systemPrefersDark() ? 'dark' : 'light',

  setMode: (mode) => {
    localStorage.setItem(STORAGE_KEY, mode)
    set({ mode, resolved: resolve(mode) })
  },

  toggle: () => {
    const next: ThemeMode = get().resolved === 'dark' ? 'light' : 'dark'
    get().setMode(next)
  },

  init: () => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    const mode: ThemeMode = saved ?? 'system'
    set({ mode, resolved: resolve(mode) })

    // Watch the OS preference when in system mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (get().mode === 'system') {
        set({ resolved: systemPrefersDark() ? 'dark' : 'light' })
      }
    }
    mq.addEventListener('change', handler)
  },
}))