import { useMemo } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { FileText, Download } from 'lucide-react'
import { toast } from 'sonner'

import { DataTable } from '@/components/shared/DataTable'
import { useMyPayslips, useDownloadPayslip } from '@/hooks/queries/usePayroll'
import { formatK } from '@/lib/format'
import type { PayrollRecord } from '@/types/payroll'

export function MyPayslipsPage() {
  const { data: records = [], isLoading } = useMyPayslips()
  const downloadPayslip = useDownloadPayslip()

  const columns = useMemo<MRT_ColumnDef<PayrollRecord>[]>(
    () => [
      { accessorKey: 'employee_name', header: 'Employee', size: 180 },
      { accessorKey: 'gross_salary', header: 'Gross', size: 130,
        Cell: ({ cell }) => formatK(cell.getValue<string>()) },
      { accessorKey: 'total_deductions', header: 'Deductions', size: 130,
        Cell: ({ cell }) => <span className="text-red-600">{formatK(cell.getValue<string>())}</span> },
      { accessorKey: 'net_salary', header: 'Net Pay', size: 140,
        Cell: ({ cell }) => (
          <span className="font-semibold text-emerald-700">{formatK(cell.getValue<string>())}</span>
        ) },
      { id: 'actions', header: '', size: 130, enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <button
            onClick={() =>
              downloadPayslip.mutate({
                id: row.original.id,
                employeeName: row.original.employee_name,
                period: 'payslip',
              }, {
                onSuccess: () => toast.success('Payslip downloaded'),
                onError: () => toast.error('Download failed'),
              })
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            <FileText className="h-3.5 w-3.5" />
            Download PDF
          </button>
        ) },
    ],
    [downloadPayslip],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Your payslips appear here after each payroll run is processed. You can download the PDF anytime.
      </p>

      <DataTable columns={columns} data={records} isLoading={isLoading}
        emptyTitle="No payslips yet"
        emptyDescription="Once payroll is processed, your payslips appear here." />
    </div>
  )
}