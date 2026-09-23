import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/core'

interface LoginResponse {
  access: string
  refresh: string
}

export async function login(username: string, password: string): Promise<User> {
  const { data } = await api.post<LoginResponse>('/api/core/auth/login/', {
    username,
    password,
  })

  // Temporarily stash the token so /me can authenticate
  useAuthStore.getState().setAccess(data.access)

  const meRes = await api.get<User>('/api/core/users/me/', {
    headers: { Authorization: `Bearer ${data.access}` },
  })

  useAuthStore.getState().setSession({
    access: data.access,
    refresh: data.refresh,
    user: meRes.data,
  })

  return meRes.data
}

export function logout() {
  useAuthStore.getState().clear()
}