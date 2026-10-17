import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { MRT_ColumnDef } from 'material-react-table'
import {
  AlertTriangle, Download, RefreshCw, Pencil,
} from 'lucide-react'
import { toast } from 'sonner'

import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

import {
  useMySubmissions,
  useResubmit,
  useDownloadReceipt,
} from '@/hooks/queries/useCashier'
import { formatK, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CashierSubmission } from '@/types/cashier'

export function MySubmissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('status') || ''
  const typeFilter = searchParams.get('type') || ''

  const { data, isLoading } = useMySubmissions({
    status: (statusFilter || undefined) as never,
    type: (typeFilter || undefined) as never,
  })

  const resubmit = useResubmit()
  const download = useDownloadReceipt()

  const items = data?.results ?? []

  const columns = useMemo<MRT_ColumnDef<CashierSubmission>[]>(
    () => [
      {
        accessorKey: 'type_display',
        header: 'Type',
        size: 130,
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
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {row.original.wholesale_name}
              {row.original.cycle_label !== '—' && ` · ${row.original.cycle_label}`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        size: 130,
        Cell: ({ cell }) => (
          <span className="font-semibold">
            {formatK(cell.getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'submitted_at',
        header: 'Submitted',
        size: 160,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string>()),
      },
      {
        accessorKey: 'finance_status',
        header: 'Status',
        size: 120,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} />,
      },
      {
        accessorKey: 'finance_notes',
        header: 'Notes',
        Cell: ({ cell }) => {
          const notes = cell.getValue<string>()
          if (!notes) return <span className="text-slate-400">—</span>
          return (
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {notes.length > 60 ? notes.slice(0, 60) + '…' : notes}
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
        Cell: ({ row }) => {
          const item = row.original
          return (
            <div className="flex items-center gap-1">
              {item.is_editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    resubmit.mutate(
                      { type: item.type, id: item.id },
                      {
                        onSuccess: () =>
                          toast.success('Resubmitted for finance review.'),
                        onError: () => toast.error('Resubmit failed.'),
                      },
                    )
                  }
                  disabled={resubmit.isPending}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Resubmit
                </Button>
              )}
              {item.type === 'cash_in' && (
                <button
                  onClick={() =>
                    download.mutate(item.id, {
                      onSuccess: () => toast.success('Receipt downloaded.'),
                      onError: () => toast.error('Download failed.'),
                    })
                  }
                  disabled={download.isPending}
                  className="rounded p-1 text-brand-600 transition hover:bg-brand-50 disabled:opacity-50 dark:text-brand-400 dark:hover:bg-brand-500/20"
                  title="Download receipt"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>
          )
        },
      },
    ],
    [resubmit, download],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        All submissions you have made, along with their finance review status.
        Queried and rejected items can be resubmitted after editing.
      </p>

      <FilterBar
        active={Boolean(statusFilter || typeFilter)}
        onClear={() => setSearchParams({})}
      >
        <Select
          value={statusFilter}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams)
            if (e.target.value) next.set('status', e.target.value)
            else next.delete('status')
            setSearchParams(next)
          }}
          className="w-44"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="queried">Queried</option>
          <option value="rejected">Rejected</option>
        </Select>

        <Select
          value={typeFilter}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams)
            if (e.target.value) next.set('type', e.target.value)
            else next.delete('type')
            setSearchParams(next)
          }}
          className="w-44"
        >
          <option value="">All types</option>
          <option value="cash_in">Cash-Ins</option>
          <option value="expense">Expenses</option>
          <option value="damage">Damages</option>
        </Select>

        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {items.length} submission(s)
        </span>
      </FilterBar>

      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        emptyTitle="No submissions yet"
        emptyDescription="Your cash-ins, expenses, and damages will appear here."
      />
    </div>
  )
}