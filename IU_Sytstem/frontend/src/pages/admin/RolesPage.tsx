import { useMemo, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/forms/FormField'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { WriteOnly } from '@/components/guards/WriteOnly'
import {
  DropdownMenu, DropdownItem, DropdownSeparator,
} from '@/components/ui/dropdown-menu'

import {
  useRoles, useCreateRole, useUpdateRole, useDeleteRole,
  useDepartments,
} from '@/hooks/queries/useCore'
import { useIsReadOnly } from '@/hooks/useIsReadOnly'
import type { Role, RoleFormData } from '@/types/core'
import { cn } from '@/lib/utils'


const schema = z.object({
  name: z.string().min(1, 'Name required').max(50),
  description: z.string().optional(),
  department_ids: z.array(z.number().int()).optional(),
})

type Form = z.infer<typeof schema>


export function RolesPage() {
  const isReadOnly = useIsReadOnly()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null)

  const { data: roles = [], isLoading } = useRoles()
  const { data: departments = [] } = useDepartments()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole(editing?.id ?? 0)
  const deleteRole = useDeleteRole()

  const columns = useMemo<MRT_ColumnDef<Role>[]>(() => {
    const base: MRT_ColumnDef<Role>[] = [
      {
        accessorKey: 'name',
        header: 'Role',
        size: 220,
        Cell: ({ cell }) => (
          <span className="font-mono text-sm font-semibold">
            {cell.getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        Cell: ({ cell }) => cell.getValue<string>() || '—',
      },
      {
        accessorKey: 'department_codes',
        header: 'Departments',
        size: 240,
        enableSorting: false,
        Cell: ({ cell }) => {
          const codes = cell.getValue<string[]>() ?? []
          if (codes.length === 0) {
            return (
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                global
              </span>
            )
          }
          return (
            <div className="flex flex-wrap gap-1">
              {codes.map((c) => (
                <span
                  key={c}
                  className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {c}
                </span>
              ))}
            </div>
          )
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
    try {
      const payload = data as RoleFormData
      if (editing) {
        await updateRole.mutateAsync(payload)
        toast.success('Role updated')
      } else {
        await createRole.mutateAsync(payload)
        toast.success('Role created')
      }
      setDialogOpen(false)
      setEditing(null)
    } catch (err) {
      const msg = (err as { response?: { data?: unknown } })?.response?.data
      toast.error(msg ? JSON.stringify(msg) : 'Save failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Role names used by the permission system. Departments determine where a
          role appears in the user form. Roles with no departments are treated as
          global.
        </p>
        <WriteOnly>
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> New Role
          </Button>
        </WriteOnly>
      </div>

      <DataTable
        columns={columns}
        data={roles}
        isLoading={isLoading}
        emptyTitle="No roles defined"
        emptyDescription="Run the seed_roles command to load defaults, or add one manually."
      />

      {dialogOpen && (
        <RoleDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditing(null) }}
          onSubmit={handleSave}
          initial={editing}
          departments={departments}
          loading={createRole.isPending || updateRole.isPending}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          try {
            await deleteRole.mutateAsync(confirmDelete.id)
            toast.success('Role deleted')
          } catch { toast.error('Delete failed') }
        }}
        title="Delete this role?"
        description={confirmDelete ? `"${confirmDelete.name}" will be removed. Users with this role lose access.` : ''}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  )
}


function RoleDialog({
  open, onClose, onSubmit, initial, departments, loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (d: Form) => void | Promise<void>
  initial: Role | null
  departments: { id: number; code: string; name: string }[]
  loading: boolean
}) {
  // Initial departments derived from the department_codes on the role
  const initialDeptIds = useMemo(() => {
    if (!initial) return []
    return departments
      .filter((d) => initial.department_codes.includes(d.code))
      .map((d) => d.id)
  }, [initial, departments])

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      department_ids: initialDeptIds,
    },
  })

  const selectedDepartments = watch('department_ids') ?? []

  const toggleDepartment = (id: number) => {
    const next = selectedDepartments.includes(id)
      ? selectedDepartments.filter((x) => x !== id)
      : [...selectedDepartments, id]
    setValue('department_ids', next)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit role' : 'New role'}
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="payroll_officer"
          error={errors.name}
          {...register('name')}
        />
        <FormField
          label="Description"
          placeholder="What this role grants access to…"
          error={errors.description}
          {...register('description')}
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Departments
            <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
              (empty = global role)
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {departments.map((d) => {
              const checked = selectedDepartments.includes(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDepartment(d.id)}
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
                  <span className="truncate">{d.name}</span>
                </button>
              )
            })}
          </div>
        </div>

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