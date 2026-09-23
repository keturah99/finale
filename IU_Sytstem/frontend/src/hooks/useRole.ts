import { useAuthStore } from '@/stores/authStore'

export function useRole() {
  const user = useAuthStore((s) => s.user)

  const hasRole = (name: string) =>
    user?.roles.some((r) => r.name === name) ?? false

  const hasAnyRole = (names: string[]) =>
    names.some((n) => hasRole(n))

  const isSuperuser = user?.is_superuser ?? false

  return { user, hasRole, hasAnyRole, isSuperuser }
}