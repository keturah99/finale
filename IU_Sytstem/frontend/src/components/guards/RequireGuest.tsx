import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user, access, hydrated } = useAuthStore()
  if (!hydrated) return null
  if (user && access) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}