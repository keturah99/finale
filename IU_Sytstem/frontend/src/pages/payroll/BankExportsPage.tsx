import { useMemo } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

import { DataTable } from '@/components/shared/DataTable'
import {
  useBankExports,
  useDownloadBankExport,
} from '@/hooks/queries/usePayroll'
import { formatK, formatDateTime } from '@/lib/format'
import type { BankExport } from '@/types/payroll'


export function BankExportsPage() {
  const { data: exports = [], isLoading } = useBankExports()
  const download = useDownloadBankExport()

  const columns = useMemo<MRT_ColumnDef<BankExport>[]>(
    () => [
      {
        accessorKey: 'file_name',
        header: 'File',
        size: 280,
        Cell: ({ cell }) => (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
            {cell.getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'employee_count',
        header: 'Employees',
        size: 110,
      },
      {
        accessorKey: 'total_amount',
        header: 'Total',
        size: 140,
        Cell: ({ cell }) => (
          <span className="font-semibold">
            {formatK(cell.getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'exported_at',
        header: 'Exported',
        size: 180,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string>()),
      },
      {
        id: 'actions',
        header: '',
        size: 140,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <button
            onClick={() =>
              download.mutate(
                {
                  id: row.original.id,
                  fileName: row.original.file_name,
                },
                {
                  onSuccess: () =>
                    toast.success('Bank export downloaded'),
                  onError: () =>
                    toast.error('Download failed'),
                },
              )
            }
            disabled={download.isPending}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50 dark:text-brand-400 dark:hover:text-brand-300"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        ),
      },
    ],
    [download],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        History of every bank export generated. Bank files are generated
        from processed payroll runs and can be re-downloaded at any time.
      </p>

      <DataTable
        columns={columns}
        data={exports}
        isLoading={isLoading}
        emptyTitle="No bank exports yet"
        emptyDescription="Process a payroll run, then click 'Export Bank CSV' on the detail page."
      />
    </div>
  )
}