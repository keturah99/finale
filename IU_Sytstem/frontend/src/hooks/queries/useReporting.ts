import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, downloadFile } from '@/lib/api'
import type { ReportLog, ReportFormat } from '@/types/reporting'

interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

async function fetchList<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  const { data } = await api.get<Paginated<T> | T[]>(url, { params })
  return Array.isArray(data) ? data : data.results
}

export const reportingKeys = {
  all: ['reporting'] as const,
  logs: (filters?: Record<string, unknown>) =>
    [...reportingKeys.all, 'logs', filters] as const,
}

// ---------------------------------------------------------------------------
// Report log history
// ---------------------------------------------------------------------------

export function useReportLogs(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: reportingKeys.logs(filters),
    queryFn: () => fetchList<ReportLog>('/api/reporting/logs/', filters),
  })
}

// ---------------------------------------------------------------------------
// Generate a report (download)
// ---------------------------------------------------------------------------

function buildQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') search.set(k, v)
  })
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

function pickExtension(format: ReportFormat): string {
  return format === 'json' ? 'json' : format
}

export function useGenerateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      type,
      format,
      filters,
    }: {
      type: string
      format: ReportFormat
      filters: Record<string, string | undefined>
    }) => {
      const qs = buildQueryString({ ...filters, format })
      const url = `/api/reporting/generate/${type}/${qs}`
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const filename = `${type}_${stamp}.${pickExtension(format)}`
      await downloadFile(url, filename, 'get')
      return filename
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reportingKeys.logs() })
    },
  })
}