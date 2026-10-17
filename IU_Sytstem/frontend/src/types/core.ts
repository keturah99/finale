// frontend/src/types/core.ts

// ---------------------------------------------------------------------------
// Department
// ---------------------------------------------------------------------------

export interface Department {
  id: number
  code: string
  name: string
  description: string
}

export interface DepartmentFormData {
  code: string
  name: string
  description?: string
}

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

export interface Role {
  id: number
  name: string
  description: string
  department_codes: string[]
}

export interface RoleFormData {
  name: string
  description?: string
  department_ids?: number[]
}

// ---------------------------------------------------------------------------
// Wholesale (embedded)
// ---------------------------------------------------------------------------

export interface WholesaleScope {
  id: number
  name: string
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  department: Department | null
  wholesale: WholesaleScope | null
  roles: Role[]
  phone?: string
  nrc?: string | null
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  last_login: string | null
  date_joined: string
}

export interface UserFormData {
  username: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  nrc?: string
  department_id?: number | null
  wholesale_id?: number | null
  role_ids?: number[]
  password?: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthTokens {
  access: string
  refresh: string
}