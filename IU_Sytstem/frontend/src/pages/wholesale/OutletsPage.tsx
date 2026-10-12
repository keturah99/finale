import { useMemo, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
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
import { WriteOnly } from '@/components/guards/WriteOnly'
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
import { useIsReadOnly } from '@/hooks/useIsReadOnly'
import type { Wholesale, WholesaleFormData } from '@/types/wholesale'

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const outletSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  location: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  is_active: z.boolean(),
})

type OutletForm = z.infer<typeof outletSchema>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OutletsPage() {
  const isReadOnly = useIsReadOnly()

  const { data: outlets = [], isLoading } = useOutlets()
  const createOutlet = useCreateOutlet()
  const deleteOutlet = useDeleteOutlet()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Wholesale | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Wholesale | null>(null)

  const updateOutlet = useUpdateOutlet(editing?.id ?? 0)

  const columns = useMemo<MRT_ColumnDef<Wholesale>[]>(() => {
    const base: MRT_ColumnDef<Wholesale>[] = [
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
    ]

    if (!isReadOnly) {
      base.push({
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
      })
    }

    return base
  }, [isReadOnly])

  const handleSave = async (data: OutletForm) => {
    try {
      const payload: WholesaleFormData = {
        name: data.name,
        location: data.location ?? '',
        manager: editing?.manager ?? null,
        phone: data.phone ?? '',
        is_active: data.is_active,
      }

      if (editing) {
        await updateOutlet.mutateAsync(payload)
        toast.success('Outlet updated')
      } else {
        await createOutlet.mutateAsync(payload)
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
        <WriteOnly>
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            New Outlet
          </Button>
        </WriteOnly>
      </div>

      <DataTable
        columns={columns}
        data={outlets}
        isLoading={isLoading}
        emptyTitle="No wholesale outlets yet"
        emptyDescription="Create your first outlet to start tracking stock."
      />

      {dialogOpen && (
        <OutletDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
          onSubmit={handleSave}
          initial={editing}
          loading={createOutlet.isPending || updateOutlet.isPending}
        />
      )}

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
// Dialog
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
  } = useForm<OutletForm>({
    resolver: zodResolver(outletSchema),
    defaultValues: {
      name: initial?.name ?? '',
      location: initial?.location ?? '',
      phone: initial?.phone ?? '',
      is_active: initial?.is_active ?? true,
    },
  })
 
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