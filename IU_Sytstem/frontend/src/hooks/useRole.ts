import { useAuthStore } from '@/stores/authStore'

export function useRole() {
  const user = useAuthStore((s) => s.user)

  const hasRole = (name: string) =>
    user?.roles.some((r) => r.name === name) ?? false

  const hasAnyRole = (names: string[]) =>
    names.some((n) => hasRole(n))

  const isSuperuser = user?.is_superuser ?? false

  const isAuditor = hasRole('auditor') && !isSuperuser
  const canWrite = (module: string) => {
    if (isSuperuser) return true
    if (isAuditor) return false
    return true   // role-specific checks handled per page
  }

  return { user, hasRole, hasAnyRole, isSuperuser, isAuditor, canWrite }
}

