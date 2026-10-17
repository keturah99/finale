import { useMemo, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'

import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useAuditLog } from '@/hooks/queries/useFinance'
import { formatDateTime } from '@/lib/format'
import type { FinanceReviewLog, FinanceLogAction } from '@/types/finance'

const ACTION_BADGE: Record<FinanceLogAction, string> = {
  submit: 'pending',
  approve: 'approved',
  reject: 'rejected',
  query: 'queried',
  resubmit: 'pending',
  reopen: 'pending',
}

export function FinanceAuditLogPage() {
  const [actionFilter, setActionFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: logs = [], isLoading } = useAuditLog({
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(typeFilter ? { record_type: typeFilter } : {}),
  })

  const columns = useMemo<MRT_ColumnDef<FinanceReviewLog>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: 'When',
        size: 180,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string>()),
      },
      {
        accessorKey: 'action_display',
        header: 'Action',
        size: 130,
        Cell: ({ row }) => (
          <StatusBadge
            status={ACTION_BADGE[row.original.action]}
            label={row.original.action_display}
          />
        ),
      },
      {
        accessorKey: 'record_type',
        header: 'Record',
        size: 200,
        Cell: ({ row }) => (
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {row.original.record_type} #{row.original.record_id}
          </span>
        ),
      },
      {
        accessorKey: 'actor_name',
        header: 'Actor',
        size: 180,
        Cell: ({ cell }) => cell.getValue<string | null>() ?? '—',
      },
      {
        accessorKey: 'from_status',
        header: 'From',
        size: 100,
        Cell: ({ cell }) => cell.getValue<string>() || '—',
      },
      {
        accessorKey: 'to_status',
        header: 'To',
        size: 100,
        Cell: ({ cell }) => cell.getValue<string>() || '—',
      },
      {
        accessorKey: 'reason',
        header: 'Reason',
        Cell: ({ cell }) => {
          const v = cell.getValue<string>()
          if (!v) return <span className="text-slate-400">—</span>
          return (
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {v.length > 80 ? v.slice(0, 80) + '…' : v}
            </span>
          )
        },
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Every finance review action is recorded here for audit purposes.
      </p>

      <FilterBar
        active={Boolean(actionFilter || typeFilter)}
        onClear={() => {
          setActionFilter('')
          setTypeFilter('')
        }}
      >
        <Select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="w-44"
        >
          <option value="">All actions</option>
          <option value="submit">Submitted</option>
          <option value="approve">Approved</option>
          <option value="reject">Rejected</option>
          <option value="query">Query Raised</option>
          <option value="resubmit">Resubmitted</option>
          <option value="reopen">Reopened</option>
        </Select>

        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-44"
        >
          <option value="">All record types</option>
          <option value="cash_in">Cash-Ins</option>
          <option value="expense">Expenses</option>
          <option value="damage">Damages</option>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        emptyTitle="No review history"
        emptyDescription="Finance actions will appear here once reviewers start working."
      />
    </div>
  )
}