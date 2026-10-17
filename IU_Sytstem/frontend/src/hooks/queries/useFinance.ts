import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  PendingQueueResponse,
  FinanceDashboard,
  FinanceReviewLog,
  FinanceRecordType,
} from '@/types/finance'

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const financeKeys = {
  all: ['finance'] as const,

  pending: (filters?: Record<string, unknown>) =>
    [...financeKeys.all, 'pending', filters] as const,

  dashboard: () => [...financeKeys.all, 'dashboard'] as const,

  auditLog: (filters?: Record<string, unknown>) =>
    [...financeKeys.all, 'audit-log', filters] as const,
}

// ---------------------------------------------------------------------------
// Pending queue
// ---------------------------------------------------------------------------

export function usePendingQueue(filters?: {
  type?: FinanceRecordType
  wholesale?: number
  flagged?: boolean
}) {
  return useQuery({
    queryKey: financeKeys.pending(filters),
    queryFn: async () => {
      const { data } = await api.get<PendingQueueResponse>(
        '/api/finance/pending/',
        {
          params: {
            ...(filters?.type ? { type: filters.type } : {}),
            ...(filters?.wholesale ? { wholesale: filters.wholesale } : {}),
            ...(filters?.flagged ? { flagged: 1 } : {}),
          },
        },
      )
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function useFinanceDashboard() {
  return useQuery({
    queryKey: financeKeys.dashboard(),
    queryFn: async () => {
      const { data } = await api.get<FinanceDashboard>('/api/finance/dashboard/')
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export function useAuditLog(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: financeKeys.auditLog(filters),
    queryFn: () => fetchList<FinanceReviewLog>('/api/finance/audit-log/', filters),
  })
}

// ---------------------------------------------------------------------------
// Review actions — shared mutation factory
// ---------------------------------------------------------------------------

function useReviewAction(
  action: 'approve' | 'reject' | 'query' | 'reopen',
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      recordType,
      id,
      reason,
      notes,
    }: {
      recordType: FinanceRecordType | 'weekly_damage' | 'storage_damage'
      id: number
      reason?: string
      notes?: string
    }) => {
      // Map frontend type to backend viewset URL segment
      const urlSegment: Record<string, string> = {
        cash_in: 'cash-ins',
        expense: 'expenses',
        damage: 'weekly-damages',
        weekly_damage: 'weekly-damages',
        storage_damage: 'storage-damages',
      }
      const url = `/api/finance/${urlSegment[recordType]}/${id}/${action}/`
      const body: Record<string, string> = {}
      if (reason) body.reason = reason
      if (notes) body.notes = notes
      const { data } = await api.post(url, body)
      return data
    },
    onSuccess: () => {
      // Invalidate everything under `finance` — matches the pending
      // queue with any filters, the dashboard, and the audit log.
      qc.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}

export const useApproveRecord = () => useReviewAction('approve')
export const useRejectRecord = () => useReviewAction('reject')
export const useQueryRecord = () => useReviewAction('query')
export const useReopenRecord = () => useReviewAction('reopen')

// ---------------------------------------------------------------------------
// Bulk approve
// ---------------------------------------------------------------------------

export function useBulkApprove() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      recordType,
      ids,
      notes,
    }: {
      recordType: FinanceRecordType
      ids: number[]
      notes?: string
    }) => {
      const { data } = await api.post('/api/finance/bulk-approve/', {
        record_type: recordType,
        record_ids: ids,
        notes: notes ?? '',
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}