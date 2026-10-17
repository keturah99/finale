import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus } from 'lucide-react'
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
import { Select } from '@/components/ui/select'

import {
  usePayrollRuns, useCreatePayrollRun, useProcessPayrollRun,
} from '@/hooks/queries/usePayroll'
import { formatDateTime } from '@/lib/format'
import type { PayrollRun, PayrollRunFormData } from '@/types/payroll'

const schema = z.object({
  period_label: z.string().min(1, 'Period label required').max(30),
  period_start: z.string().min(1, 'Start date required'),
  period_end: z.string().min(1, 'End date required'),
  notes: z.string().optional(),
})

type Form = z.infer<typeof schema>

export function PayrollRunsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmProcess, setConfirmProcess] = useState<PayrollRun | null>(null)

  const { data: runs = [], isLoading } = usePayrollRuns(
    statusFilter ? { status: statusFilter } : undefined,
  )
  const createRun = useCreatePayrollRun()
  const processRun = useProcessPayrollRun()

  const columns = useMemo<MRT_ColumnDef<PayrollRun>[]>(
    () => [
      { accessorKey: 'period_label', header: 'Period', size: 160,
        Cell: ({ cell }) => (
          <span className="font-semibold text-slate-800 dark:text-slate-100">{cell.getValue<string>()}</span>
        ) },
      { id: 'dates', header: 'Range', size: 200,
        Cell: ({ row }) => `${row.original.period_start} → ${row.original.period_end}` },
      { accessorKey: 'status', header: 'Status', size: 120,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} /> },
      { accessorKey: 'processed_at', header: 'Processed', size: 180,
        Cell: ({ cell }) => {
          const v = cell.getValue<string | null>()
          return v ? formatDateTime(v) : '—'
        } },
      { id: 'actions', header: '', size: 140,
        enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) =>
          row.original.status !== 'completed' ? (
            <WriteOnly>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmProcess(row.original)
                }}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Process
              </button>
            </WriteOnly>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">Completed</span>
          ) },
    ],
    [],
  )

  const handleCreate = async (data: Form) => {
    try {
      await createRun.mutateAsync(data as PayrollRunFormData)
      toast.success('Payroll run created')
      setDialogOpen(false)
    } catch (err) {
      const msg = (err as { response?: { data?: unknown } })?.response?.data
      toast.error(msg ? JSON.stringify(msg) : 'Failed')
    }
  }

  const handleProcess = async () => {
    if (!confirmProcess) return
    try {
      const result = await processRun.mutateAsync(confirmProcess.id)
      const count = (result as { records_created?: number })?.records_created ?? 0
      toast.success(`Processed ${count} employee record(s)`)
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Processing failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Create a run per pay period, then process it to generate records.
        </p>
        <WriteOnly>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New Run
          </Button>
        </WriteOnly>
      </div>

      <FilterBar active={Boolean(statusFilter)} onClear={() => setStatusFilter('')}>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </FilterBar>

      <DataTable columns={columns} data={runs} isLoading={isLoading}
        onRowClick={(r) => navigate(`/payroll/runs/${r.id}`)}
        emptyTitle="No payroll runs yet"
        emptyDescription="Click 'New Run' to create the first one." />

      {dialogOpen && (
        <NewRunDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleCreate}
          loading={createRun.isPending}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmProcess)}
        onClose={() => setConfirmProcess(null)}
        onConfirm={handleProcess}
        title="Process this payroll run?"
        description={
          confirmProcess
            ? `This will compute payroll records for every active employee with a salary structure. Period: ${confirmProcess.period_label}`
            : ''
        }
        confirmLabel="Process Payroll"
      />
    </div>
  )
}

function NewRunDialog({
  open, onClose, onSubmit, loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (d: Form) => void | Promise<void>
  loading: boolean
}) {
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().slice(0, 10)
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().slice(0, 10)
  const monthLabel = today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      period_label: monthLabel,
      period_start: startOfMonth,
      period_end: endOfMonth,
      notes: '',
    },
  })

  return (
    <Dialog open={open} onClose={onClose} title="New Payroll Run" className="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Period Label" required placeholder="September 2026"
          error={errors.period_label} {...register('period_label')} />

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start Date" required type="date"
            error={errors.period_start} {...register('period_start')} />
          <FormField label="End Date" required type="date"
            error={errors.period_end} {...register('period_end')} />
        </div>

        <FormField label="Notes" placeholder="Optional notes…"
          error={errors.notes} {...register('notes')} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create Run'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}