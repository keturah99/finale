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
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownItem, DropdownSeparator,
} from '@/components/ui/dropdown-menu'

import {
  useFarmers, useCreateFarmer, useUpdateFarmer, useDeleteFarmer,
} from '@/hooks/queries/useSupplyChain'
import { useIsReadOnly } from '@/hooks/useIsReadOnly'
import type { Farmer, FarmerFormData } from '@/types/supplychain'

const schema = z.object({
  first_name: z.string().min(1, 'First name required').max(80),
  last_name: z.string().min(1, 'Last name required').max(80),
  phone: z.string().max(20).optional(),
  nrc: z.string().max(20).optional(),
  location: z.string().max(150).optional(),
  notes: z.string().optional(),
  is_active: z.boolean(),
})

type Form = z.infer<typeof schema>

export function FarmersPage() {
  const isReadOnly = useIsReadOnly()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Farmer | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Farmer | null>(null)

  const { data: farmers = [], isLoading } = useFarmers()
  const createFarmer = useCreateFarmer()
  const updateFarmer = useUpdateFarmer(editing?.id ?? 0)
  const deleteFarmer = useDeleteFarmer()

  const filtered = useMemo(() => {
    if (!search) return farmers
    const q = search.toLowerCase()
    return farmers.filter(
      (f) =>
        f.full_name.toLowerCase().includes(q) ||
        f.phone.includes(q) ||
        f.location.toLowerCase().includes(q),
    )
  }, [farmers, search])

  const columns = useMemo<MRT_ColumnDef<Farmer>[]>(() => {
    const base: MRT_ColumnDef<Farmer>[] = [
      { accessorKey: 'full_name', header: 'Farmer', size: 200 },
      { accessorKey: 'phone', header: 'Phone', size: 140 },
      { accessorKey: 'nrc', header: 'NRC', size: 120,
        Cell: ({ cell }) => cell.getValue<string>() || '—' },
      { accessorKey: 'location', header: 'Location', size: 180 },
      { accessorKey: 'is_active', header: 'Status', size: 110,
        Cell: ({ cell }) => (
          <StatusBadge status={cell.getValue<boolean>() ? 'active' : 'inactive'} />
        ) },
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
            <span className="cursor-pointer rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700">•••</span>
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
        await updateFarmer.mutateAsync(data as FarmerFormData)
        toast.success('Farmer updated')
      } else {
        await createFarmer.mutateAsync(data as FarmerFormData)
        toast.success('Farmer added')
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
        <p className="text-sm text-slate-500 dark:text-slate-400">Producers who supply crops to the company.</p>
        <WriteOnly>
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> New Farmer
          </Button>
        </WriteOnly>
      </div>

      <FilterBar active={Boolean(search)} onClear={() => setSearch('')}>
        <Input
          placeholder="Search name, phone, or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No farmers yet"
        emptyDescription="Click 'New Farmer' to register your first producer."
      />

      {dialogOpen && (
        <FarmerDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditing(null) }}
          onSubmit={handleSave}
          initial={editing}
          loading={createFarmer.isPending || updateFarmer.isPending}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          try {
            await deleteFarmer.mutateAsync(confirmDelete.id)
            toast.success('Farmer deleted')
          } catch { toast.error('Delete failed') }
        }}
        title="Delete this farmer?"
        description={confirmDelete ? `"${confirmDelete.full_name}" will be removed.` : ''}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  )
}

function FarmerDialog({
  open, onClose, onSubmit, initial, loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: Form) => void | Promise<void>
  initial: Farmer | null
  loading: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: initial?.first_name ?? '',
      last_name: initial?.last_name ?? '',
      phone: initial?.phone ?? '',
      nrc: initial?.nrc ?? '',
      location: initial?.location ?? '',
      notes: initial?.notes ?? '',
      is_active: initial?.is_active ?? true,
    },
  })

  return (
    <Dialog open={open} onClose={onClose}
      title={initial ? 'Edit farmer' : 'New farmer'} className="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="First name" required error={errors.first_name} {...register('first_name')} />
          <FormField label="Last name" required error={errors.last_name} {...register('last_name')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Phone" placeholder="0977123456" error={errors.phone} {...register('phone')} />
          <FormField label="NRC Number" placeholder="123456/78/9" error={errors.nrc} {...register('nrc')} />
        </div>
        <FormField label="Location" placeholder="Chipata District" error={errors.location} {...register('location')} />
        <FormField label="Notes" placeholder="Optional notes…" error={errors.notes} {...register('notes')} />

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('is_active')} />
          Active
        </label>

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