// ---------------------------------------------------------------------------
// Outlets
// ---------------------------------------------------------------------------

export interface Wholesale {
  id: number
  name: string
  location: string
  manager: number | null
  manager_name: string | null
  phone: string
  is_active: boolean
  created_at: string
}

export interface WholesaleFormData {
  name: string
  location: string
  manager: number | null
  phone: string
  is_active: boolean
}

// ---------------------------------------------------------------------------
// Stock levels
// ---------------------------------------------------------------------------

export interface StockLevel {
  id: number
  wholesale: number
  product: number
  product_sku: string
  product_name: string
  quantity: number
  average_cost: string
  total_value: string
  last_updated: string
}

// ---------------------------------------------------------------------------
// Stock movements
// ---------------------------------------------------------------------------

export type StockInSource =
  | 'main_warehouse'
  | 'supplier'
  | 'transfer_in'
  | 'return'

export interface StockIn {
  id: number
  wholesale: number
  product: number
  product_name: string
  quantity: number
  unit_value: string
  total_value: string
  stock_from: StockInSource
  reference: string
  notes: string
  received_by: number | null
  received_at: string
}

export interface StockOut {
  id: number
  wholesale: number
  product: number
  product_name: string
  quantity: number
  unit_value: string
  total_value: string
  notes: string
  approved_by: number | null
  issued_at: string
}

export interface Damage {
  id: number
  wholesale: number
  product: number
  product_name: string
  quantity: number
  selling_price: string
  total_loss_value: string
  image: string | null
  notes: string
  reported_by: number | null
  reported_at: string
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

export type TransferStatus = 'pending' | 'in_transit' | 'received' | 'cancelled'

export interface Transfer {
  id: number
  from_wholesale: number
  from_name: string
  to_wholesale: number
  to_name: string
  product: number
  product_name: string
  quantity: number
  unit_value: string
  total_value: string
  status: TransferStatus
  reference: string
  notes: string
  initiated_by: number | null
  initiated_by_name: string | null
  initiated_at: string
  approved_by: number | null
  approved_by_name: string | null
  approved_at: string | null
  received_by: number | null
  received_by_name: string | null
  received_at: string | null
  cancelled_by: number | null
  cancelled_by_name: string | null
  cancelled_at: string | null
}

// ---------------------------------------------------------------------------
// Weekly sales
// ---------------------------------------------------------------------------

export type WeeklySalesStatus = 'open' | 'closed'

export interface WeeklySales {
  id: number
  wholesale: number
  wholesale_name: string
  year: number
  week_number: number
  label: string
  seller: number | null
  seller_name: string | null
  received_by: number | null
  received_by_name: string | null
  start_date: string
  end_date: string
  status: WeeklySalesStatus
  opened_at: string
  closed_at: string | null
  notes: string
  total_stock_in_value: string
  total_cashed: string
  total_expenses: string
  total_damages_value: string
  net_position: string
}

export interface WeeklySalesCashIn {
  id: number
  weekly_sales: number
  amount: string
  reference: string
  notes: string
  received_by: number | null
  received_by_name: string | null
  received_at: string
}

export interface WeeklySalesExpense {
  id: number
  weekly_sales: number
  amount: string
  description: string
  recorded_by: number | null
  recorded_by_name: string | null
  recorded_at: string
}

export interface WeeklySalesDamage {
  id: number
  weekly_sales: number
  product: number
  product_name: string
  quantity: number
  selling_price: string
  total_loss_value: string
  image: string | null
  notes: string
  recorded_by: number | null
  recorded_by_name: string | null
  recorded_at: string
}

export interface WeeklySalesSummary {
  label: string
  wholesale: string
  status: WeeklySalesStatus
  start_date: string
  end_date: string
  total_stock_in_value: string
  total_cashed: string
  total_expenses: string
  total_damages_value: string
  net_position: string
}