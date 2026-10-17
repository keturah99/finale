// ---------------------------------------------------------------------------
// Review status
// ---------------------------------------------------------------------------

export type FinanceStatus = 'pending' | 'approved' | 'rejected' | 'queried'

export type FinanceRecordType = 'cash_in' | 'expense' | 'damage'

// ---------------------------------------------------------------------------
// Flag — automated discrepancy warning
// ---------------------------------------------------------------------------

export interface FinanceFlag {
  code: string
  severity: 'info' | 'warning' | 'critical'
  message: string
}

// ---------------------------------------------------------------------------
// Combined pending queue item
// ---------------------------------------------------------------------------

export interface PendingItem {
  id: number
  type: FinanceRecordType
  type_display: string
  reference: string
  amount: string
  wholesale_id: number
  wholesale_name: string
  submitted_by: string | null
  submitted_at: string
  finance_status: FinanceStatus
  flags: FinanceFlag[]
  age_days: number
}

export interface PendingQueueResponse {
  count: number
  results: PendingItem[]
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface FinanceDashboard {
  pending: {
    cash_ins: { count: number; value: number }
    expenses: { count: number; value: number }
    damages: { count: number; value: number }
    total_count: number
  }
  flagged_count: number
  aging: {
    '0_3': number
    '4_7': number
    '8_14': number
    '15_plus': number
  }
  approved_today: number
  approved_this_week: number
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type FinanceLogAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'query'
  | 'resubmit'
  | 'reopen'

export interface FinanceReviewLog {
  id: number
  record_type: string
  record_id: number
  action: FinanceLogAction
  action_display: string
  actor: number | null
  actor_name: string | null
  reason: string
  from_status: string
  to_status: string
  created_at: string
}