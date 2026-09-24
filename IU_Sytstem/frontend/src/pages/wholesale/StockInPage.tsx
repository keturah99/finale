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
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

import { useOutlets, useStockIns, useCreateStockIn } from '@/hooks/queries/useWholesale'
import { useProducts } from '@/hooks/queries/useInventory'
import { formatK, formatDateTime } from '@/lib/format'
import type { StockIn, StockInSource } from '@/types/wholesale'

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const stockInSchema = z.object({
  wholesale: z.number().int().positive(),
  product: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be > 0'),
  unit_value: z.string().min(1, 'Cost required'),
  stock_from: z.enum(['main_warehouse', 'supplier', 'transfer_in', 'return']),
  reference: z.string().max(80).optional(),
  notes: z.string().optional(),
})

type StockInForm = z.infer<typeof stockInSchema>

const SOURCE_OPTIONS = [
  { value: 'main_warehouse', label: 'Main Warehouse' },
  { value: 'supplier', label: 'Direct from Supplier' },
  { value: 'transfer_in', label: 'Inter-Wholesale Transfer' },
  { value: 'return', label: 'Customer Return' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StockInPage() {
  const [wholesaleFilter, setWholesaleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: outlets = [] } = useOutlets()
  const { data: products = [] } = useProducts()

  const { data: stockIns = [], isLoading } = useStockIns(
    wholesaleFilter ? { wholesale: Number(wholesaleFilter) } : undefined,
  )

  const createStockIn = useCreateStockIn()

  const filtered = useMemo(
    () =>
      stockIns.filter((si) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          si.product_name.toLowerCase().includes(q) ||
          si.reference.toLowerCase().includes(q)
        )
      }),
    [stockIns, search],
  )

  const columns = useMemo<MRT_ColumnDef<StockIn>[]>(
    () => [
      {
        accessorKey: 'received_at',
        header: 'Date',
        size: 160,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string>()),
      },
      {
        accessorKey: 'wholesale',
        header: 'Outlet',
        size: 160,
        Cell: ({ row }) =>
          outlets.find((o) => o.id === row.original.wholesale)?.name ?? '—',
      },
      { accessorKey: 'product_name', header: 'Product' },
      {
        accessorKey: 'quantity',
        header: 'Qty',
        size: 80,
        Cell: ({ cell }) => cell.getValue<number>().toLocaleString(),
      },
      {
        accessorKey: 'unit_value',
        header: 'Unit Cost',
        size: 120,
        Cell: ({ cell }) => formatK(cell.getValue<string>()),
      },
      {
        accessorKey: 'total_value',
        header: 'Total',
        size: 140,
        Cell: ({ cell }) => formatK(cell.getValue<string>()),
      },
      {
        accessorKey: 'stock_from',
        header: 'Source',
        size: 160,
        Cell: ({ cell }) =>
          SOURCE_OPTIONS.find((s) => s.value === cell.getValue<string>())?.label ??
          cell.getValue<string>(),
      },
      { accessorKey: 'reference', header: 'Reference', size: 140 },
    ],
    [outlets],
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500">
          Record stock arriving at a wholesale outlet.
        </p>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Stock In
        </Button>
      </div>

      <FilterBar
        active={Boolean(wholesaleFilter || search)}
        onClear={() => {
          setWholesaleFilter('')
          setSearch('')
        }}
      >
        <Select
          value={wholesaleFilter}
          onChange={(e) => setWholesaleFilter(e.target.value)}
          className="w-56"
        >
          <option value="">All outlets</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Search product or reference…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No stock-in records yet"
        emptyDescription="Click 'New Stock In' to record your first delivery."
      />

      <StockInDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        outlets={outlets}
        products={products}
        onSubmit={async (data) => {
          try {
            await createStockIn.mutateAsync({
              ...data,
              unit_value: data.unit_value,
            } as Partial<StockIn>)
            toast.success('Stock recorded')
            setDialogOpen(false)
          } catch (err) {
            const msg =
              (err as { response?: { data?: unknown } })?.response?.data
            toast.error(msg ? JSON.stringify(msg) : 'Failed to save')
          }
        }}
        loading={createStockIn.isPending}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

function StockInDialog({
  open,
  onClose,
  outlets,
  products,
  onSubmit,
  loading,
}: {
  open: boolean
  onClose: () => void
  outlets: { id: number; name: string }[]
  products: { id: number; sku: string; name: string }[]
  onSubmit: (data: StockInForm) => void | Promise<void>
  loading: boolean
}) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<StockInForm>({
    resolver: zodResolver(stockInSchema),
    defaultValues: {
      wholesale: outlets[0]?.id ?? 0,
      product: 0,
      quantity: 0,
      unit_value: '',
      stock_from: 'main_warehouse' as StockInSource,
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
      title="Record Stock In"
      description="Log stock arriving at a wholesale outlet."
    >
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
                  Unit Cost <span className="text-red-500">*</span>
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

        <FormSelect
          label="Source"
          required
          options={SOURCE_OPTIONS}
          error={errors.stock_from}
          {...register('stock_from')}
        />

        <FormField
          label="Reference"
          placeholder="PO number, delivery note…"
          error={errors.reference}
          {...register('reference')}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Record Stock In'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}