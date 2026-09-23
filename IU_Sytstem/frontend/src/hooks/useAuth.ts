import { useAuthStore } from '@/stores/authStore'
import { login as doLogin, logout as doLogout } from '@/lib/auth'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const access = useAuthStore((s) => s.access)

  return {
    user,
    isAuthenticated: Boolean(user && access),
    login: doLogin,
    logout: doLogout,
  }
}