import { useMemo, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus, AlertCircle } from 'lucide-react'
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
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

import {
  useStockLevels,
  useStockOuts,
  useCreateStockOut,
} from '@/hooks/queries/useWholesale'
import { useScopedOutlets } from '@/hooks/useScopedOutlets'
import { useProducts } from '@/hooks/queries/useInventory'
import { formatK, formatDateTime } from '@/lib/format'
import type { StockOut } from '@/types/wholesale'

const stockOutSchema = z.object({
  wholesale: z.number().int().positive(),
  product: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be > 0'),
  unit_value: z.string().min(1, 'Cost required'),
  notes: z.string().optional(),
})

type StockOutForm = z.infer<typeof stockOutSchema>

export function StockOutPage() {
  const [wholesaleFilter, setWholesaleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { outlets } = useScopedOutlets()
  const { data: products = [] } = useProducts()

  const { data: stockOuts = [], isLoading } = useStockOuts(
    wholesaleFilter ? { wholesale: Number(wholesaleFilter) } : undefined,
  )

  const createStockOut = useCreateStockOut()

  const filtered = useMemo(
    () =>
      stockOuts.filter((so) => {
        if (!search) return true
        const q = search.toLowerCase()
        return so.product_name.toLowerCase().includes(q)
      }),
    [stockOuts, search],
  )

  const columns = useMemo<MRT_ColumnDef<StockOut>[]>(
    () => [
      {
        accessorKey: 'issued_at',
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
        header: 'Unit Value',
        size: 120,
        Cell: ({ cell }) => formatK(cell.getValue<string>()),
      },
      {
        accessorKey: 'total_value',
        header: 'Total',
        size: 140,
        Cell: ({ cell }) => formatK(cell.getValue<string>()),
      },
    ],
    [outlets],
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Issue stock to sales or direct buyers. Stock level is decremented automatically.
        </p>
        <WriteOnly>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New Stock Out
          </Button>
        </WriteOnly>
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
          placeholder="Search product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No stock-out records yet"
        emptyDescription="Click 'New Stock Out' to issue stock."
      />

      {dialogOpen && (
        <StockOutDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          outlets={outlets}
          products={products}
          onSubmit={async (data) => {
            try {
              await createStockOut.mutateAsync(data as Partial<StockOut>)
              toast.success('Stock issued')
              setDialogOpen(false)
            } catch (err) {
              const msg =
                (err as { response?: { data?: unknown } })?.response?.data
              toast.error(msg ? JSON.stringify(msg) : 'Failed to save')
            }
          }}
          loading={createStockOut.isPending}
        />
      )}
    </div>
  )
}

function StockOutDialog({
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
  onSubmit: (data: StockOutForm) => void | Promise<void>
  loading: boolean
}) {
  const {
    handleSubmit,
    control,
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<StockOutForm>({
    resolver: zodResolver(stockOutSchema),
    defaultValues: {
      wholesale: outlets[0]?.id ?? 0,
      product: 0,
      quantity: 0,
      unit_value: '',
      notes: '',
    },
  })

  const wholesaleId = watch('wholesale')
  const productId = watch('product')
  const quantity = watch('quantity')
  const unitValue = watch('unit_value')

  const { data: levels = [] } = useStockLevels(
    wholesaleId && productId
      ? { wholesale: wholesaleId, product: productId }
      : undefined,
  )

  const available = levels[0]?.quantity ?? 0
  const exceeds = quantity > available

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
      title="Issue Stock Out"
      description="Stock is deducted from the outlet immediately."
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

        {wholesaleId > 0 && productId > 0 && (
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              exceeds
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300'
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            <span>
              Available at this outlet: <strong>{available}</strong> units
              {exceeds && ' — quantity exceeds available'}
            </span>
          </div>
        )}

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
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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

        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Total value: </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {formatK(computedTotal)}
          </span>
        </div>

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
          <Button type="submit" disabled={loading || exceeds}>
            {loading ? 'Saving…' : 'Issue Stock'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}