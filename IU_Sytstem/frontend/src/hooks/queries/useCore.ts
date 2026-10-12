import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  User,
  UserFormData,
  Department,
  DepartmentFormData,
  Role,
  RoleFormData,
} from '@/types/core'

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const coreKeys = {
  all: ['core'] as const,

  users: (filters?: Record<string, unknown>) =>
    [...coreKeys.all, 'users', filters] as const,
  user: (id: number) => [...coreKeys.all, 'users', id] as const,

  departments: () => [...coreKeys.all, 'departments'] as const,
  department: (id: number) => [...coreKeys.all, 'departments', id] as const,

  roles: () => [...coreKeys.all, 'roles'] as const,
  role: (id: number) => [...coreKeys.all, 'roles', id] as const,
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function useUsers(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: coreKeys.users(filters),
    queryFn: () => fetchList<User>('/api/core/users/', filters),
  })
}

export function useUser(id: number | null) {
  return useQuery({
    queryKey: coreKeys.user(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<User>(`/api/core/users/${id}/`)
      return data
    },
    enabled: id !== null,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UserFormData) => {
      const { data } = await api.post<User>('/api/core/users/', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: coreKeys.users() })
    },
  })
}

export function useUpdateUser(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<UserFormData>) => {
      const { data } = await api.patch<User>(`/api/core/users/${id}/`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: coreKeys.users() })
      qc.invalidateQueries({ queryKey: coreKeys.user(id) })
    },
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/core/users/${id}/`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: coreKeys.users() })
    },
  })
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export function useDepartments() {
  return useQuery({
    queryKey: coreKeys.departments(),
    queryFn: () => fetchList<Department>('/api/core/departments/'),
  })
}

export function useCreateDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DepartmentFormData) => {
      const { data } = await api.post<Department>(
        '/api/core/departments/',
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: coreKeys.departments() })
    },
  })
}

export function useUpdateDepartment(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<DepartmentFormData>) => {
      const { data } = await api.patch<Department>(
        `/api/core/departments/${id}/`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: coreKeys.departments() })
      qc.invalidateQueries({ queryKey: coreKeys.department(id) })
    },
  })
}

export function useDeleteDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/core/departments/${id}/`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: coreKeys.departments() })
    },
  })
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export function useRoles() {
  return useQuery({
    queryKey: coreKeys.roles(),
    queryFn: () => fetchList<Role>('/api/core/roles/'),
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: RoleFormData) => {
      const { data } = await api.post<Role>('/api/core/roles/', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: coreKeys.roles() })
    },
  })
}

export function useUpdateRole(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RoleFormData>) => {
      const { data } = await api.patch<Role>(`/api/core/roles/${id}/`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: coreKeys.roles() })
      qc.invalidateQueries({ queryKey: coreKeys.role(id) })
    },
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/core/roles/${id}/`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: coreKeys.roles() })
    },
  })
}