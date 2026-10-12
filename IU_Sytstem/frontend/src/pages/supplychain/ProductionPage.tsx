import { useMemo, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus, CheckCircle2 } from 'lucide-react'
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
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Select } from '@/components/ui/select'

import {
  useBatches, useCreateBatch, useCompleteBatch,
} from '@/hooks/queries/useSupplyChain'
import { formatDate } from '@/lib/format'
import type { ProductionBatch, ProductionBatchFormData } from '@/types/supplychain'

const schema = z.object({
  batch_number: z.string().min(1, 'Batch number required').max(40),
  raw_material_name: z.string().min(1, 'Raw material required'),
  raw_material_qty_kg: z.string().min(1, 'Quantity required'),
  start_date: z.string().min(1, 'Start date required'),
  notes: z.string().optional(),
})

const completeSchema = z.object({
  finished_product_name: z.string().min(1, 'Product name required'),
  finished_product_qty_kg: z.string().min(1, 'Quantity required'),
  completion_date: z.string().min(1, 'Completion date required'),
})

type Form = z.infer<typeof schema>
type CompleteForm = z.infer<typeof completeSchema>

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function ProductionPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [completing, setCompleting] = useState<ProductionBatch | null>(null)

  const { data: batches = [], isLoading } = useBatches(
    statusFilter ? { status: statusFilter } : undefined,
  )
  const createBatch = useCreateBatch()
  const completeBatch = useCompleteBatch()

  const columns = useMemo<MRT_ColumnDef<ProductionBatch>[]>(
    () => [
      { accessorKey: 'batch_number', header: 'Batch #', size: 130,
        Cell: ({ cell }) => (
          <span className="font-mono text-sm font-semibold">
            {cell.getValue<string>()}
          </span>
        ) },
      { accessorKey: 'raw_material_name', header: 'Raw Material', size: 160 },
      { accessorKey: 'raw_material_qty_kg', header: 'In (kg)', size: 100,
        Cell: ({ cell }) => Number(cell.getValue<string>()).toLocaleString() },
      { accessorKey: 'finished_product_name', header: 'Product', size: 160,
        Cell: ({ cell }) => cell.getValue<string>() || '—' },
      { accessorKey: 'finished_product_qty_kg', header: 'Out (kg)', size: 100,
        Cell: ({ cell }) => {
          const v = cell.getValue<string | null>()
          return v ? Number(v).toLocaleString() : '—'
        } },
      { accessorKey: 'yield_percentage', header: 'Yield %', size: 100,
        Cell: ({ cell }) => {
          const v = cell.getValue<string | null>()
          return v ? `${v}%` : '—'
        } },
      { accessorKey: 'start_date', header: 'Start', size: 110,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()) },
      { accessorKey: 'status', header: 'Status', size: 120,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} /> },
      { id: 'actions', header: '', size: 100,
        enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) =>
          row.original.status !== 'completed' ? (
            <WriteOnly>
              <button
                onClick={() => setCompleting(row.original)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Complete
              </button>
            </WriteOnly>
          ) : null },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500">
          Track raw material intake and finished product output.
        </p>
        <WriteOnly>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New Batch
          </Button>
        </WriteOnly>
      </div>

      <FilterBar active={Boolean(statusFilter)} onClear={() => setStatusFilter('')}>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </FilterBar>

      <DataTable columns={columns} data={batches} isLoading={isLoading}
        emptyTitle="No production batches yet"
        emptyDescription="Click 'New Batch' to start tracking production." />

      {dialogOpen && (
        <NewBatchDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={async (data) => {
            try {
              await createBatch.mutateAsync(data as ProductionBatchFormData)
              toast.success('Batch created')
              setDialogOpen(false)
            } catch (err) {
              const msg = (err as { response?: { data?: unknown } })?.response?.data
              toast.error(msg ? JSON.stringify(msg) : 'Save failed')
            }
          }}
          loading={createBatch.isPending}
        />
      )}

      {completing && (
        <CompleteBatchDialog
          open={Boolean(completing)}
          batch={completing}
          onClose={() => setCompleting(null)}
          onSubmit={async (data) => {
            try {
              await completeBatch.mutateAsync({ id: completing.id, ...data })
              toast.success('Batch completed')
              setCompleting(null)
            } catch (err) {
              const msg = (err as { response?: { data?: unknown } })?.response?.data
              toast.error(msg ? JSON.stringify(msg) : 'Save failed')
            }
          }}
          loading={completeBatch.isPending}
        />
      )}
    </div>
  )
}

function NewBatchDialog({
  open, onClose, onSubmit, loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (d: Form) => void | Promise<void>
  loading: boolean
}) {
  const today = new Date().toISOString().slice(0, 10)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      batch_number: `BATCH-${Date.now().toString().slice(-6)}`,
      raw_material_name: '',
      raw_material_qty_kg: '',
      start_date: today,
      notes: '',
    },
  })

  return (
    <Dialog open={open} onClose={onClose} title="New Production Batch" className="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Batch Number" required error={errors.batch_number} {...register('batch_number')} />
        <FormField label="Raw Material" required placeholder="e.g. Maize grain" error={errors.raw_material_name} {...register('raw_material_name')} />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Quantity (kg)" required type="text" inputMode="decimal"
            error={errors.raw_material_qty_kg}
            {...register('raw_material_qty_kg', { setValueAs: (v) => String(v).replace(/[^\d.]/g, '') })} />
          <FormField label="Start Date" required type="date" error={errors.start_date} {...register('start_date')} />
        </div>
        <FormField label="Notes" placeholder="Optional notes…" error={errors.notes} {...register('notes')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Create Batch'}</Button>
        </div>
      </form>
    </Dialog>
  )
}

function CompleteBatchDialog({
  open, batch, onClose, onSubmit, loading,
}: {
  open: boolean
  batch: ProductionBatch
  onClose: () => void
  onSubmit: (d: CompleteForm) => void | Promise<void>
  loading: boolean
}) {
  const today = new Date().toISOString().slice(0, 10)
  const { register, handleSubmit, formState: { errors } } = useForm<CompleteForm>({
    resolver: zodResolver(completeSchema),
    defaultValues: {
      finished_product_name: batch.finished_product_name || '',
      finished_product_qty_kg: batch.finished_product_qty_kg ?? '',
      completion_date: today,
    },
  })

  return (
    <Dialog open={open} onClose={onClose} title={`Complete ${batch.batch_number}`}
      description={`Raw material: ${batch.raw_material_qty_kg} kg`} className="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Finished Product" required error={errors.finished_product_name}
          {...register('finished_product_name')} />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Output (kg)" required type="text" inputMode="decimal"
            error={errors.finished_product_qty_kg}
            {...register('finished_product_qty_kg', { setValueAs: (v) => String(v).replace(/[^\d.]/g, '') })} />
          <FormField label="Completion Date" required type="date" error={errors.completion_date}
            {...register('completion_date')} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="success" disabled={loading}>
            <CheckCircle2 className="h-4 w-4" />
            {loading ? 'Saving…' : 'Mark Completed'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}