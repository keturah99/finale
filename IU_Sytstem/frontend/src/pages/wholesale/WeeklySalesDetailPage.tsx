import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Lock,
  RefreshCw,
  Wallet,
  TrendingDown,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import type { MRT_ColumnDef } from 'material-react-table'
import { toast } from 'sonner'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/shared/DataTable'
import { FormField } from '@/components/forms/FormField'
import { FormCombobox } from '@/components/forms/FormCombobox'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { CardSkeleton } from '@/components/shared/LoadingSkeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

import {
  useWeeklySale,
  useWeeklySummary,
  useCashIns,
  useCreateCashIn,
  useExpenses,
  useCreateExpense,
  useWeeklyDamages,
  useCreateWeeklyDamage,
  useCloseAndOpenNext,
} from '@/hooks/queries/useWholesale'
import { useProducts } from '@/hooks/queries/useInventory'
import { formatK, formatDateTime } from '@/lib/format'
import type {
  WeeklySalesCashIn,
  WeeklySalesExpense,
  WeeklySalesDamage,
} from '@/types/wholesale'
import { cn } from '@/lib/utils'

type Tab = 'cash-ins' | 'expenses' | 'damages'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function WeeklySalesDetailPage() {
  const { id } = useParams<{ id: string }>()
  const cycleId = Number(id)
  const navigate = useNavigate()

  const { data: cycle, isLoading } = useWeeklySale(cycleId)
  const { data: summary } = useWeeklySummary(cycleId)
  const closeAndNext = useCloseAndOpenNext()

  const [tab, setTab] = useState<Tab>('cash-ins')
  const [confirmClose, setConfirmClose] = useState(false)

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Weekly Sales" />
        <CardSkeleton />
      </div>
    )
  }

  if (!cycle) {
    return (
      <div>
        <PageHeader title="Cycle not found" />
        <Button variant="outline" onClick={() => navigate('/wholesale/weekly-sales')}>
          <ArrowLeft className="h-4 w-4" />
          Back to cycles
        </Button>
      </div>
    )
  }

  const isOpen = cycle.status === 'open'

  const handleCloseAndNext = async () => {
    try {
      const result = await closeAndNext.mutateAsync({ id: cycleId, days: 7 })
      toast.success(`Closed ${result.closed.label}, opened ${result.opened.label}`)
      navigate(`/wholesale/weekly-sales/${result.opened.id}`)
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error
      toast.error(msg ?? 'Failed to close cycle')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/wholesale/weekly-sales')}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to cycles
        </button>

        <PageHeader
          title={cycle.label}
          description={`${cycle.wholesale_name} · ${cycle.start_date} → ${cycle.end_date}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge status={cycle.status} />
              {isOpen && (
                <Button
                  onClick={() => setConfirmClose(true)}
                  disabled={closeAndNext.isPending}
                >
                  <Lock className="h-4 w-4" />
                  Close & Open Next
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={Wallet}
          label="Total Cashed"
          value={formatK(summary?.total_cashed ?? '0')}
          tone="positive"
        />
        <SummaryCard
          icon={TrendingDown}
          label="Expenses"
          value={formatK(summary?.total_expenses ?? '0')}
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Damages"
          value={formatK(summary?.total_damages_value ?? '0')}
          tone="warning"
        />
        <SummaryCard
          icon={Wallet}
          label="Net Position"
          value={formatK(summary?.net_position ?? '0')}
          tone={
            Number(summary?.net_position ?? 0) >= 0 ? 'positive' : 'negative'
          }
          emphasized
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        {(['cash-ins', 'expenses', 'damages'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition',
              tab === t
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-slate-600 hover:text-slate-900',
            )}
          >
            {t === 'cash-ins' && 'Cash-Ins'}
            {t === 'expenses' && 'Expenses'}
            {t === 'damages' && 'Damages'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'cash-ins' && (
        <CashInsTab cycleId={cycleId} isOpen={isOpen} />
      )}
      {tab === 'expenses' && (
        <ExpensesTab cycleId={cycleId} isOpen={isOpen} />
      )}
      {tab === 'damages' && (
        <DamagesTab cycleId={cycleId} isOpen={isOpen} />
      )}

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={handleCloseAndNext}
        title="Close this cycle and open the next?"
        description={`"${cycle.label}" will be locked. A new cycle will open at the same outlet with the next week number.`}
        confirmLabel="Close & Open Next"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
  emphasized = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative' | 'warning'
  emphasized?: boolean
}) {
  const toneClass = {
    default: 'text-slate-800',
    positive: 'text-emerald-700',
    negative: 'text-red-700',
    warning: 'text-amber-700',
  }[tone]

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </p>
      </div>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold',
          toneClass,
          emphasized && 'text-3xl',
        )}
      >
        {value}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cash-Ins tab
// ---------------------------------------------------------------------------

function CashInsTab({ cycleId, isOpen }: { cycleId: number; isOpen: boolean }) {
  const { data: rows = [], isLoading } = useCashIns({ weekly_sales: cycleId })
  const createCashIn = useCreateCashIn()
  const [open, setOpen] = useState(false)

  const cashInSchema = z.object({
    amount: z.string().min(1, 'Amount required'),
    reference: z.string().max(80).optional(),
    notes: z.string().optional(),
  })
  type CashInForm = z.infer<typeof cashInSchema>

  const form = useForm<CashInForm>({
    resolver: zodResolver(cashInSchema),
    defaultValues: { amount: '', reference: '', notes: '' },
  })

  const columns: MRT_ColumnDef<WeeklySalesCashIn>[] = [
    {
      accessorKey: 'received_at',
      header: 'Date',
      size: 160,
      Cell: ({ cell }) => formatDateTime(cell.getValue<string>()),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      size: 130,
      Cell: ({ cell }) => (
        <span className="font-semibold text-emerald-700">
          {formatK(cell.getValue<string>())}
        </span>
      ),
    },
    { accessorKey: 'reference', header: 'Reference', size: 160 },
    {
      accessorKey: 'received_by_name',
      header: 'Received By',
      size: 160,
      Cell: ({ cell }) => cell.getValue<string | null>() ?? '—',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} disabled={!isOpen}>
          <Plus className="h-4 w-4" />
          Add Cash-In
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyTitle="No cash-ins yet"
        emptyDescription={
          isOpen
            ? 'Click "Add Cash-In" to record money received.'
            : 'This cycle is closed.'
        }
      />

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          form.reset()
        }}
        title="Add Cash-In"
        description="Record money received during this cycle."
      >
        <form
          onSubmit={form.handleSubmit(async (data) => {
            try {
              await createCashIn.mutateAsync({
                weekly_sales: cycleId,
                amount: data.amount,
                reference: data.reference ?? '',
                notes: data.notes ?? '',
              } as Partial<WeeklySalesCashIn>)
              toast.success('Cash-in recorded')
              setOpen(false)
              form.reset()
            } catch (err) {
              const msg = (err as { response?: { data?: unknown } })?.response
                ?.data
              toast.error(msg ? JSON.stringify(msg) : 'Failed')
            }
          })}
          className="space-y-4"
        >
          <Controller
            name="amount"
            control={form.control}
            render={({ field }) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Amount <span className="text-red-500">*</span>
                </label>
                <CurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  error={Boolean(form.formState.errors.amount)}
                />
                {form.formState.errors.amount && (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.amount.message}
                  </p>
                )}
              </div>
            )}
          />
          <FormField
            label="Reference"
            placeholder="Bank slip number…"
            {...form.register('reference')}
          />
          <FormField
            label="Notes"
            placeholder="Optional"
            {...form.register('notes')}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                form.reset()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createCashIn.isPending}>
              {createCashIn.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Expenses tab
// ---------------------------------------------------------------------------

function ExpensesTab({ cycleId, isOpen }: { cycleId: number; isOpen: boolean }) {
  const { data: rows = [], isLoading } = useExpenses({ weekly_sales: cycleId })
  const createExpense = useCreateExpense()
  const [open, setOpen] = useState(false)

  const schema = z.object({
    amount: z.string().min(1, 'Amount required'),
    description: z.string().min(1, 'Description required'),
  })
  type Form = z.infer<typeof schema>

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', description: '' },
  })

  const columns: MRT_ColumnDef<WeeklySalesExpense>[] = [
    {
      accessorKey: 'recorded_at',
      header: 'Date',
      size: 160,
      Cell: ({ cell }) => formatDateTime(cell.getValue<string>()),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      size: 130,
      Cell: ({ cell }) => (
        <span className="font-semibold text-red-700">
          {formatK(cell.getValue<string>())}
        </span>
      ),
    },
    { accessorKey: 'description', header: 'Description' },
    {
      accessorKey: 'recorded_by_name',
      header: 'Recorded By',
      size: 160,
      Cell: ({ cell }) => cell.getValue<string | null>() ?? '—',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} disabled={!isOpen}>
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyTitle="No expenses yet"
        emptyDescription={
          isOpen ? 'Click "Add Expense" to record costs.' : 'This cycle is closed.'
        }
      />

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          form.reset()
        }}
        title="Add Expense"
      >
        <form
          onSubmit={form.handleSubmit(async (data) => {
            try {
              await createExpense.mutateAsync({
                weekly_sales: cycleId,
                amount: data.amount,
                description: data.description,
              } as Partial<WeeklySalesExpense>)
              toast.success('Expense recorded')
              setOpen(false)
              form.reset()
            } catch (err) {
              const msg = (err as { response?: { data?: unknown } })?.response
                ?.data
              toast.error(msg ? JSON.stringify(msg) : 'Failed')
            }
          })}
          className="space-y-4"
        >
          <Controller
            name="amount"
            control={form.control}
            render={({ field }) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Amount <span className="text-red-500">*</span>
                </label>
                <CurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  error={Boolean(form.formState.errors.amount)}
                />
                {form.formState.errors.amount && (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.amount.message}
                  </p>
                )}
              </div>
            )}
          />
          <FormField
            label="Description"
            required
            placeholder="Transport, labour, etc."
            error={form.formState.errors.description}
            {...form.register('description')}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                form.reset()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createExpense.isPending}>
              {createExpense.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Damages tab
// ---------------------------------------------------------------------------

function DamagesTab({ cycleId, isOpen }: { cycleId: number; isOpen: boolean }) {
  const { data: rows = [], isLoading } = useWeeklyDamages({
    weekly_sales: cycleId,
  })
  const { data: products = [] } = useProducts()
  const createDamage = useCreateWeeklyDamage()
  const [open, setOpen] = useState(false)

  const schema = z.object({
    product: z.number().int().positive(),
    quantity: z.number().int().positive('Quantity must be > 0'),
    selling_price: z.string().min(1, 'Selling price required'),
    notes: z.string().optional(),
  })
  type Form = z.infer<typeof schema>

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      product: 0,
      quantity: 0,
      selling_price: '',
      notes: '',
    },
  })

  const columns: MRT_ColumnDef<WeeklySalesDamage>[] = [
    {
      accessorKey: 'recorded_at',
      header: 'Date',
      size: 160,
      Cell: ({ cell }) => formatDateTime(cell.getValue<string>()),
    },
    { accessorKey: 'product_name', header: 'Product' },
    {
      accessorKey: 'quantity',
      header: 'Qty',
      size: 80,
      Cell: ({ cell }) => cell.getValue<number>().toLocaleString(),
    },
    {
      accessorKey: 'selling_price',
      header: 'Unit Price',
      size: 120,
      Cell: ({ cell }) => formatK(cell.getValue<string>()),
    },
    {
      accessorKey: 'total_loss_value',
      header: 'Loss',
      size: 130,
      Cell: ({ cell }) => (
        <span className="font-semibold text-red-600">
          {formatK(cell.getValue<string>())}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} disabled={!isOpen}>
          <Plus className="h-4 w-4" />
          Add Damage
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyTitle="No damages yet"
        emptyDescription={
          isOpen
            ? 'Click "Add Damage" to record losses during this cycle.'
            : 'This cycle is closed.'
        }
      />

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          form.reset()
        }}
        title="Add Damage"
      >
        <form
          onSubmit={form.handleSubmit(async (data) => {
            try {
              await createDamage.mutateAsync({
                weekly_sales: cycleId,
                product: data.product,
                quantity: data.quantity,
                selling_price: data.selling_price,
                notes: data.notes ?? '',
              } as Partial<WeeklySalesDamage>)
              toast.success('Damage recorded')
              setOpen(false)
              form.reset()
            } catch (err) {
              const msg = (err as { response?: { data?: unknown } })?.response
                ?.data
              toast.error(msg ? JSON.stringify(msg) : 'Failed')
            }
          })}
          className="space-y-4"
        >
          <Controller
            name="product"
            control={form.control}
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
                error={form.formState.errors.product}
              />
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Quantity"
              required
              type="number"
              min={1}
              error={form.formState.errors.quantity}
              {...form.register('quantity', { valueAsNumber: true })}
            />
            <Controller
              name="selling_price"
              control={form.control}
              render={({ field }) => (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Selling Price <span className="text-red-500">*</span>
                  </label>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    error={Boolean(form.formState.errors.selling_price)}
                  />
                  {form.formState.errors.selling_price && (
                    <p className="mt-1 text-xs text-red-600">
                      {form.formState.errors.selling_price.message}
                    </p>
                  )}
                </div>
              )}
            />
          </div>
          <FormField
            label="Notes"
            placeholder="Optional"
            {...form.register('notes')}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                form.reset()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createDamage.isPending}>
              {createDamage.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}