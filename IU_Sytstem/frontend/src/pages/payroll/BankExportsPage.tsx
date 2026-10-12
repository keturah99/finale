import { useMemo } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { DataTable } from '@/components/shared/DataTable'
import { useBankExports } from '@/hooks/queries/usePayroll'
import { formatK, formatDateTime } from '@/lib/format'
import type { BankExport } from '@/types/payroll'

export function BankExportsPage() {
  const { data: exports = [], isLoading } = useBankExports()

  const columns = useMemo<MRT_ColumnDef<BankExport>[]>(
    () => [
      { accessorKey: 'file_name', header: 'File', size: 260,
        Cell: ({ cell }) => (
          <span className="font-mono text-xs text-slate-700">{cell.getValue<string>()}</span>
        ) },
      { accessorKey: 'employee_count', header: 'Employees', size: 110 },
      { accessorKey: 'total_amount', header: 'Total', size: 140,
        Cell: ({ cell }) => (
          <span className="font-semibold">{formatK(cell.getValue<string>())}</span>
        ) },
      { accessorKey: 'exported_at', header: 'Exported', size: 180,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string>()) },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        History of every bank export generated. Bank files are generated from processed payroll runs.
      </p>

      <DataTable columns={columns} data={exports} isLoading={isLoading}
        emptyTitle="No bank exports yet"
        emptyDescription="Process a payroll run, then click 'Export Bank CSV' on the detail page." />
    </div>
  )
}