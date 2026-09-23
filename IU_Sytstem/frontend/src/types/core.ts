export interface Department {
  id: number
  code: string
  name: string
  description: string
}

export interface Role {
  id: number
  name: string
  description: string
}

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  department: Department | null
  roles: Role[]
  phone?: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
}

export interface AuthTokens {
  access: string
  refresh: string
}