import type { FinanceFlag, FinanceStatus, FinanceRecordType } from './finance'

// ---------------------------------------------------------------------------
// Cashier submission — uniform shape across types
// ---------------------------------------------------------------------------

export interface CashierSubmission {
  id: number
  type: FinanceRecordType
  type_display: string
  reference: string
  amount: string
  wholesale_id: number
  wholesale_name: string
  cycle_label: string
  submitted_at: string
  finance_status: FinanceStatus
  finance_notes: string
  finance_reviewed_at: string | null
  finance_reviewed_by_name: string | null
  flags: FinanceFlag[]
  is_editable: boolean
}

export interface CashierSubmissionsResponse {
  count: number
  results: CashierSubmission[]
}

// ---------------------------------------------------------------------------
// Summary shapes
// ---------------------------------------------------------------------------

export interface CashierDailySummary {
  date: string
  total_amount: number
  count: number
  approved_amount: number
  approved_count: number
  pending_amount: number
  pending_count: number
  queried_count: number
  rejected_count: number
}

export interface CashierWeeklyDay {
  date: string
  count: number
  total: number
  approved: number
  pending_count: number
}

export interface CashierWeeklySummary {
  days: CashierWeeklyDay[]
}