import { useMemo, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/forms/FormField'
import { FormSelect } from '@/components/forms/FormSelect'
import { FormCombobox } from '@/components/forms/FormCombobox'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownItem } from '@/components/ui/dropdown-menu'

import {
  useCollections,
  useCreateCollection,
  useMarkCollected,
} from '@/hooks/queries/useWholesale'
import { useScopedOutlets } from '@/hooks/useScopedOutlets'
import { useIsReadOnly } from '@/hooks/useIsReadOnly'
import { formatK, formatDate } from '@/lib/format'
import type {
  PendingCollection,
  PendingCollectionFormData,
} from '@/types/wholesale'

const schema = z.object({
  wholesale: z.number().int().positive(),
  customer_name: z.string().min(1, 'Name required').max(150),
  customer_phone: z.string().max(20).optional(),
  description: z.string().min(1, 'Description required'),
  total_price: z.string().min(1, 'Total price required'),
  amount_paid: z.string().optional(),
  collection_deadline: z.string().optional(),
  status: z.enum(['pending', 'ready', 'collected', 'cancelled']),
})

type Form = z.infer<typeof schema>

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'ready', label: 'Ready for Collection' },
  { value: 'collected', label: 'Collected' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function LaybysPage() {
  const isReadOnly = useIsReadOnly()

  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { outlets } = useScopedOutlets()
  const { data: collections = [], isLoading } = useCollections(
    statusFilter ? { status: statusFilter } : undefined,
  )
  const createCollection = useCreateCollection()
  const markCollected = useMarkCollected()

  const filtered = useMemo(() => {
    if (!search) return collections
    const q = search.toLowerCase()
    return collections.filter(
      (c) =>
        c.customer_name.toLowerCase().includes(q) ||
        c.customer_phone.includes(q),
    )
  }, [collections, search])

  const columns = useMemo<MRT_ColumnDef<PendingCollection>[]>(() => {
    const base: MRT_ColumnDef<PendingCollection>[] = [
      { accessorKey: 'wholesale_name', header: 'Outlet', size: 160 },
      {
        accessorKey: 'customer_name',
        header: 'Customer',
        size: 180,
        Cell: ({ row }) => (
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-100">
              {row.original.customer_name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {row.original.customer_phone || '—'}
            </p>
          </div>
        ),
      },
      { accessorKey: 'description', header: 'Description' },
      {
        accessorKey: 'total_price',
        header: 'Total',
        size: 120,
        Cell: ({ cell }) => formatK(cell.getValue<string>()),
      },
      {
        accessorKey: 'amount_paid',
        header: 'Paid',
        size: 120,
        Cell: ({ cell }) => formatK(cell.getValue<string>()),
      },
      {
        accessorKey: 'balance',
        header: 'Balance',
        size: 120,
        Cell: ({ cell }) => {
          const v = Number(cell.getValue<string>() || 0)
          return v > 0 ? (
            <span className="font-semibold text-red-600">{formatK(v)}</span>
          ) : (
            '—'
          )
        },
      },
      {
        accessorKey: 'collection_deadline',
        header: 'Deadline',
        size: 130,
        Cell: ({ cell }) => {
          const v = cell.getValue<string | null>()
          return v ? formatDate(v) : '—'
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 130,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} />,
      },
    ]

    if (!isReadOnly) {
      base.push({
        id: 'actions',
        header: '',
        size: 60,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) =>
          row.original.status !== 'collected' &&
          row.original.status !== 'cancelled' ? (
            <DropdownMenu
              trigger={
                <span className="cursor-pointer rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700">
                  •••
                </span>
              }
            >
              <DropdownItem
                onClick={async () => {
                  try {
                    await markCollected.mutateAsync(row.original.id)
                    toast.success('Marked as collected')
                  } catch {
                    toast.error('Failed')
                  }
                }}
              >
                Mark Collected
              </DropdownItem>
            </DropdownMenu>
          ) : null,
      })
    }

    return base
  }, [isReadOnly, markCollected])

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Hardware laybys — goods paid for but not yet collected.
        </p>
        <WriteOnly>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New Layby
          </Button>
        </WriteOnly>
      </div>

      <FilterBar
        active={Boolean(statusFilter || search)}
        onClear={() => {
          setStatusFilter('')
          setSearch('')
        }}
      >
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Search customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No laybys yet"
        emptyDescription="Click 'New Layby' to record a pending collection."
      />

      {dialogOpen && (
        <CollectionDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          outlets={outlets}
          onSubmit={async (data) => {
            try {
              await createCollection.mutateAsync(
                data as PendingCollectionFormData,
              )
              toast.success('Layby created')
              setDialogOpen(false)
            } catch (err) {
              const msg =
                (err as { response?: { data?: unknown } })?.response?.data
              toast.error(msg ? JSON.stringify(msg) : 'Save failed')
            }
          }}
          loading={createCollection.isPending}
        />
      )}
    </div>
  )
}

function CollectionDialog({
  open,
  onClose,
  outlets,
  onSubmit,
  loading,
}: {
  open: boolean
  onClose: () => void
  outlets: { id: number; name: string }[]
  onSubmit: (d: Form) => void | Promise<void>
  loading: boolean
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      wholesale: outlets[0]?.id ?? 0,
      customer_name: '',
      customer_phone: '',
      description: '',
      total_price: '',
      amount_paid: '',
      collection_deadline: '',
      status: 'pending',
    },
  })

  return (
    <Dialog open={open} onClose={onClose} title="New Layby" className="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Controller
          name="wholesale"
          control={control}
          render={({ field }) => (
            <FormCombobox
              label="Outlet"
              required
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              value={field.value || null}
              onChange={(v) => field.onChange(Number(v) || 0)}
              error={errors.wholesale}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Customer Name"
            required
            error={errors.customer_name}
            {...register('customer_name')}
          />
          <FormField
            label="Phone"
            error={errors.customer_phone}
            {...register('customer_phone')}
          />
        </div>

        <FormField
          label="Description"
          required
          placeholder="e.g. 10 bags of cement"
          error={errors.description}
          {...register('description')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="total_price"
            control={control}
            render={({ field }) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Total Price <span className="text-red-500">*</span>
                </label>
                <CurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  error={Boolean(errors.total_price)}
                />
                {errors.total_price && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.total_price.message}
                  </p>
                )}
              </div>
            )}
          />
          <Controller
            name="amount_paid"
            control={control}
            render={({ field }) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Amount Paid
                </label>
                <CurrencyInput
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              </div>
            )}
          />
        </div>

        <FormField
          label="Collection Deadline"
          type="date"
          error={errors.collection_deadline}
          {...register('collection_deadline')}
        />

        <FormSelect
          label="Status"
          required
          options={STATUS_OPTIONS}
          error={errors.status}
          {...register('status')}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Create Layby'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}