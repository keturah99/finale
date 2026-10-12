import { useMemo, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
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
} from '@/hooks/queries/useCore'
import { useIsReadOnly } from '@/hooks/useIsReadOnly'
import type { Role, RoleFormData } from '@/types/core'

const schema = z.object({
  name: z.string().min(1, 'Name required').max(50),
  description: z.string().optional(),
})

type Form = z.infer<typeof schema>

export function RolesPage() {
  const isReadOnly = useIsReadOnly()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null)

  const { data: roles = [], isLoading } = useRoles()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole(editing?.id ?? 0)
  const deleteRole = useDeleteRole()

  const columns = useMemo<MRT_ColumnDef<Role>[]>(() => {
    const base: MRT_ColumnDef<Role>[] = [
      { accessorKey: 'name', header: 'Role', size: 220,
        Cell: ({ cell }) => (
          <span className="font-mono text-sm font-semibold">{cell.getValue<string>()}</span>
        ) },
      { accessorKey: 'description', header: 'Description',
        Cell: ({ cell }) => cell.getValue<string>() || '—' },
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
            <span className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">•••</span>
          }>
            <DropdownItem onClick={() => { setEditing(row.original); setDialogOpen(true) }}>
              <span className="flex items-center gap-2"><Pencil className="h-3.5 w-3.5" /> Edit</span>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem destructive onClick={() => setConfirmDelete(row.original)}>
              <span className="flex items-center gap-2"><Trash2 className="h-3.5 w-3.5" /> Delete</span>
            </DropdownItem>
          </DropdownMenu>
        ),
      })
    }

    return base
  }, [isReadOnly])

  const handleSave = async (data: Form) => {
    try {
      if (editing) {
        await updateRole.mutateAsync(data as RoleFormData)
        toast.success('Role updated')
      } else {
        await createRole.mutateAsync(data as RoleFormData)
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
        <p className="text-sm text-slate-500">
          Role names used by the permission system. Assign roles to users to grant module access.
        </p>
        <WriteOnly>
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> New Role
          </Button>
        </WriteOnly>
      </div>

      <DataTable columns={columns} data={roles} isLoading={isLoading}
        emptyTitle="No roles defined"
        emptyDescription="Run the seed_roles command to load defaults, or add one manually." />

      {dialogOpen && (
        <RoleDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditing(null) }}
          onSubmit={handleSave}
          initial={editing}
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
  open, onClose, onSubmit, initial, loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (d: Form) => void | Promise<void>
  initial: Role | null
  loading: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
    },
  })

  return (
    <Dialog open={open} onClose={onClose}
      title={initial ? 'Edit role' : 'New role'} className="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Name" required placeholder="payroll_officer"
          error={errors.name} {...register('name')} />
        <FormField label="Description" placeholder="What this role grants access to…"
          error={errors.description} {...register('description')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : initial ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}