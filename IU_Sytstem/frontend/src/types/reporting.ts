// frontend/src/types/reporting.ts

// ---------------------------------------------------------------------------
// Dashboard (executive KPI summary)
// ---------------------------------------------------------------------------

export interface DashboardData {
  inventory: {
    products: number
    stock_value: number
    unresolved_alerts: number
  }
  supply_chain: {
    farmers: number
    purchases_count: number
    purchases_value: number
    batches_in_progress: number
    pending_collections: number
    outstanding_balance: number
  }
  transport: {
    vehicles: number
    available_vehicles: number
    drivers: number
    bookings_pending: number
    bookings_in_transit: number
  }
  payroll: {
    runs_completed: number
    last_run: {
      period_label: string
      processed_at: string
    } | null
  }
}

// ---------------------------------------------------------------------------
// Report generation — log
// ---------------------------------------------------------------------------

export type ReportFormat = 'json' | 'csv' | 'xlsx' | 'pdf'

export interface ReportLog {
  id: number
  report_type: string
  report_format: ReportFormat
  parameters: Record<string, unknown>
  file_name: string
  row_count: number
  generated_by: number | null
  generated_by_name: string | null
  generated_at: string
}

// ---------------------------------------------------------------------------
// Report catalogue definitions
// ---------------------------------------------------------------------------

export type FilterKind = 'date' | 'date-range' | 'select' | 'text'

export interface FilterOption {
  value: string | number
  label: string
}

export interface FilterDef {
  key: string
  label: string
  kind: FilterKind
  options?: FilterOption[]
  placeholder?: string
}

export interface ReportDef {
  type: string
  label: string
  description: string
  formats: ReportFormat[]
  filters: FilterDef[]
}

// ---------------------------------------------------------------------------
// Report generation payload
// ---------------------------------------------------------------------------

export interface GenerateReportPayload {
  type: string
  format: ReportFormat
  filters: Record<string, string | undefined>
}

// ---------------------------------------------------------------------------
// Report catalogue entry returned by the backend
// ---------------------------------------------------------------------------

export interface ReportCatalogueEntry {
  type: string
  label: string
  supported_formats: ReportFormat[]
}