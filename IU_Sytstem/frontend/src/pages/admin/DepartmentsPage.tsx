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
  useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment,
} from '@/hooks/queries/useCore'
import { useIsReadOnly } from '@/hooks/useIsReadOnly'
import type { Department, DepartmentFormData } from '@/types/core'

const schema = z.object({
  code: z.string().min(1, 'Code required').max(50),
  name: z.string().min(1, 'Name required').max(100),
  description: z.string().optional(),
})

type Form = z.infer<typeof schema>

export function DepartmentsPage() {
  const isReadOnly = useIsReadOnly()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Department | null>(null)

  const { data: departments = [], isLoading } = useDepartments()
  const createDept = useCreateDepartment()
  const updateDept = useUpdateDepartment(editing?.id ?? 0)
  const deleteDept = useDeleteDepartment()

  const columns = useMemo<MRT_ColumnDef<Department>[]>(() => {
    const base: MRT_ColumnDef<Department>[] = [
      { accessorKey: 'code', header: 'Code', size: 140,
        Cell: ({ cell }) => (
          <span className="font-mono text-sm font-semibold">{cell.getValue<string>()}</span>
        ) },
      { accessorKey: 'name', header: 'Name' },
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
        await updateDept.mutateAsync(data as DepartmentFormData)
        toast.success('Department updated')
      } else {
        await createDept.mutateAsync(data as DepartmentFormData)
        toast.success('Department created')
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
          Organizational units used to categorize users and products.
        </p>
        <WriteOnly>
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> New Department
          </Button>
        </WriteOnly>
      </div>

      <DataTable columns={columns} data={departments} isLoading={isLoading}
        emptyTitle="No departments"
        emptyDescription="Run the seed_roles command to load defaults, or add one manually." />

      {dialogOpen && (
        <DepartmentDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditing(null) }}
          onSubmit={handleSave}
          initial={editing}
          loading={createDept.isPending || updateDept.isPending}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          try {
            await deleteDept.mutateAsync(confirmDelete.id)
            toast.success('Department deleted')
          } catch { toast.error('Delete failed') }
        }}
        title="Delete this department?"
        description={confirmDelete ? `"${confirmDelete.name}" will be removed. Users and products linked to it keep their data but lose the link.` : ''}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  )
}

function DepartmentDialog({
  open, onClose, onSubmit, initial, loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (d: Form) => void | Promise<void>
  initial: Department | null
  loading: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initial?.code ?? '',
      name: initial?.name ?? '',
      description: initial?.description ?? '',
    },
  })

  return (
    <Dialog open={open} onClose={onClose}
      title={initial ? 'Edit department' : 'New department'} className="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Code" required placeholder="transport" error={errors.code}
          {...register('code')} />
        <FormField label="Name" required placeholder="Transport & Logistics"
          error={errors.name} {...register('name')} />
        <FormField label="Description" placeholder="What this department does…"
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