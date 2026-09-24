import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { MRT_ColumnDef } from 'material-react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/forms/FormField'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  DropdownMenu,
  DropdownItem,
  DropdownSeparator,
} from '@/components/ui/dropdown-menu'

import {
  useOutlets,
  useCreateOutlet,
  useUpdateOutlet,
  useDeleteOutlet,
} from '@/hooks/queries/useWholesale'
import type { Wholesale, WholesaleFormData } from '@/types/wholesale'

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const outletSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  location: z.string().max(200).optional().default(''),
  phone: z.string().max(20).optional().default(''),
  is_active: z.boolean().default(true),
})

type OutletForm = z.infer<typeof outletSchema>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OutletsPage() {
  const { data: outlets = [], isLoading } = useOutlets()
  const createOutlet = useCreateOutlet()
  const deleteOutlet = useDeleteOutlet()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Wholesale | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Wholesale | null>(null)

  const updateOutlet = useUpdateOutlet(editing?.id ?? 0)

  const columns = useMemo<MRT_ColumnDef<Wholesale>[]>(
    () => [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'location', header: 'Location' },
      { accessorKey: 'phone', header: 'Phone' },
      {
        accessorKey: 'manager_name',
        header: 'Manager',
        Cell: ({ cell }) => cell.getValue<string | null>() ?? '—',
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        Cell: ({ cell }) => (
          <StatusBadge status={cell.getValue<boolean>() ? 'active' : 'inactive'} />
        ),
      },
      {
        id: 'actions',
        header: '',
        size: 80,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <DropdownMenu
            trigger={
              <span className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                •••
              </span>
            }
          >
            <DropdownItem
              onClick={() => {
                setEditing(row.original)
                setDialogOpen(true)
              }}
            >
              <span className="flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </span>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              destructive
              onClick={() => setConfirmDelete(row.original)}
            >
              <span className="flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </span>
            </DropdownItem>
          </DropdownMenu>
        ),
      },
    ],
    [],
  )

  const handleSave = async (data: OutletForm) => {
    try {
      if (editing) {
        await updateOutlet.mutateAsync(data)
        toast.success('Outlet updated')
      } else {
        await createOutlet.mutateAsync(data as WholesaleFormData)
        toast.success('Outlet created')
      }
      setDialogOpen(false)
      setEditing(null)
    } catch (err) {
      const msg =
        (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      toast.error(msg ? JSON.stringify(msg) : 'Save failed')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await deleteOutlet.mutateAsync(confirmDelete.id)
      toast.success('Outlet deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          New Outlet
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={outlets}
        isLoading={isLoading}
        emptyTitle="No wholesale outlets yet"
        emptyDescription="Create your first outlet to start tracking stock."
      />

      <OutletDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        onSubmit={handleSave}
        initial={editing}
        loading={createOutlet.isPending || updateOutlet.isPending}
        />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete this outlet?"
        description={
          confirmDelete
            ? `"${confirmDelete.name}" will be removed. Stock levels and history are preserved.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialog with RHF form
// ---------------------------------------------------------------------------

function OutletDialog({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: OutletForm) => void | Promise<void>
  initial: Wholesale | null
  loading: boolean
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(outletSchema),
    defaultValues: {
      name: initial?.name ?? '',
      location: initial?.location ?? '',
      phone: initial?.phone ?? '',
      is_active: initial?.is_active ?? true,
    },
  })

  // Reset the form whenever the dialog opens or the initial record changes
  if (open && initial && initial.name !== undefined) {
    // no-op: rely on key prop in parent to remount
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit outlet' : 'New outlet'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Wholesale Lusaka"
          error={errors.name}
          {...register('name')}
        />
        <FormField
          label="Location"
          placeholder="Lusaka Industrial Area"
          error={errors.location}
          {...register('location')}
        />
        <FormField
          label="Phone"
          placeholder="0977111222"
          error={errors.phone}
          {...register('phone')}
        />

        <div className="flex items-center gap-2">
          <input
            id="is_active"
            type="checkbox"
            {...register('is_active')}
            className="h-4 w-4 rounded border-slate-300"
          />
          <label htmlFor="is_active" className="text-sm text-slate-700">
            Active
          </label>
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