import { useEffect } from 'react'
import { useThemeStore } from '@/stores/themeStore'

/**
 * Applies the resolved theme by toggling the `dark` class on <html>,
 * and initialises the store on first mount.
 */
export function useTheme() {
  const { mode, resolved, setMode, toggle, init } = useThemeStore()

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    const root = document.documentElement
    if (resolved === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [resolved])

  return { mode, resolved, setMode, toggle }
}