import { useState } from 'react'
import {
  FileText,
  FileSpreadsheet,
  FileJson,
  FileDown,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useGenerateReport } from '@/hooks/queries/useReporting'
import { REPORT_DEFINITIONS } from '@/lib/reportDefinitions'
import type { ReportDef, ReportFormat, FilterDef } from '@/types/reporting'
import { cn } from '@/lib/utils'

const FORMAT_ICONS: Record<ReportFormat, React.ComponentType<{ className?: string }>> = {
  json: FileJson,
  csv: FileText,
  xlsx: FileSpreadsheet,
  pdf: FileDown,
}

const FORMAT_LABELS: Record<ReportFormat, string> = {
  json: 'JSON',
  csv: 'CSV',
  xlsx: 'Excel',
  pdf: 'PDF',
}

export function ReportCataloguePage() {
  const [activeReport, setActiveReport] = useState<ReportDef | null>(null)

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Pick a report and download it in one of the supported formats. Report
        generations are recorded in the log for audit.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORT_DEFINITIONS.map((report) => (
          <ReportCard
            key={report.type}
            report={report}
            onOpen={() => setActiveReport(report)}
          />
        ))}
      </div>

      {activeReport && (
        <ReportDialog
          report={activeReport}
          onClose={() => setActiveReport(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function ReportCard({
  report,
  onOpen,
}: {
  report: ReportDef
  onOpen: () => void
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {report.label}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {report.description}
        </p>

        <div className="mt-3 flex flex-wrap gap-1">
          {report.formats.map((f) => {
            const Icon = FORMAT_ICONS[f]
            return (
              <span
                key={f}
                className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-300"
              >
                <Icon className="h-3 w-3" />
                {FORMAT_LABELS[f]}
              </span>
            )
          })}
        </div>
      </div>

      <Button variant="outline" size="sm" className="mt-4" onClick={onOpen}>
        {report.filters.length > 0 ? (
          <>
            <Filter className="h-3.5 w-3.5" />
            Configure & Download
          </>
        ) : (
          <>
            <FileDown className="h-3.5 w-3.5" />
            Download
          </>
        )}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

function ReportDialog({
  report,
  onClose,
}: {
  report: ReportDef
  onClose: () => void
}) {
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [format, setFormat] = useState<ReportFormat>(report.formats[0])
  const generate = useGenerateReport()

  const handleDownload = () => {
    generate.mutate(
      { type: report.type, format, filters },
      {
        onSuccess: (filename) => {
          toast.success(`Downloaded ${filename}`)
          onClose()
        },
        onError: (err) => {
          const msg = (err as { response?: { data?: { error?: string } } })
            ?.response?.data?.error
          toast.error(msg ?? 'Download failed')
        },
      },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={report.label}
      description={report.description}
      className="max-w-lg"
    >
      <div className="space-y-4">
        {/* Filters */}
        {report.filters.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Filters
            </h3>
            {report.filters.map((f) => (
              <FilterInput
                key={f.key}
                filter={f}
                value={filters[f.key] ?? ''}
                onChange={(v) =>
                  setFilters((prev) => ({ ...prev, [f.key]: v }))
                }
              />
            ))}
          </div>
        )}

        {/* Format picker */}
        <div>
          <Label>Format</Label>
          <div className="mt-1 flex gap-2">
            {report.formats.map((f) => {
              const Icon = FORMAT_ICONS[f]
              const active = format === f
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition',
                    active
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/20 text-brand-700'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {FORMAT_LABELS[f]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={generate.isPending}>
            <FileDown className="h-4 w-4" />
            {generate.isPending ? 'Generating…' : 'Download'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Filter input dispatcher
// ---------------------------------------------------------------------------

function FilterInput({
  filter,
  value,
  onChange,
}: {
  filter: FilterDef
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <Label>{filter.label}</Label>
      {filter.kind === 'select' ? (
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1"
        >
          <option value="">Any</option>
          {filter.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          type={filter.kind === 'date' ? 'date' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={filter.placeholder}
          className="mt-1"
        />
      )}
    </div>
  )
}