import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, downloadFile } from '@/lib/api'
import type {
  CashierSubmission,
  CashierSubmissionsResponse,
  CashierDailySummary,
  CashierWeeklySummary,
} from '@/types/cashier'
import type { FinanceStatus, FinanceRecordType } from '@/types/finance'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const cashierKeys = {
  all: ['cashier'] as const,

  submissions: (filters?: Record<string, unknown>) =>
    [...cashierKeys.all, 'submissions', filters] as const,

  daily: () => [...cashierKeys.all, 'daily-summary'] as const,
  weekly: () => [...cashierKeys.all, 'weekly-summary'] as const,
}

// ---------------------------------------------------------------------------
// My submissions
// ---------------------------------------------------------------------------

export function useMySubmissions(filters?: {
  status?: FinanceStatus
  type?: FinanceRecordType
}) {
  return useQuery({
    queryKey: cashierKeys.submissions(filters),
    queryFn: async () => {
      const { data } = await api.get<CashierSubmissionsResponse>(
        '/api/cashier/my-submissions/',
        {
          params: {
            ...(filters?.status ? { status: filters.status } : {}),
            ...(filters?.type ? { type: filters.type } : {}),
          },
        },
      )
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export function useDailySummary() {
  return useQuery({
    queryKey: cashierKeys.daily(),
    queryFn: async () => {
      const { data } = await api.get<CashierDailySummary>(
        '/api/cashier/daily-summary/',
      )
      return data
    },
  })
}

export function useWeeklySummary() {
  return useQuery({
    queryKey: cashierKeys.weekly(),
    queryFn: async () => {
      const { data } = await api.get<CashierWeeklySummary>(
        '/api/cashier/weekly-summary/',
      )
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// Resubmit
// ---------------------------------------------------------------------------

export function useResubmit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      type,
      id,
    }: {
      type: FinanceRecordType
      id: number
    }) => {
      const urlSegment: Record<string, string> = {
        cash_in: 'cash-ins',
        expense: 'expenses',
        damage: 'damages',
      }
      const url = `/api/cashier/submissions/${urlSegment[type]}/${id}/resubmit/`
      const { data } = await api.post(url)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cashierKeys.submissions() })
      qc.invalidateQueries({ queryKey: cashierKeys.daily() })
      qc.invalidateQueries({ queryKey: cashierKeys.weekly() })
    },
  })
}

// ---------------------------------------------------------------------------
// Receipt PDF
// ---------------------------------------------------------------------------

export function useDownloadReceipt() {
  return useMutation({
    mutationFn: async (cashInId: number) => {
      await downloadFile(
        `/api/cashier/submissions/cash-ins/${cashInId}/receipt/`,
        `receipt_${cashInId.toString().padStart(6, '0')}.pdf`,
        'get',
      )
    },
  })
}