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
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

import {
  usePurchases, useCreatePurchase, useFarmers, useCrops,
} from '@/hooks/queries/useSupplyChain'
import { formatK, formatDate } from '@/lib/format'
import type { ProducePurchase, ProducePurchaseFormData } from '@/types/supplychain'

const schema = z.object({
  farmer: z.number().int().positive('Select a farmer'),
  crop: z.number().int().positive('Select a crop'),
  quantity_kg: z.string().min(1, 'Quantity required'),
  price_per_kg: z.string().min(1, 'Price required'),
  amount_paid: z.string().optional(),
  purchase_date: z.string().min(1, 'Purchase date required'),
})

type Form = z.infer<typeof schema>

export function PurchasesPage() {
  const [cropFilter, setCropFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: purchases = [], isLoading } = usePurchases({
    ...(cropFilter ? { crop: cropFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  })
  const { data: farmers = [] } = useFarmers()
  const { data: crops = [] } = useCrops()
  const createPurchase = useCreatePurchase()

  const filtered = useMemo(() => {
    if (!search) return purchases
    const q = search.toLowerCase()
    return purchases.filter(
      (p) =>
        p.farmer_name.toLowerCase().includes(q) ||
        p.crop_display.toLowerCase().includes(q),
    )
  }, [purchases, search])

  const totalValue = useMemo(
    () => filtered.reduce((s, p) => s + Number(p.total_amount || 0), 0),
    [filtered],
  )

  const columns = useMemo<MRT_ColumnDef<ProducePurchase>[]>(
    () => [
      { accessorKey: 'purchase_date', header: 'Date', size: 120,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()) },
      { accessorKey: 'farmer_name', header: 'Farmer', size: 180 },
      { accessorKey: 'crop_display', header: 'Crop', size: 120 },
      { accessorKey: 'quantity_kg', header: 'Qty (kg)', size: 110,
        Cell: ({ cell }) => Number(cell.getValue<string>()).toLocaleString() },
      { accessorKey: 'price_per_kg', header: 'Price/kg', size: 110,
        Cell: ({ cell }) => formatK(cell.getValue<string>()) },
      { accessorKey: 'total_amount', header: 'Total', size: 130,
        Cell: ({ cell }) => <span className="font-semibold">{formatK(cell.getValue<string>())}</span> },
      { accessorKey: 'balance', header: 'Balance', size: 120,
        Cell: ({ cell }) => {
          const v = Number(cell.getValue<string>() || 0)
          return v > 0 ? <span className="text-amber-600 font-medium">{formatK(v)}</span> : '—'
        } },
      { accessorKey: 'payment_status', header: 'Status', size: 110,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} /> },
    ],
    [],
  )

  const handleSave = async (data: Form) => {
    try {
      const payload: ProducePurchaseFormData = {
        farmer: data.farmer,
        crop: data.crop,
        quantity_kg: data.quantity_kg,
        price_per_kg: data.price_per_kg,
        amount_paid: data.amount_paid ?? '0',
        purchase_date: data.purchase_date,
      }
      await createPurchase.mutateAsync(payload)
      toast.success('Purchase recorded')
      setDialogOpen(false)
    } catch (err) {
      const msg = (err as { response?: { data?: unknown } })?.response?.data
      toast.error(msg ? JSON.stringify(msg) : 'Save failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Total of filtered:{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-100">{formatK(totalValue)}</span>
        </p>
        <WriteOnly>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Record Purchase
          </Button>
        </WriteOnly>
      </div>

      <FilterBar
        active={Boolean(cropFilter || statusFilter || search)}
        onClear={() => { setCropFilter(''); setStatusFilter(''); setSearch('') }}
      >
        <Select value={cropFilter} onChange={(e) => setCropFilter(e.target.value)} className="w-40">
          <option value="">All crops</option>
          {crops.map((c) => <option key={c.id} value={c.name}>{c.display_name}</option>)}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </Select>
        <Input
          placeholder="Search farmer or crop…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </FilterBar>

      <DataTable columns={columns} data={filtered} isLoading={isLoading}
        emptyTitle="No purchases yet"
        emptyDescription="Click 'Record Purchase' to log a farmer purchase." />

      {dialogOpen && (
        <PurchaseDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleSave}
          farmers={farmers}
          crops={crops}
          loading={createPurchase.isPending}
        />
      )}
    </div>
  )
}

function PurchaseDialog({
  open, onClose, onSubmit, farmers, crops, loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (d: Form) => void | Promise<void>
  farmers: { id: number; full_name: string }[]
  crops: { id: number; name: string; display_name: string }[]
  loading: boolean
}) {
  const today = new Date().toISOString().slice(0, 10)
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      farmer: 0, crop: 0,
      quantity_kg: '', price_per_kg: '', amount_paid: '',
      purchase_date: today,
    },
  })

  const q = Number(watch('quantity_kg')) || 0
  const p = Number(watch('price_per_kg')) || 0
  const total = q * p

  return (
    <Dialog open={open} onClose={onClose} title="Record Purchase" className="max-w-xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Controller name="farmer" control={control} render={({ field }) => (
          <FormCombobox label="Farmer" required
            options={farmers.map((f) => ({ value: f.id, label: f.full_name }))}
            value={field.value || null}
            onChange={(v) => field.onChange(Number(v) || 0)}
            error={errors.farmer} />
        )} />

        <Controller name="crop" control={control} render={({ field }) => (
          <FormCombobox label="Crop" required
            options={crops.map((c) => ({ value: c.id, label: c.display_name }))}
            value={field.value || null}
            onChange={(v) => field.onChange(Number(v) || 0)}
            error={errors.crop} />
        )} />

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Quantity (kg)" required type="text" inputMode="decimal"
            error={errors.quantity_kg}
            {...register('quantity_kg', { setValueAs: (v) => String(v).replace(/[^\d.]/g, '') })} />
          <Controller name="price_per_kg" control={control} render={({ field }) => (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Price per kg <span className="text-red-500">*</span>
              </label>
              <CurrencyInput value={field.value} onChange={field.onChange}
                error={Boolean(errors.price_per_kg)} />
              {errors.price_per_kg && <p className="mt-1 text-xs text-red-600">{errors.price_per_kg.message}</p>}
            </div>
          )} />
        </div>

        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Total amount: </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">{formatK(total)}</span>
        </div>

        <Controller name="amount_paid" control={control} render={({ field }) => (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Amount paid (optional)
            </label>
            <CurrencyInput value={field.value ?? ''} onChange={field.onChange} />
          </div>
        )} />

        <FormField label="Purchase date" required type="date" error={errors.purchase_date}
          {...register('purchase_date')} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save Purchase'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}