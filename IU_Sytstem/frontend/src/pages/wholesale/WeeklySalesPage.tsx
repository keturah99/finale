import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus, Calendar } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/forms/FormField'
import { FormCombobox } from '@/components/forms/FormCombobox'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Select } from '@/components/ui/select'

import { useWeeklySales, useCreateWeeklySales } from '@/hooks/queries/useWholesale'
import { useScopedOutlets } from '@/hooks/useScopedOutlets'
import { formatK } from '@/lib/format'
import type { WeeklySales } from '@/types/wholesale'

const weeklySchema = z
  .object({
    wholesale: z.number().int().positive(),
    start_date: z.string().min(1, 'Start date required'),
    end_date: z.string().min(1, 'End date required'),
    notes: z.string().optional(),
  })
  .refine((d) => new Date(d.end_date) >= new Date(d.start_date), {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  })

type WeeklyForm = z.infer<typeof weeklySchema>

export function WeeklySalesPage() {
  const navigate = useNavigate()
  const [outletFilter, setOutletFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { outlets } = useScopedOutlets()
  const { data: cycles = [], isLoading } = useWeeklySales({
    ...(outletFilter ? { wholesale: outletFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  })

  const createCycle = useCreateWeeklySales()

  const columns = useMemo<MRT_ColumnDef<WeeklySales>[]>(
    () => [
      {
        accessorKey: 'label',
        header: 'Cycle',
        size: 140,
        Cell: ({ cell }) => (
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {cell.getValue<string>()}
          </span>
        ),
      },
      { accessorKey: 'wholesale_name', header: 'Outlet', size: 180 },
      {
        accessorKey: 'start_date',
        header: 'Period',
        size: 220,
        Cell: ({ row }) =>
          `${row.original.start_date} → ${row.original.end_date}`,
      },
      {
        accessorKey: 'seller_name',
        header: 'Seller',
        size: 150,
        Cell: ({ cell }) => cell.getValue<string | null>() ?? '—',
      },
      {
        accessorKey: 'total_cashed',
        header: 'Cashed',
        size: 120,
        Cell: ({ cell }) => formatK(cell.getValue<string>()),
      },
      {
        accessorKey: 'total_expenses',
        header: 'Expenses',
        size: 120,
        Cell: ({ cell }) => formatK(cell.getValue<string>()),
      },
      {
        accessorKey: 'net_position',
        header: 'Net',
        size: 130,
        Cell: ({ cell }) => {
          const v = Number(cell.getValue<string>() || 0)
          return (
            <span
              className={
                v >= 0
                  ? 'font-semibold text-emerald-600'
                  : 'font-semibold text-red-600'
              }
            >
              {formatK(v)}
            </span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 110,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} />,
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Track weekly sales cycles. Cash, expenses, and damages are recorded
          per cycle; week numbers auto-increment per outlet.
        </p>
        <WriteOnly>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Open New Cycle
          </Button>
        </WriteOnly>
      </div>

      <FilterBar
        active={Boolean(outletFilter || statusFilter)}
        onClear={() => {
          setOutletFilter('')
          setStatusFilter('')
        }}
      >
        <Select
          value={outletFilter}
          onChange={(e) => setOutletFilter(e.target.value)}
          className="w-56"
        >
          <option value="">All outlets</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={cycles}
        isLoading={isLoading}
        onRowClick={(ws) => navigate(`/wholesale/weekly-sales/${ws.id}`)}
        emptyTitle="No weekly sales cycles yet"
        emptyDescription="Click 'Open New Cycle' to start your first week."
      />

      {dialogOpen && (
        <NewCycleDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          outlets={outlets}
          onSubmit={async (data) => {
            try {
              await createCycle.mutateAsync(data as Partial<WeeklySales>)
              toast.success('Cycle opened — week number auto-assigned')
              setDialogOpen(false)
            } catch (err) {
              const msg =
                (err as { response?: { data?: unknown } })?.response?.data
              toast.error(msg ? JSON.stringify(msg) : 'Failed to open cycle')
            }
          }}
          loading={createCycle.isPending}
        />
      )}
    </div>
  )
}

function NewCycleDialog({
  open,
  onClose,
  outlets,
  onSubmit,
  loading,
}: {
  open: boolean
  onClose: () => void
  outlets: { id: number; name: string }[]
  onSubmit: (data: WeeklyForm) => void | Promise<void>
  loading: boolean
}) {
  const today = new Date().toISOString().slice(0, 10)
  const nextWeek = new Date(Date.now() + 6 * 86400000)
    .toISOString()
    .slice(0, 10)

  const {
    handleSubmit,
    control,
    register,
    reset,
    formState: { errors },
  } = useForm<WeeklyForm>({
    resolver: zodResolver(weeklySchema),
    defaultValues: {
      wholesale: outlets[0]?.id ?? 0,
      start_date: today,
      end_date: nextWeek,
      notes: '',
    },
  })

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Open New Weekly Sales Cycle"
      description="A week number will be assigned automatically."
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

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Start date"
            required
            type="date"
            error={errors.start_date}
            {...register('start_date')}
          />
          <FormField
            label="End date"
            required
            type="date"
            error={errors.end_date}
            {...register('end_date')}
          />
        </div>

        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            The label will be generated as{' '}
            <strong>Wk N — YYYY</strong>, where N is the next number for this
            outlet in the current year.
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
          <Button type="submit" disabled={loading}>
            {loading ? 'Opening…' : 'Open Cycle'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}