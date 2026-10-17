import { useEffect, useMemo, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus, Pencil, Trash2, ShieldCheck, ShieldOff } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/forms/FormField'
import { NrcInput } from '@/components/shared/NrcInput'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownItem, DropdownSeparator,
} from '@/components/ui/dropdown-menu'

import {
  useUsers, useCreateUser, useUpdateUser, useDeleteUser,
  useDepartments, useRoles,
} from '@/hooks/queries/useCore'
import { useOutlets } from '@/hooks/queries/useWholesale'
import { useIsReadOnly } from '@/hooks/useIsReadOnly'
import { formatDateTime } from '@/lib/format'
import type { User, UserFormData, Role } from '@/types/core'
import { cn } from '@/lib/utils'


// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const baseSchema = z.object({
  username: z.string().min(1, 'Username required').max(150),
  email: z.string().email('Invalid email').or(z.literal('')),
  first_name: z.string().max(150).optional(),
  last_name: z.string().max(150).optional(),
  phone: z.string().max(20).optional(),
  nrc: z.string().optional(),
  department_id: z.number().int().nullable().optional(),
  wholesale_id: z.number().int().nullable().optional(),
  role_ids: z.array(z.number().int()).optional(),
  password: z.string().optional(),
  is_active: z.boolean(),
  is_staff: z.boolean(),
  is_superuser: z.boolean(),
})

type Form = z.infer<typeof baseSchema>


// ---------------------------------------------------------------------------
// Helper — filter roles by selected department
// ---------------------------------------------------------------------------

function rolesForDepartment(
  roles: Role[],
  selectedDepartmentId: number | null,
  departments: { id: number; code: string; name: string }[],
): Role[] {
  if (!selectedDepartmentId) return roles

  const deptCode = departments.find((d) => d.id === selectedDepartmentId)?.code
  if (!deptCode) return roles

  return roles.filter(
    (r) =>
      r.department_codes.length === 0 ||
      r.department_codes.includes(deptCode),
  )
}


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function UsersPage() {
  const isReadOnly = useIsReadOnly()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)

  const { data: users = [], isLoading } = useUsers()
  const { data: departments = [] } = useDepartments()
  const { data: roles = [] } = useRoles()

  const createUser = useCreateUser()
  const updateUser = useUpdateUser(editing?.id ?? 0)
  const deleteUser = useDeleteUser()

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.nrc ?? '').toLowerCase().includes(q),
    )
  }, [users, search])

  const columns = useMemo<MRT_ColumnDef<User>[]>(() => {
    const base: MRT_ColumnDef<User>[] = [
      {
        accessorKey: 'full_name',
        header: 'User',
        size: 200,
        Cell: ({ row }) => (
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-200">
              {row.original.full_name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              @{row.original.username}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'nrc',
        header: 'NRC',
        size: 140,
        Cell: ({ cell }) => {
          const v = cell.getValue<string | null>()
          return v ? (
            <span className="font-mono text-xs">{v}</span>
          ) : (
            <span className="text-slate-400">—</span>
          )
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        size: 200,
        Cell: ({ cell }) => cell.getValue<string>() || '—',
      },
      {
        accessorKey: 'department',
        header: 'Department',
        size: 150,
        Cell: ({ cell }) => cell.getValue<{ name: string } | null>()?.name ?? '—',
      },
      {
        accessorKey: 'wholesale',
        header: 'Outlet',
        size: 150,
        Cell: ({ cell }) => cell.getValue<{ name: string } | null>()?.name ?? '—',
      },
      {
        accessorKey: 'roles',
        header: 'Roles',
        size: 200,
        enableSorting: false,
        Cell: ({ cell }) => {
          const rs = cell.getValue<{ name: string }[]>() ?? []
          if (rs.length === 0) return <span className="text-slate-400">—</span>
          return (
            <div className="flex flex-wrap gap-1">
              {rs.slice(0, 2).map((r) => (
                <span
                  key={r.name}
                  className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {r.name}
                </span>
              ))}
              {rs.length > 2 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  +{rs.length - 2}
                </span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'is_superuser',
        header: 'Super',
        size: 80,
        Cell: ({ cell }) =>
          cell.getValue<boolean>() ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <ShieldOff className="h-3.5 w-3.5" />
            </span>
          ),
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        size: 100,
        Cell: ({ cell }) => (
          <StatusBadge status={cell.getValue<boolean>() ? 'active' : 'inactive'} />
        ),
      },
      {
        accessorKey: 'last_login',
        header: 'Last Login',
        size: 160,
        Cell: ({ cell }) => {
          const v = cell.getValue<string | null>()
          return v ? formatDateTime(v) : '—'
        },
      },
    ]

    if (!isReadOnly) {
      base.push({
        id: 'actions',
        header: '',
        size: 60,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <DropdownMenu trigger={
            <span className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
              •••
            </span>
          }>
            <DropdownItem onClick={() => { setEditing(row.original); setDialogOpen(true) }}>
              <span className="flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </span>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem destructive onClick={() => setConfirmDelete(row.original)}>
              <span className="flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </span>
            </DropdownItem>
          </DropdownMenu>
        ),
      })
    }

    return base
  }, [isReadOnly])

  const handleSave = async (data: Form) => {
    if (!editing && !data.password) {
      toast.error('Password is required when creating a user')
      return
    }

    const payload: UserFormData = {
      username: data.username,
      email: data.email || '',
      first_name: data.first_name ?? '',
      last_name: data.last_name ?? '',
      phone: data.phone ?? '',
      nrc: data.nrc || undefined,
      department_id: data.department_id ?? null,
      wholesale_id: data.wholesale_id ?? null,
      role_ids: data.role_ids ?? [],
      is_active: data.is_active,
      is_staff: data.is_staff,
      is_superuser: data.is_superuser,
    }
    if (data.password) payload.password = data.password

    try {
      if (editing) {
        await updateUser.mutateAsync(payload)
        toast.success('User updated')
      } else {
        await createUser.mutateAsync(payload)
        toast.success('User created')
      }
      setDialogOpen(false)
      setEditing(null)
    } catch (err) {
      const msg = (err as { response?: { data?: unknown } })?.response?.data
      if (msg && typeof msg === 'object' && 'nrc' in msg) {
        toast.error(String((msg as { nrc: string[] }).nrc[0]))
      } else {
        toast.error(msg ? JSON.stringify(msg) : 'Save failed')
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage user accounts, departments, and role assignments.
        </p>
        <WriteOnly>
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> New User
          </Button>
        </WriteOnly>
      </div>

      <FilterBar active={Boolean(search)} onClear={() => setSearch('')}>
        <Input
          placeholder="Search name, username, email, or NRC…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No users yet"
        emptyDescription="Click 'New User' to create the first account."
      />

      {dialogOpen && (
        <UserDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditing(null) }}
          onSubmit={handleSave}
          initial={editing}
          departments={departments}
          roles={roles}
          loading={createUser.isPending || updateUser.isPending}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          try {
            await deleteUser.mutateAsync(confirmDelete.id)
            toast.success('User deleted')
          } catch { toast.error('Delete failed') }
        }}
        title="Delete this user?"
        description={confirmDelete ? `@${confirmDelete.username} will be removed. This cannot be undone.` : ''}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  )
}


// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

function UserDialog({
  open, onClose, onSubmit, initial, departments, roles, loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (d: Form, passwordChanged: boolean) => void | Promise<void>
  initial: User | null
  departments: { id: number; code: string; name: string }[]
  roles: Role[]
  loading: boolean
}) {
  const { data: outlets = [] } = useOutlets()

  const initialRoleIds = initial?.roles.map((r) => r.id) ?? []

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      username: initial?.username ?? '',
      email: initial?.email ?? '',
      first_name: initial?.first_name ?? '',
      last_name: initial?.last_name ?? '',
      phone: initial?.phone ?? '',
      nrc: initial?.nrc ?? '',
      department_id: initial?.department?.id ?? null,
      wholesale_id: initial?.wholesale?.id ?? null,
      role_ids: initialRoleIds,
      password: '',
      is_active: initial?.is_active ?? true,
      is_staff: initial?.is_staff ?? false,
      is_superuser: initial?.is_superuser ?? false,
    },
  })

  const selectedRoles = watch('role_ids') ?? []
  const selectedDepartmentId = watch('department_id') ?? null

  const visibleRoles = useMemo(
    () => rolesForDepartment(roles, selectedDepartmentId, departments),
    [roles, selectedDepartmentId, departments],
  )

  // Auto-remove any selected roles that are no longer visible when
  // the department changes — keeps the form consistent.
  useEffect(() => {
    const visibleIds = new Set(visibleRoles.map((r) => r.id))
    const filtered = selectedRoles.filter((id) => visibleIds.has(id))
    if (filtered.length !== selectedRoles.length) {
      setValue('role_ids', filtered)
    }
  }, [visibleRoles, selectedRoles, setValue])

  const toggleRole = (id: number) => {
    const next = selectedRoles.includes(id)
      ? selectedRoles.filter((x) => x !== id)
      : [...selectedRoles, id]
    setValue('role_ids', next)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit user' : 'New user'}
      className="max-w-2xl"
    >
      <form
        onSubmit={handleSubmit((d) => onSubmit(d, Boolean(d.password)))}
        className="space-y-4"
      >
        {/* Username + Email */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Username"
            required
            error={errors.username}
            {...register('username')}
          />
          <FormField
            label="Email"
            type="email"
            error={errors.email}
            {...register('email')}
          />
        </div>

        {/* First + Last name */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="First Name"
            error={errors.first_name}
            {...register('first_name')}
          />
          <FormField
            label="Last Name"
            error={errors.last_name}
            {...register('last_name')}
          />
        </div>

        {/* Phone + NRC */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Phone"
            error={errors.phone}
            {...register('phone')}
          />
          <Controller
            name="nrc"
            control={control}
            render={({ field }) => (
              <NrcInput
                label="NRC Number"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        {/* Password */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Password {initial ? '(leave blank to keep)' : ''}
            {!initial && <span className="text-red-500">*</span>}
          </label>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={initial ? '••••••••' : 'Set a password'}
            error={Boolean(errors.password)}
            {...register('password')}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Department */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Department
          </label>
          <Controller
            name="department_id"
            control={control}
            render={({ field }) => (
              <select
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(e.target.value ? Number(e.target.value) : null)
                }
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          />
        </div>

        {/* Wholesale Outlet */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Wholesale Outlet (optional scope)
          </label>
          <Controller
            name="wholesale_id"
            control={control}
            render={({ field }) => (
              <select
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(e.target.value ? Number(e.target.value) : null)
                }
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">No outlet scope</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            )}
          />
        </div>

        {/* Roles — filtered by department */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Roles
            {selectedDepartmentId && (
              <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                (filtered to{' '}
                {departments.find((d) => d.id === selectedDepartmentId)?.name})
              </span>
            )}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleRoles.map((r) => {
              const checked = selectedRoles.includes(r.id)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRole(r.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition',
                    checked
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
                      : 'border-slate-200 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-3.5 w-3.5 items-center justify-center rounded border',
                      checked
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-slate-300 dark:border-slate-500',
                    )}
                  >
                    {checked && (
                      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">{r.name}</span>
                  {r.department_codes.length === 0 && (
                    <span className="ml-auto text-[10px] font-normal text-slate-400 dark:text-slate-500">
                      global
                    </span>
                  )}
                </button>
              )
            })}
            {visibleRoles.length === 0 && (
              <p className="col-span-full text-xs text-slate-500 dark:text-slate-400">
                No roles are configured for this department. Clear the
                department to see all roles.
              </p>
            )}
          </div>
        </div>

        {/* Flags */}
        <div className="flex flex-wrap gap-4 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
              {...register('is_active')}
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
              {...register('is_staff')}
            />
            Staff
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
              {...register('is_superuser')}
            />
            Superuser
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : initial ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}