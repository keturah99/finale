import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { User } from '@/types/core'

interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

async function fetchList<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  const { data } = await api.get<Paginated<T> | T[]>(url, { params })
  return Array.isArray(data) ? data : data.results
}

export const coreKeys = {
  all: ['core'] as const,
  users: () => [...coreKeys.all, 'users'] as const,
  departments: () => [...coreKeys.all, 'departments'] as const,
  roles: () => [...coreKeys.all, 'roles'] as const,
}

export function useUsers() {
  return useQuery({
    queryKey: coreKeys.users(),
    queryFn: () => fetchList<User>('/api/core/users/'),
  })
}

export function useDepartments() {
  return useQuery({
    queryKey: coreKeys.departments(),
    queryFn: () => fetchList<import('@/types/core').Department>(
      '/api/core/departments/',
    ),
  })
}

export function useRoles() {
  return useQuery({
    queryKey: coreKeys.roles(),
    queryFn: () => fetchList<import('@/types/core').Role>(
      '/api/core/roles/',
    ),
  })
}