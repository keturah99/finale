import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { MRT_ColumnDef } from 'material-react-table'
import {
  AlertTriangle, Check, X, MessageCircle, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Select } from '@/components/ui/select'

import {
  usePendingQueue,
  useApproveRecord,
  useRejectRecord,
  useQueryRecord,
} from '@/hooks/queries/useFinance'
import { formatK, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PendingItem, FinanceRecordType } from '@/types/finance'

// ---------------------------------------------------------------------------

export function FinanceQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const typeFilter = (searchParams.get('type') || '') as FinanceRecordType | ''
  const flaggedOnly = searchParams.get('flagged') === '1'

  const [reviewTarget, setReviewTarget] = useState<PendingItem | null>(null)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'query' | null>(null)

  const { data, isLoading } = usePendingQueue({
    type: typeFilter || undefined,
    flagged: flaggedOnly || undefined,
  })

  const items = data?.results ?? []

  const columns = useMemo<MRT_ColumnDef<PendingItem>[]>(
    () => [
      {
        accessorKey: 'type_display',
        header: 'Type',
        size: 130,
        Cell: ({ cell }) => (
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {cell.getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'reference',
        header: 'Reference',
        size: 220,
        Cell: ({ row }) => (
          <div>
            <p className="truncate text-sm text-slate-800 dark:text-slate-200">
              {row.original.reference}
            </p>
            {row.original.flags.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-1">
                {row.original.flags.slice(0, 1).map((f) => (
                  <span
                    key={f.code}
                    className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
                  >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {f.code.replace(/_/g, ' ')}
                  </span>
                ))}
                {row.original.flags.length > 1 && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    +{row.original.flags.length - 1}
                  </span>
                )}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'wholesale_name',
        header: 'Outlet',
        size: 160,
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        size: 140,
        Cell: ({ cell }) => (
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {formatK(cell.getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'submitted_by',
        header: 'Submitted By',
        size: 160,
        Cell: ({ cell }) => cell.getValue<string | null>() ?? '—',
      },
      {
        accessorKey: 'submitted_at',
        header: 'Submitted',
        size: 160,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string>()),
      },
      {
        accessorKey: 'age_days',
        header: 'Age',
        size: 80,
        Cell: ({ cell }) => {
          const days = cell.getValue<number>()
          return (
            <span
              className={cn(
                'text-xs font-medium',
                days > 7
                  ? 'text-red-600 dark:text-red-400'
                  : days > 3
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-600 dark:text-slate-400',
              )}
            >
              {days}d
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        size: 140,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setReviewTarget(row.original)
                setReviewAction('approve')
              }}
              className="rounded p-1 text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              title="Approve"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setReviewTarget(row.original)
                setReviewAction('query')
              }}
              className="rounded p-1 text-amber-600 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
              title="Raise query"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setReviewTarget(row.original)
                setReviewAction('reject')
              }}
              className="rounded p-1 text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              title="Reject"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <FilterBar
        active={Boolean(typeFilter || flaggedOnly)}
        onClear={() => setSearchParams({})}
      >
        <Select
          value={typeFilter}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams)
            if (e.target.value) next.set('type', e.target.value)
            else next.delete('type')
            setSearchParams(next)
          }}
          className="w-48"
        >
          <option value="">All types</option>
          <option value="cash_in">Cash-Ins</option>
          <option value="expense">Expenses</option>
          <option value="damage">Damages</option>
        </Select>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams)
              if (e.target.checked) next.set('flagged', '1')
              else next.delete('flagged')
              setSearchParams(next)
            }}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
          />
          Flagged only
        </label>

        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {items.length} item(s) pending
        </span>
      </FilterBar>

      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        emptyTitle="Nothing pending review"
        emptyDescription="All finance items have been reviewed."
      />

      {reviewTarget && reviewAction && (
        <ReviewDialog
          item={reviewTarget}
          action={reviewAction}
          onClose={() => {
            setReviewTarget(null)
            setReviewAction(null)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Review dialog
// ---------------------------------------------------------------------------

function ReviewDialog({
  item,
  action,
  onClose,
}: {
  item: PendingItem
  action: 'approve' | 'reject' | 'query'
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const approve = useApproveRecord()
  const reject = useRejectRecord()
  const query = useQueryRecord()

  const mutation = {
    approve,
    reject,
    query,
  }[action]

  const requiresReason = action !== 'approve'
  const title = {
    approve: 'Approve Item',
    reject: 'Reject Item',
    query: 'Raise Query',
  }[action]

  const description = {
    approve: 'Confirm approval of this item. It will be counted in financial reports.',
    reject: 'Provide a reason. The cashier will see this and can edit and resubmit.',
    query: 'Ask the cashier to review or clarify this item. They will be able to edit and resubmit.',
  }[action]

  const handleSubmit = () => {
    if (requiresReason && !reason.trim()) {
      toast.error('A reason is required.')
      return
    }

    mutation.mutate(
      {
        recordType: item.type,
        id: item.id,
        reason: requiresReason ? reason : undefined,
        notes: !requiresReason ? reason : undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            {
              approve: 'Item approved.',
              reject: 'Item rejected.',
              query: 'Query raised with the cashier.',
            }[action],
          )
          onClose()
        },
        onError: (err) => {
          const msg =
            (err as { response?: { data?: { error?: string | string[] } } })
              ?.response?.data?.error
          const display = Array.isArray(msg) ? msg[0] : msg
          toast.error(display ?? 'Action failed.')
        },
      },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={description}
      className="max-w-lg"
    >
      <div className="space-y-4">
        {/* Item summary */}
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              {item.type_display}
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {formatK(item.amount)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {item.reference}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {item.wholesale_name} · {item.submitted_by}
          </p>
          {item.flags.length > 0 && (
            <div className="mt-2 space-y-1">
              {item.flags.map((f) => (
                <p
                  key={f.code}
                  className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400"
                >
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {f.message}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Reason / notes */}
        <div>
          <Label required={requiresReason}>
            {requiresReason ? 'Reason' : 'Notes (optional)'}
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              requiresReason
                ? action === 'reject'
                  ? 'Explain why this item is being rejected…'
                  : 'What needs clarifying?'
                : 'Any notes for the record…'
            }
            rows={3}
            className="mt-1"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            variant={
              action === 'reject'
                ? 'destructive'
                : action === 'approve'
                  ? 'success'
                  : 'default'
            }
          >
            {mutation.isPending ? 'Working…' : title}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Dialog>
  )
}