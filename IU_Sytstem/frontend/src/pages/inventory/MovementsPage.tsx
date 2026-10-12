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
import { FormCombobox } from '@/components/forms/FormCombobox'
import { FormSelect } from '@/components/forms/FormSelect'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

import {
  useMovements, useCreateMovement, useProducts,
} from '@/hooks/queries/useInventory'
import { formatDateTime } from '@/lib/format'
import type { StockMovement, StockMovementFormData } from '@/types/inventory'

const schema = z.object({
  product: z.number().int().positive('Select a product'),
  movement_type: z.enum(['in', 'out', 'adjust']),
  quantity: z.number().int().min(1, 'Quantity must be > 0'),
  reference: z.string().max(80).optional(),
  notes: z.string().optional(),
})

type Form = z.infer<typeof schema>

const TYPE_OPTIONS = [
  { value: 'in', label: 'Stock In' },
  { value: 'out', label: 'Stock Out' },
  { value: 'adjust', label: 'Adjustment (set exact)' },
]

export function MovementsPage() {
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: movements = [], isLoading } = useMovements()
  const { data: products = [] } = useProducts()
  const createMovement = useCreateMovement()

  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products],
  )

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter && m.movement_type !== typeFilter) return false
      if (search) {
        const p = productMap[m.product]
        const q = search.toLowerCase()
        if (!p || (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [movements, typeFilter, search, productMap])

  const columns = useMemo<MRT_ColumnDef<StockMovement>[]>(
    () => [
      { accessorKey: 'created_at', header: 'Date', size: 160,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string>()) },
      { id: 'product', header: 'Product',
        Cell: ({ row }) => {
          const p = productMap[row.original.product]
          return p ? `${p.sku} — ${p.name}` : '—'
        } },
      { accessorKey: 'movement_type', header: 'Type', size: 120,
        Cell: ({ cell }) => {
          const t = cell.getValue<string>()
          return <StatusBadge status={t} label={t === 'in' ? 'IN' : t === 'out' ? 'OUT' : 'ADJ'} />
        } },
      { accessorKey: 'quantity', header: 'Qty', size: 90,
        Cell: ({ cell }) => cell.getValue<number>().toLocaleString() },
      { accessorKey: 'reference', header: 'Reference', size: 160,
        Cell: ({ cell }) => cell.getValue<string>() || '—' },
    ],
    [productMap],
  )

  const handleSave = async (data: Form) => {
    try {
      await createMovement.mutateAsync(data as StockMovementFormData)
      toast.success('Movement recorded')
      setDialogOpen(false)
    } catch (err) {
      const msg = (err as { response?: { data?: unknown } })?.response?.data
      toast.error(msg ? JSON.stringify(msg) : 'Save failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500">
          Every stock-in, stock-out, and adjustment across all departments.
        </p>
        <WriteOnly>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Record Movement
          </Button>
        </WriteOnly>
      </div>

      <FilterBar
        active={Boolean(typeFilter || search)}
        onClear={() => { setTypeFilter(''); setSearch('') }}
      >
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-44">
          <option value="">All types</option>
          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Input placeholder="Search product…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="w-64" />
      </FilterBar>

      <DataTable columns={columns} data={filtered} isLoading={isLoading}
        emptyTitle="No movements yet"
        emptyDescription="Click 'Record Movement' to log the first one." />

      {dialogOpen && (
        <MovementDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleSave}
          products={products}
          loading={createMovement.isPending}
        />
      )}
    </div>
  )
}

function MovementDialog({
  open, onClose, onSubmit, products, loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (d: Form) => void | Promise<void>
  products: { id: number; sku: string; name: string }[]
  loading: boolean
}) {
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      product: 0,
      movement_type: 'in',
      quantity: 1,
      reference: '',
      notes: '',
    },
  })

  const type = watch('movement_type')

  return (
    <Dialog open={open} onClose={onClose} title="Record Movement" className="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Controller name="product" control={control} render={({ field }) => (
          <FormCombobox label="Product" required
            options={products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }))}
            value={field.value || null}
            onChange={(v) => field.onChange(Number(v) || 0)}
            error={errors.product} />
        )} />

        <div className="grid grid-cols-2 gap-3">
          <FormSelect label="Movement Type" required options={TYPE_OPTIONS}
            error={errors.movement_type} {...register('movement_type')} />
          <FormField label={type === 'adjust' ? 'New Quantity' : 'Quantity'}
            required type="number" min={1}
            error={errors.quantity}
            {...register('quantity', { valueAsNumber: true })} />
        </div>

        <FormField label="Reference" placeholder="PO number, sale ref…"
          error={errors.reference} {...register('reference')} />
        <FormField label="Notes" placeholder="Optional" {...register('notes')} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Record'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
