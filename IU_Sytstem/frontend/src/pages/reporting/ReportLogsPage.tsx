import { useMemo, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'

import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { Input } from '@/components/ui/input'
import { useReportLogs } from '@/hooks/queries/useReporting'
import { formatDateTime } from '@/lib/format'
import type { ReportLog } from '@/types/reporting'

export function ReportLogsPage() {
  const [search, setSearch] = useState('')
  const { data: logs = [], isLoading } = useReportLogs()

  const filtered = useMemo(() => {
    if (!search) return logs
    const q = search.toLowerCase()
    return logs.filter(
      (l) =>
        l.report_type.toLowerCase().includes(q) ||
        l.file_name.toLowerCase().includes(q),
    )
  }, [logs, search])

  const columns = useMemo<MRT_ColumnDef<ReportLog>[]>(
    () => [
      { accessorKey: 'generated_at', header: 'Date', size: 180,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string>()) },
      { accessorKey: 'report_type', header: 'Report', size: 220,
        Cell: ({ cell }) => (
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {cell.getValue<string>().replace(/_/g, ' ')}
          </span>
        ) },
      { accessorKey: 'report_format', header: 'Format', size: 100,
        Cell: ({ cell }) => (
          <span className="inline-flex rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-1.5 py-0.5 text-xs font-medium uppercase text-slate-700 dark:text-slate-300">
            {cell.getValue<string>()}
          </span>
        ) },
      { accessorKey: 'row_count', header: 'Rows', size: 80 },
      { accessorKey: 'generated_by_name', header: 'By', size: 160,
        Cell: ({ cell }) => cell.getValue<string | null>() ?? '—' },
      { accessorKey: 'file_name', header: 'File', size: 280,
        Cell: ({ cell }) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
            {cell.getValue<string>()}
          </span>
        ) },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Every report generated is logged here with the user, format, and row count.
      </p>

      <FilterBar active={Boolean(search)} onClear={() => setSearch('')}>
        <Input placeholder="Search report or file…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="w-72" />
      </FilterBar>

      <DataTable columns={columns} data={filtered} isLoading={isLoading}
        emptyTitle="No reports generated yet"
        emptyDescription="Downloads from the Catalogue will appear here." />
    </div>
  )
}