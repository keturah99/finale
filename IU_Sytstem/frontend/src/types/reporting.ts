// frontend/src/types/reporting.ts

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