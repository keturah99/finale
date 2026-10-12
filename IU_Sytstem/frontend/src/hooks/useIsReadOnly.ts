import { useRole } from '@/hooks/useRole'

export function useIsReadOnly() {
  const { isSuperuser, hasRole } = useRole()
  if (isSuperuser) return false
  return hasRole('auditor')
}