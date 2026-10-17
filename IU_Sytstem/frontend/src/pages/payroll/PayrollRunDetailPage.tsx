import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { MRT_ColumnDef } from 'material-react-table'
import {
  ArrowLeft,
  FileText,
  FileSpreadsheet,
  PlayCircle,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DataTable } from '@/components/shared/DataTable'
import { CardSkeleton } from '@/components/shared/LoadingSkeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

import {
  usePayrollRun,
  useRunRecords,
  useProcessPayrollRun,
  useExportBank,
  useDownloadPayslip,
} from '@/hooks/queries/usePayroll'
import { formatK, formatDateTime } from '@/lib/format'
import type { PayrollRecord } from '@/types/payroll'
import { cn } from '@/lib/utils'

export function PayrollRunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const runId = Number(id)
  const navigate = useNavigate()

  const { data: run, isLoading } = usePayrollRun(runId)
  const { data: records = [], isLoading: loadingRecords } = useRunRecords(runId)
  const processRun = useProcessPayrollRun()
  const exportBank = useExportBank()
  const downloadPayslip = useDownloadPayslip()

  const [confirmProcess, setConfirmProcess] = useState(false)

  const totals = useMemo(() => {
    const sum = (fn: (r: PayrollRecord) => string) =>
      records.reduce((s, r) => s + Number(fn(r) || 0), 0)
    return {
      gross: sum((r) => r.gross_salary),
      napsa: sum((r) => r.napsa_employee),
      nhima: sum((r) => r.nhima_employee),
      paye: sum((r) => r.paye),
      deductions: sum((r) => r.total_deductions),
      net: sum((r) => r.net_salary),
    }
  }, [records])

  if (isLoading || !run) {
    return (
      <div>
        <PageHeader title="Payroll Run" />
        <CardSkeleton />
      </div>
    )
  }

  const canProcess = run.status !== 'completed' && run.status !== 'cancelled'
  const canExport = run.status === 'completed' && records.length > 0

  const handleExport = () => {
    exportBank.mutate(
      { id: runId, periodLabel: run.period_label },
      {
        onSuccess: () => toast.success('Bank CSV downloaded'),
        onError: (err) => {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data
              ?.error
          toast.error(msg ?? 'Export failed')
        },
      },
    )
  }

  const handleDownloadPayslip = (record: PayrollRecord) => {
    downloadPayslip.mutate(
      {
        id: record.id,
        employeeName: record.employee_name,
        period: run.period_label,
      },
      {
        onSuccess: () => toast.success('Payslip downloaded'),
        onError: () => toast.error('Download failed'),
      },
    )
  }

  const columns: MRT_ColumnDef<PayrollRecord>[] = [
    {
      accessorKey: 'employee_name',
      header: 'Employee',
      size: 180,
    },
    {
      accessorKey: 'basic_salary',
      header: 'Basic',
      size: 110,
      Cell: ({ cell }) => formatK(cell.getValue<string>()),
    },
    {
      accessorKey: 'gross_salary',
      header: 'Gross',
      size: 120,
      Cell: ({ cell }) => (
        <span className="font-semibold">{formatK(cell.getValue<string>())}</span>
      ),
    },
    {
      accessorKey: 'napsa_employee',
      header: 'NAPSA',
      size: 100,
      Cell: ({ cell }) => formatK(cell.getValue<string>()),
    },
    {
      accessorKey: 'nhima_employee',
      header: 'NHIMA',
      size: 100,
      Cell: ({ cell }) => formatK(cell.getValue<string>()),
    },
    {
      accessorKey: 'paye',
      header: 'PAYE',
      size: 110,
      Cell: ({ cell }) => formatK(cell.getValue<string>()),
    },
    {
      accessorKey: 'total_deductions',
      header: 'Deductions',
      size: 120,
      Cell: ({ cell }) => (
        <span className="text-red-600">{formatK(cell.getValue<string>())}</span>
      ),
    },
    {
      accessorKey: 'net_salary',
      header: 'Net Pay',
      size: 130,
      Cell: ({ cell }) => (
        <span className="font-semibold text-emerald-700">
          {formatK(cell.getValue<string>())}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 110,
      enableSorting: false,
      enableColumnFilter: false,
      Cell: ({ row }) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDownloadPayslip(row.original)
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          <FileText className="h-3.5 w-3.5" />
          Payslip
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/payroll/runs')}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to runs
        </button>

        <PageHeader
          title={run.period_label}
          description={`${run.period_start} → ${run.period_end}${
            run.processed_at
              ? ` · processed ${formatDateTime(run.processed_at)}`
              : ''
          }`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={run.status} />

              {canProcess && (
                <Button
                  onClick={() => setConfirmProcess(true)}
                  disabled={processRun.isPending}
                >
                  <PlayCircle className="h-4 w-4" />
                  {processRun.isPending ? 'Processing…' : 'Process'}
                </Button>
              )}

              {canExport && (
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={exportBank.isPending}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {exportBank.isPending ? 'Exporting…' : 'Export Bank CSV'}
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* Totals row */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <TotalCard label="Employees" value={String(records.length)} />
          <TotalCard label="Gross" value={formatK(totals.gross)} />
          <TotalCard label="NAPSA" value={formatK(totals.napsa)} />
          <TotalCard label="NHIMA" value={formatK(totals.nhima)} />
          <TotalCard label="PAYE" value={formatK(totals.paye)} />
          <TotalCard
            label="Net Pay"
            value={formatK(totals.net)}
            tone="positive"
          />
        </div>
      )}

      {/* Records table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Payroll Records
          </h2>
          {records.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total deductions:{' '}
              <span className="font-semibold text-red-600">
                {formatK(totals.deductions)}
              </span>
            </p>
          )}
        </div>

        <DataTable
          columns={columns}
          data={records}
          isLoading={loadingRecords}
          emptyTitle="No records yet"
          emptyDescription={
            canProcess
              ? "Click 'Process' above to generate payroll records for all active employees."
              : 'No employees with an active salary structure were found.'
          }
        />
      </div>

      {/* Confirm process */}
      <ConfirmDialog
        open={confirmProcess}
        onClose={() => setConfirmProcess(false)}
        onConfirm={async () => {
          try {
            const result = await processRun.mutateAsync(runId)
            toast.success(
              `Processed ${result.records_created} employee record(s)`,
            )
          } catch (err) {
            const msg = (err as { response?: { data?: { error?: string } } })
              ?.response?.data?.error
            toast.error(msg ?? 'Processing failed')
          }
        }}
        title="Process this payroll run?"
        description="This will compute payroll records for every active employee with a salary structure. Runs can only be processed once."
        confirmLabel="Process Payroll"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Total card
// ---------------------------------------------------------------------------

function TotalCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'positive'
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold',
          tone === 'positive' ? 'text-emerald-700' : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {value}
      </p>
    </div>
  )
}