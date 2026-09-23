import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, access, hydrated } = useAuthStore()
  const location = useLocation()

  if (!hydrated) return null
  if (!user || !access) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}