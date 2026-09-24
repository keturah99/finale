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
import { FormSelect } from '@/components/forms/FormSelect'
import { RegNumberInput } from '@/components/shared/RegNumberInput'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownItem,
  DropdownSeparator,
} from '@/components/ui/dropdown-menu'

import {
  useTrailers,
  useCreateTrailer,
  useUpdateTrailer,
  useDeleteTrailer,
} from '@/hooks/queries/useTransport'
import type {
  Trailer,
  TrailerFormData,
  TrailerStatus,
  VehicleCategory,
} from '@/types/transport'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const trailerSchema = z.object({
  registration_number: z
    .string()
    .regex(/^[A-Z]{3} \d{4}$/, 'Format: ABC 1234'),
  make: z.string().min(1, 'Make required').max(50),
  tonnage: z.string().min(1, 'Tonnage required'),
  category: z.enum(['public', 'private']),
  status: z.enum(['available', 'on_trip', 'maintenance', 'retired']),
  notes: z.string().optional(),
})

type TrailerForm = z.infer<typeof trailerSchema>

const CATEGORY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
]

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'on_trip', label: 'On Trip' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function TrailersPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Trailer | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Trailer | null>(null)

  const { data: trailers = [], isLoading } = useTrailers({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(categoryFilter ? { category: categoryFilter } : {}),
  })

  const createTrailer = useCreateTrailer()
  const updateTrailer = useUpdateTrailer(editing?.id ?? 0)
  const deleteTrailer = useDeleteTrailer()

  const filtered = useMemo(() => {
    if (!search) return trailers
    const q = search.toLowerCase()
    return trailers.filter(
      (t) =>
        t.registration_number.toLowerCase().includes(q) ||
        t.make.toLowerCase().includes(q),
    )
  }, [trailers, search])

  const columns = useMemo<MRT_ColumnDef<Trailer>[]>(
    () => [
      {
        accessorKey: 'registration_number',
        header: 'Registration',
        size: 140,
        Cell: ({ cell }) => (
          <span className="font-mono font-semibold text-slate-800">
            {cell.getValue<string>()}
          </span>
        ),
      },
      { accessorKey: 'make', header: 'Make', size: 140 },
      {
        accessorKey: 'tonnage',
        header: 'Tonnage',
        size: 100,
        Cell: ({ cell }) => `${cell.getValue<string>()} t`,
      },
      {
        accessorKey: 'category',
        header: 'Category',
        size: 110,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 120,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} />,
      },
      {
        id: 'actions',
        header: '',
        size: 60,
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

  const handleSave = async (data: TrailerForm) => {
    try {
      const payload = data as TrailerFormData
      if (editing) {
        await updateTrailer.mutateAsync(payload)
        toast.success('Trailer updated')
      } else {
        await createTrailer.mutateAsync(payload)
        toast.success('Trailer created')
      }
      setDialogOpen(false)
      setEditing(null)
    } catch (err) {
      const msg = (err as { response?: { data?: unknown } })?.response?.data
      toast.error(msg ? JSON.stringify(msg) : 'Save failed')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await deleteTrailer.mutateAsync(confirmDelete.id)
      toast.success('Trailer deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500">
          Trailers for semi-trucks. Attached per-trip during dispatch.
        </p>
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          New Trailer
        </Button>
      </div>

      <FilterBar
        active={Boolean(statusFilter || categoryFilter || search)}
        onClear={() => {
          setStatusFilter('')
          setCategoryFilter('')
          setSearch('')
        }}
      >
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-40"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Search registration or make…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No trailers yet"
        emptyDescription="Click 'New Trailer' to add your first trailer."
      />

      {dialogOpen && (
        <TrailerDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
          onSubmit={handleSave}
          initial={editing}
          loading={createTrailer.isPending || updateTrailer.isPending}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete this trailer?"
        description={
          confirmDelete
            ? `"${confirmDelete.registration_number}" will be removed.`
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

function TrailerDialog({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: TrailerForm) => void | Promise<void>
  initial: Trailer | null
  loading: boolean
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TrailerForm>({
    resolver: zodResolver(trailerSchema),
    defaultValues: {
      registration_number: initial?.registration_number ?? '',
      make: initial?.make ?? '',
      tonnage: initial?.tonnage ?? '',
      category: (initial?.category ?? 'private') as VehicleCategory,
      status: (initial?.status ?? 'available') as TrailerStatus,
      notes: initial?.notes ?? '',
    },
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit trailer' : 'New trailer'}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Controller
          name="registration_number"
          control={control}
          render={({ field }) => (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Registration <span className="text-red-500">*</span>
              </label>
              <RegNumberInput value={field.value} onChange={field.onChange} />
              {errors.registration_number && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.registration_number.message}
                </p>
              )}
            </div>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Make"
            required
            placeholder="HOWO"
            error={errors.make}
            {...register('make')}
          />
          <Controller
            name="tonnage"
            control={control}
            render={({ field }) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Tonnage <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="12.00"
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(e.target.value.replace(/[^\d.]/g, ''))
                  }
                  error={Boolean(errors.tonnage)}
                />
                {errors.tonnage && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.tonnage.message}
                  </p>
                )}
              </div>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormSelect
            label="Category"
            required
            options={CATEGORY_OPTIONS}
            error={errors.category}
            {...register('category')}
          />
          <FormSelect
            label="Status"
            required
            options={STATUS_OPTIONS}
            error={errors.status}
            {...register('status')}
          />
        </div>

        <FormField
          label="Notes"
          placeholder="Optional notes…"
          error={errors.notes}
          {...register('notes')}
        />

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