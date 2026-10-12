import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/forms/FormField'
import { FormCombobox } from '@/components/forms/FormCombobox'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Select } from '@/components/ui/select'

import {
  useOutlets,
  useTransfers,
  useCreateTransfer,
} from '@/hooks/queries/useWholesale'
import { useScopedOutlets } from '@/hooks/useScopedOutlets'
import { useProducts } from '@/hooks/queries/useInventory'
import { formatK, formatDateTime } from '@/lib/format'
import type { Transfer } from '@/types/wholesale'

const transferSchema = z
  .object({
    from_wholesale: z.number().int().positive(),
    to_wholesale: z.number().int().positive(),
    product: z.number().int().positive(),
    quantity: z.number().int().positive('Quantity must be > 0'),
    unit_value: z.string().min(1, 'Cost required'),
    reference: z.string().max(80).optional(),
    notes: z.string().optional(),
  })
  .refine((d) => d.from_wholesale !== d.to_wholesale, {
    message: 'Source and destination must differ',
    path: ['to_wholesale'],
  })

type TransferForm = z.infer<typeof transferSchema>

export function TransfersPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { outlets: scopedOutlets } = useScopedOutlets()
  const { data: allOutlets = [] } = useOutlets()
  const { data: products = [] } = useProducts()

  const { data: transfers = [], isLoading } = useTransfers({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(fromFilter ? { from: fromFilter } : {}),
  })

  const createTransfer = useCreateTransfer()

  const columns = useMemo<MRT_ColumnDef<Transfer>[]>(
    () => [
      { accessorKey: 'id', header: '#', size: 70 },
      {
        accessorKey: 'initiated_at',
        header: 'Date',
        size: 160,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string>()),
      },
      { accessorKey: 'from_name', header: 'From', size: 150 },
      { accessorKey: 'to_name', header: 'To', size: 150 },
      { accessorKey: 'product_name', header: 'Product' },
      {
        accessorKey: 'quantity',
        header: 'Qty',
        size: 80,
        Cell: ({ cell }) => cell.getValue<number>().toLocaleString(),
      },
      {
        accessorKey: 'total_value',
        header: 'Value',
        size: 130,
        Cell: ({ cell }) => formatK(cell.getValue<string>()),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 130,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} />,
      },
      {
        accessorKey: 'reference',
        header: 'Ref',
        size: 120,
        Cell: ({ cell }) => cell.getValue<string>() || '—',
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500">
          Move stock between outlets. Source is decremented on approval;
          destination receives on receipt.
        </p>
        <WriteOnly>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New Transfer
          </Button>
        </WriteOnly>
      </div>

      <FilterBar
        active={Boolean(statusFilter || fromFilter)}
        onClear={() => {
          setStatusFilter('')
          setFromFilter('')
        }}
      >
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_transit">In Transit</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </Select>

        <Select
          value={fromFilter}
          onChange={(e) => setFromFilter(e.target.value)}
          className="w-56"
        >
          <option value="">Any source</option>
          {scopedOutlets.map((o) => (
            <option key={o.id} value={o.id}>
              From: {o.name}
            </option>
          ))}
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={transfers}
        isLoading={isLoading}
        onRowClick={(t) => navigate(`/wholesale/transfers/${t.id}`)}
        emptyTitle="No transfers yet"
        emptyDescription="Create your first inter-wholesale transfer."
      />

      {dialogOpen && (
        <TransferDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          fromOutlets={scopedOutlets}
          toOutlets={allOutlets}
          products={products}
          onSubmit={async (data) => {
            try {
              await createTransfer.mutateAsync(data as Partial<Transfer>)
              toast.success('Transfer created')
              setDialogOpen(false)
            } catch (err) {
              const msg =
                (err as { response?: { data?: unknown } })?.response?.data
              toast.error(msg ? JSON.stringify(msg) : 'Failed to save')
            }
          }}
          loading={createTransfer.isPending}
        />
      )}
    </div>
  )
}

function TransferDialog({
  open,
  onClose,
  fromOutlets,
  toOutlets,
  products,
  onSubmit,
  loading,
}: {
  open: boolean
  onClose: () => void
  fromOutlets: { id: number; name: string }[]
  toOutlets: { id: number; name: string }[]
  products: { id: number; sku: string; name: string }[]
  onSubmit: (d: TransferForm) => void | Promise<void>
  loading: boolean
}) {
  const {
    handleSubmit,
    control,
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransferForm>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      from_wholesale: fromOutlets[0]?.id ?? 0,
      to_wholesale: toOutlets[1]?.id ?? 0,
      product: 0,
      quantity: 0,
      unit_value: '',
      reference: '',
      notes: '',
    },
  })

  const quantity = watch('quantity')
  const unitValue = watch('unit_value')

  const computedTotal = useMemo(() => {
    const q = Number(quantity) || 0
    const u = Number(unitValue) || 0
    return q * u
  }, [quantity, unitValue])

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="New Inter-Wholesale Transfer"
      description="Request stock movement from one outlet to another."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="from_wholesale"
            control={control}
            render={({ field }) => (
              <FormCombobox
                label="From"
                required
                options={fromOutlets.map((o) => ({ value: o.id, label: o.name }))}
                value={field.value || null}
                onChange={(v) => field.onChange(Number(v) || 0)}
                error={errors.from_wholesale}
              />
            )}
          />
          <Controller
            name="to_wholesale"
            control={control}
            render={({ field }) => (
              <FormCombobox
                label="To"
                required
                options={toOutlets.map((o) => ({ value: o.id, label: o.name }))}
                value={field.value || null}
                onChange={(v) => field.onChange(Number(v) || 0)}
                error={errors.to_wholesale}
              />
            )}
          />
        </div>

        <Controller
          name="product"
          control={control}
          render={({ field }) => (
            <FormCombobox
              label="Product"
              required
              options={products.map((p) => ({
                value: p.id,
                label: `${p.sku} — ${p.name}`,
              }))}
              value={field.value || null}
              onChange={(v) => field.onChange(Number(v) || 0)}
              error={errors.product}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Quantity"
            required
            type="number"
            min={1}
            error={errors.quantity}
            {...register('quantity', { valueAsNumber: true })}
          />
          <Controller
            name="unit_value"
            control={control}
            render={({ field }) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Unit Value <span className="text-red-500">*</span>
                </label>
                <CurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  error={Boolean(errors.unit_value)}
                />
                {errors.unit_value && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.unit_value.message}
                  </p>
                )}
              </div>
            )}
          />
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-500">Total value: </span>
          <span className="font-semibold text-slate-800">
            {formatK(computedTotal)}
          </span>
        </div>

        <FormField
          label="Reference"
          placeholder="Internal doc number…"
          error={errors.reference}
          {...register('reference')}
        />

        <FormField
          label="Notes"
          placeholder="Optional notes…"
          error={errors.notes}
          {...register('notes')}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Create Transfer'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}